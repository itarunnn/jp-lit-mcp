import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { ZodError } from "zod";
import { parseIiifRequest } from "./schemas.js";
import { loadPublicResource } from "./publicResource.js";
import { normalizeManifest } from "./manifest.js";
import { saveWorkspace, readWorkspace, atomicWrite } from "./workspace.js";
import { linkTei, readTeiLinks } from "./tei.js";
import { exportEvidence } from "./evidence.js";
import { startLocalServer } from "./localServer.js";
import { inspectOcrProvider, runOcr } from "./ocrRunner.js";
import { importOcr } from "./ocrImport.js";
import { evaluateOcr } from "./ocrEvaluation.js";
import { prepareReading, importReading } from "./reading.js";
import { protectWorkspaceSources } from "./outputProtection.js";
import type { CliIo, IiifWorkspace, ManifestCandidate } from "./types.js";
const help =
  'jp-lit-iiif --request <UTF-8 JSON path>\njp-lit-iiif serve --workspace <absolute workspace.json path>\napi_version: "0.1"; operations: inspect_manifest / prepare_workspace / export_evidence / link_tei / inspect_ocr_provider / run_ocr / import_ocr / evaluate_ocr / prepare_reading / import_reading\n';
export async function runIiifCli(argv: string[], io: CliIo): Promise<number> {
  let phase: "input" | "operation" = "input";
  try {
    if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) {
      io.stdout(help);
      return 0;
    }
    if (argv[0] === "serve") {
      if (
        argv.length !== 3 ||
        argv[1] !== "--workspace" ||
        !path.isAbsolute(argv[2])
      )
        throw new Error(help);
      phase = "operation";
      const server = await startLocalServer({
        workspace_path: argv[2],
        asset_root: fileURLToPath(new URL("../../iiif/web/", import.meta.url)),
      });
      io.stdout(JSON.stringify({ ok: true, url: server.url }) + "\n");
      io.stderr("比較画面のURLを開いてください。終了はCtrl+Cです。\n");
      await new Promise<void>((resolve) => {
        const stop = () => {
          process.off("SIGINT", stop);
          process.off("SIGTERM", stop);
          void server.close().then(resolve);
        };
        process.on("SIGINT", stop);
        process.on("SIGTERM", stop);
      });
      return 0;
    }
    if (argv.length !== 2 || argv[0] !== "--request") throw new Error(help);
    const bytes = await readFile(path.resolve(io.cwd, argv[1]));
    if (bytes.byteLength > 1024 * 1024)
      throw new Error("request容量が上限を超えます");
    const request = parseIiifRequest(
      JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")),
    );
    phase = "operation";
    let result: unknown;
    if (request.operation === "prepare_reading") {
      result=await prepareReading(request.workspace_path,request.text_id,request.kind,request.output_dir);
    } else if(request.operation === "import_reading") {
      const imported=await importReading(await readWorkspace(request.workspace_path),request.task_path,request.response_path,request.output_path);
      await saveWorkspace(request.output_path,imported.workspace,request.overwrite);
      result={workspace_path:request.output_path,text_id:imported.text_id,imported:imported.imported};
    } else if (request.operation === "evaluate_ocr") {
      result = await evaluateOcr(request.workspace_path, request.evaluation_path, request.output_path, request.overwrite);
    } else if (request.operation === "import_ocr") {
      const imported=await importOcr(await readWorkspace(request.workspace_path),request.run_path);
      await protectWorkspaceSources(request.output_path, imported.workspace);
      await saveWorkspace(request.output_path,imported.workspace,request.overwrite);
      result={workspace_path:request.output_path,imported:imported.imported,skipped:imported.skipped};
    } else if (request.operation === "inspect_ocr_provider") {
      result = await inspectOcrProvider(request);
    } else if (request.operation === "run_ocr") {
      const run = await runOcr(request);
      if (run.status !== "completed") {
        io.stdout(JSON.stringify({ok:false,result:run,error:"OCRの失敗があります。保存したrunと原出力を確認してください"})+"\n");
        return 4;
      }
      result = run;
    } else if (request.operation === "link_tei") {
      const w = await readWorkspace(request.workspace_path);
      await protectWorkspaceSources(request.output_path, w, [request.file_path]);
      const response = await readTeiLinks(request.file_path, request.expected_sha256, request.limit, request.offset);
      const next = linkTei(w, response, request);
      await saveWorkspace(request.output_path, next, request.overwrite);
      const page = response as { result: { total_occurrences: number; next_offset: number | null } };
      result = { workspace_path: request.output_path, total_occurrences: page.result.total_occurrences, next_offset: page.result.next_offset,
        states: { resolved: next.tei_links!.filter((l) => l.state === "resolved").length, candidate: next.tei_links!.filter((l) => l.state === "candidate").length, unresolved: next.tei_links!.filter((l) => l.state === "unresolved").length } };
    } else if (request.operation === "export_evidence")
      result = await exportEvidence(request);
    else if (request.operation === "inspect_manifest") {
      const r = await loadPublicResource(request.manifest_url, {
        max_bytes: 10 * 1024 * 1024,
        timeout_ms: 15000,
        max_redirects: 3,
        kind: "json",
      });
      const d = normalizeManifest(
        JSON.parse(Buffer.from(r.body).toString("utf8")),
        r.receipt,
        request.sequence_id,
      );
      d.candidate = {
        source: request.source ?? "manual",
        source_id: request.source_id ?? d.declared_id,
        record_url: request.record_url ?? null,
        manifest_url: request.manifest_url,
        acquisition: "manual_url",
        verification_state: "candidate",
      };
      result = d;
    } else {
      const w: IiifWorkspace = {
        schema_version: "0.1",
        workspace_id: randomUUID(),
        created_at: new Date().toISOString(),
        documents: [],
        windows: [],
        regions: [],
        texts: [],
        viewer_state: {
          adapter_version: "mirador-4.2.6-v1",
          windows: [],
          native_state: null,
        },
      };
      const raw: Array<{
        candidate: ManifestCandidate;
        body: Uint8Array;
        id: string;
      }> = [];
      for (const c of request.candidates) {
        const r = await loadPublicResource(c.manifest_url, {
          max_bytes: 10 * 1024 * 1024,
          timeout_ms: 15000,
          max_redirects: 3,
          kind: "json",
        });
        const d = normalizeManifest(
          JSON.parse(Buffer.from(r.body).toString("utf8")),
          r.receipt,
          request.sequence_ids?.[c.manifest_url],
        );
        d.candidate = c;
        if (w.documents.some((doc) => doc.document_id === d.document_id))
          throw new Error("同じmanifestは窓を追加して比較してください");
        w.documents.push(d);
        w.windows.push({
          window_id: `window-${w.windows.length + 1}`,
          document_id: d.document_id,
          canvas_id: d.canvases[0].canvas_id,
        });
        raw.push({ candidate: c, body: r.body, id: d.document_id });
      }
      const workspacePath = path.join(request.output_dir, "workspace.json");
      await mkdir(request.output_dir, { recursive: true });
      await saveWorkspace(workspacePath, w, request.overwrite);
      for (const r of raw)
        await atomicWrite(
          path.join(request.output_dir, `${r.id}.manifest.json`),
          r.body,
          request.overwrite,
        );
      result = {
        workspace_path: workspacePath,
        documents: w.documents.map((d) => ({
          document_id: d.document_id,
          canvases: d.canvases.length,
          diagnostics: d.diagnostics,
        })),
      };
    }
    io.stdout(JSON.stringify({ ok: true, result }) + "\n");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      phase === "input" || error instanceof ZodError
        ? 2
        : /未対応|静止画像/.test(message)
          ? 3
          : 4;
    io.stdout(JSON.stringify({ ok: false, error: message }) + "\n");
    return code;
  }
}
