import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { startLocalServer } from "../src/iiif/localServer.js";
import { saveWorkspace } from "../src/iiif/workspace.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
describe("IIIF local server boundary", () => {
  it("restricts token, Origin, Host and assets, persists only a valid designated workspace, and closes", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "iiif-server-"));
    let server: Awaited<ReturnType<typeof startLocalServer>> | undefined;
    try {
      const assets = path.join(dir, "web");
      await mkdir(assets);
      await writeFile(path.join(assets, "index.html"), "<html>fixture</html>");
      const workspace = path.join(dir, "workspace.json");
      await saveWorkspace(workspace, sampleWorkspace(), false);
      server = await startLocalServer({
        workspace_path: workspace,
        asset_root: assets,
      });
      const url = new URL(server.url),
        base = url.origin,
        token = url.hash.slice(1);
      expect(url.hostname).toBe("127.0.0.1");
      expect((await fetch(base + "/api/workspace")).status).toBe(403);
      expect((await fetch(base + "/../package.json")).status).toBe(404);
      const status = await new Promise((resolve) => {
        http.get(base + "/", { headers: { Host: "evil.example" } }, (res) => {
          res.resume();
          resolve(res.statusCode);
        });
      });
      expect(status).toBe(403);
      const headers = {
        "content-type": "application/json",
        "x-iiif-token": token,
        Origin: base,
      };
      expect(
        (
          await fetch(base + "/api/workspace", {
            method: "POST",
            headers: { ...headers, Origin: "https://evil.example" },
            body: JSON.stringify(sampleWorkspace()),
          })
        ).status,
      ).toBe(403);
      const w = sampleWorkspace();
      w.regions[0].note = "<script>untrusted</script>";
      expect(
        (
          await fetch(base + "/api/workspace", {
            method: "POST",
            headers,
            body: JSON.stringify(w),
          })
        ).status,
      ).toBe(200);
      expect(
        JSON.parse(await readFile(workspace, "utf8")).regions[0].note,
      ).toBe("<script>untrusted</script>");
      w.regions[0].selection.canvas_id = "missing";
      expect(
        (
          await fetch(base + "/api/workspace", {
            method: "POST",
            headers,
            body: JSON.stringify(w),
          })
        ).status,
      ).toBe(400);
      await server.close();
      server = undefined;
      await expect(fetch(base + "/")).rejects.toThrow();
    } finally {
      await server?.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
