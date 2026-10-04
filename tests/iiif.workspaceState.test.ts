import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startLocalServer } from "../src/iiif/localServer.js";
import { saveWorkspace } from "../src/iiif/workspace.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";

describe("IIIF browser workspace synchronization", () => {
  it("keeps unsupported text targets through client merge, repeated loading, save and reload", async () => {
    const state = await import(pathToFileURL(path.resolve("packages/iiif-workbench/web/workspace-state.mjs")).href);
    const dir = await mkdtemp(path.join(tmpdir(), "iiif-text-save-"));
    let server: Awaited<ReturnType<typeof startLocalServer>> | undefined;
    try {
      const assets = path.join(dir, "web"), file = path.join(dir, "workspace.json");
      await mkdir(assets);
      await writeFile(path.join(assets, "index.html"), "<html>fixture</html>");
      await writeFile(path.join(assets, "workspace-state.mjs"), await readFile("packages/iiif-workbench/web/workspace-state.mjs"));
      const w = sampleWorkspace();
      w.documents[0].canvases[0].text_refs = [{
        id: "https://example.org/text-page", type: "AnnotationPage", items: [
          { id: "https://example.org/unsupported-text", type: "Annotation", target: {
            type: "SpecificResource", source: "https://example.org/c1",
            selector: { type: "SvgSelector", value: "<svg>unmapped-original</svg>" },
          }, body: { type: "TextualBody", format: "text/plain", value: "unmapped" } },
          { id: "https://example.org/plain-text", type: "Annotation", target: "https://example.org/c1",
            body: { type: "TextualBody", format: "text/plain", value: "original provider text" } },
        ],
      }] as any;
      await saveWorkspace(file, w, false);
      server = await startLocalServer({workspace_path: file, asset_root: assets});
      const url = new URL(server.url), base = url.origin;
      const headers = { "x-iiif-token": url.hash.slice(1), "content-type": "application/json", Origin: base };
      expect((await fetch(base + "/workspace-state.mjs")).status).toBe(200);
      const client = await (await fetch(base + "/api/workspace", {headers})).json();
      for (let n = 0; n < 2; n++) {
        const response = await fetch(base + "/api/text", {method: "POST", headers, body: JSON.stringify({document_id: "d1", canvas_id: "https://example.org/c1"})});
        expect(response.status).toBe(200);
        state.mergeTextResult(client, "d1", await response.json());
        expect((await fetch(base + "/api/workspace", {method: "POST", headers, body: JSON.stringify(client)})).status).toBe(200);
      }
      const saved = JSON.parse(await readFile(file, "utf8"));
      expect(saved.documents[0].diagnostics).toHaveLength(1);
      expect(saved.documents[0].diagnostics[0]).toContain("SvgSelector");
      expect(saved.documents[0].diagnostics[0]).toContain("<svg>unmapped-original</svg>");
      expect(saved.texts).toHaveLength(1);
      expect(saved.texts[0].text).toBe("original provider text");
      const loaded = await (await fetch(base + "/api/workspace", {headers})).json();
      expect(loaded.documents[0].diagnostics).toEqual(saved.documents[0].diagnostics);
    } finally { await server?.close(); await rm(dir, {recursive: true, force: true}); }
  });

  it("duplicates the current Canvas after a snapshot replaced window objects", async () => {
    const state = await import(pathToFileURL(path.resolve("packages/iiif-workbench/web/workspace-state.mjs")).href);
    const w = sampleWorkspace(), original = w.windows[0];
    w.windows = [{...original, canvas_id: "https://example.org/c2"}];
    state.addComparisonWindow(w, original.window_id, "new-window");
    expect(w.windows[1]).toEqual({window_id: "new-window", document_id: "d1", canvas_id: "https://example.org/c2"});
    expect(original.canvas_id).toBe("https://example.org/c1");
  });
});
