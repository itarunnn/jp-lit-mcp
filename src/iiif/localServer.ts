import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readWorkspace, saveWorkspace } from "./workspace.js";
import { validateWorkspace, textSchema, parseIiifRequest } from "./schemas.js";
import { exportEvidence } from "./evidence.js";
import { toWebAnnotations, fromWebAnnotations } from "./annotations.js";
import { viewerManifest } from "./viewerManifest.js";
import { loadSelectedText } from "./text.js";
import type { LocalServerOptions } from "./types.js";

export async function startLocalServer(
  options: LocalServerOptions,
): Promise<{ url: string; close: () => Promise<void> }> {
  if (
    !path.isAbsolute(options.workspace_path) ||
    !path.isAbsolute(options.asset_root)
  )
    throw new Error("絶対pathを指定してください");
  let workspace = await readWorkspace(options.workspace_path);
  const token = randomBytes(32).toString("hex");
  let origin = "";
  let busy = false;
  const manifests = new Map<string, unknown>();
  const files: Record<string, [string, string]> = {
    "/": ["index.html", "text/html; charset=utf-8"],
    "/app.mjs": ["app.mjs", "text/javascript"],
    "/viewer-adapter.mjs": ["viewer-adapter.mjs", "text/javascript"],
    "/styles.css": ["styles.css", "text/css"],
    "/vendor/mirador.min.js": ["vendor/mirador.min.js", "text/javascript"],
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https:; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    const json = (status: number, value: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(value));
    };
    let locked = false;
    try {
      if (
        req.headers.host !== new URL(origin).host ||
        (req.headers.origin && req.headers.origin !== origin)
      ) {
        json(403, { error: "Host/Originが一致しません" });
        return;
      }
      const pathname = new URL(req.url ?? "/", origin).pathname;
      if (req.method === "GET" && files[pathname]) {
        const [file, mime] = files[pathname];
        res.writeHead(200, { "Content-Type": mime });
        res.end(await readFile(path.join(options.asset_root, file)));
        return;
      }
      if (!pathname.startsWith("/api/")) {
        json(404, { error: "routeが見つかりません" });
        return;
      }
      const provided = Buffer.from(String(req.headers["x-iiif-token"] ?? ""));
      const expected = Buffer.from(token);
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected) ||
        (req.method === "POST" && req.headers.origin !== origin)
      ) {
        json(403, { error: "起動tokenとOriginが必要です" });
        return;
      }
      if (req.method === "GET" && pathname === "/api/workspace") {
        json(200, workspace);
        return;
      }
      if (req.method === "GET" && pathname === "/api/annotations") {
        json(200, toWebAnnotations(workspace.regions));
        return;
      }
      if (req.method === "GET" && pathname.startsWith("/api/manifest/")) {
        const doc = workspace.documents.find(
          (d) =>
            d.document_id ===
            decodeURIComponent(pathname.slice("/api/manifest/".length)),
        );
        if (!doc) {
          json(404, { error: "資料が見つかりません" });
          return;
        }
        if (!manifests.has(doc.document_id))
          manifests.set(doc.document_id, await viewerManifest(doc));
        json(200, manifests.get(doc.document_id));
        return;
      }
      if (
        req.method !== "POST" ||
        ![
          "/api/workspace",
          "/api/text",
          "/api/text/import",
          "/api/export",
          "/api/annotations/import",
        ].includes(pathname)
      ) {
        json(404, { error: "routeが見つかりません" });
        return;
      }
      if (busy) {
        json(409, { error: "処理中です" });
        return;
      }
      busy = true;
      locked = true;
      if (
        !String(req.headers["content-type"] ?? "").startsWith(
          "application/json",
        )
      ) {
        json(415, { error: "JSONで指定してください" });
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 45 * 1024 * 1024) {
          json(413, { error: "入力容量の上限です" });
          req.destroy();
          return;
        }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (pathname === "/api/workspace") {
        const next = validateWorkspace(body);
        await saveWorkspace(options.workspace_path, next, true);
        workspace = next;
        manifests.clear();
        json(200, { saved: true });
        return;
      }
      if (pathname === "/api/export") {
        const r = parseIiifRequest({
          ...body,
          api_version: "0.1",
          operation: "export_evidence",
          workspace_path: options.workspace_path,
        });
        if (r.operation !== "export_evidence")
          throw new Error("export要求を指定してください");
        json(200, await exportEvidence(r));
        return;
      }
      if (pathname === "/api/annotations/import") {
        workspace = validateWorkspace({
          ...workspace,
          regions: [
            ...new Map(
              [...workspace.regions, ...fromWebAnnotations(body)].map((r) => [
                r.selection.region_id,
                r,
              ]),
            ).values(),
          ],
        });
        await saveWorkspace(options.workspace_path, workspace, true);
        json(200, workspace);
        return;
      }
      const doc = workspace.documents.find(
        (d) => d.document_id === body.document_id,
      );
      if (
        !doc ||
        !workspace.windows.some(
          (w) =>
            w.document_id === doc.document_id && w.canvas_id === body.canvas_id,
        )
      )
        throw new Error("表示中Canvasを指定してください");
      const texts =
        pathname === "/api/text"
          ? await loadSelectedText(doc, body.canvas_id)
          : [textSchema.parse(body.text)];
      if (texts.some((t) => t.canvas_id !== body.canvas_id))
        throw new Error("textのCanvasが一致しません");
      workspace = validateWorkspace({
        ...workspace,
        texts: [
          ...new Map(
            [...workspace.texts, ...texts].map((t) => [t.text_id, t]),
          ).values(),
        ],
      });
      await saveWorkspace(options.workspace_path, workspace, true);
      json(200, { texts });
    } catch (error) {
      if (!res.headersSent)
        json(400, {
          error:
            error instanceof Error ? error.message : "処理を確認してください",
        });
      else res.end();
    } finally {
      if (locked) busy = false;
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 20000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("HTTP起動に失敗しました");
  origin = `http://127.0.0.1:${address.port}`;
  return {
    url: `${origin}/#${token}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve()));
        server.closeAllConnections();
      }),
  };
}
