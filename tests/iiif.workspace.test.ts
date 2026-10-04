import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseIiifRequest, validateWorkspace } from "../src/iiif/schemas.js";
import { saveWorkspace } from "../src/iiif/workspace.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";

describe("IIIF workspace contract", () => {
  it("rejects unresolved IDs, out-of-canvas coordinates and nonfinite numbers", () => {
    for (const modify of [
      (w: any) => (w.windows[0].canvas_id = "missing"),
      (w: any) => (w.regions[0].selection.xywh = [0, 0, 1001, 1]),
      (w: any) => (w.regions[0].selection.xywh[0] = Infinity),
      (w: any) => (w.regions[0].text_evidence_ids = ["missing"]),
      (w: any) => (w.schema_version = "99"),
      (w: any) =>
        (w.windows = Array.from({ length: 5 }, (_, i) => ({
          ...w.windows[0],
          window_id: String(i),
        }))),
    ]) {
      const w = sampleWorkspace();
      modify(w);
      expect(() => validateWorkspace(w)).toThrow();
    }
  });
  it("keeps original labels and Canvas coordinates across saving and reopening", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "iiif-"));
    try {
      const file = path.join(dir, "workspace.json");
      await saveWorkspace(file, sampleWorkspace(), false);
      const w = validateWorkspace(JSON.parse(await readFile(file, "utf8")));
      expect(w.documents[0].label).toEqual([
        { language: "ja", values: ["試料"] },
      ]);
      expect(w.regions[0].selection.xywh).toEqual([100, 200, 300, 400]);
      await expect(saveWorkspace(file, w, false)).rejects.toThrow();
      await saveWorkspace(file, w, true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("requires absolute output paths and limits explicit evidence selection", () => {
    expect(() =>
      parseIiifRequest({
        api_version: "0.1",
        operation: "prepare_workspace",
        candidates: [],
        output_dir: "relative",
      }),
    ).toThrow();
    expect(() =>
      parseIiifRequest({
        api_version: "0.1",
        operation: "export_evidence",
        workspace_path: "/tmp/a",
        output_dir: "/tmp/b",
        region_ids: ["1", "2", "3", "4", "5"],
      }),
    ).toThrow();
    expect(
      parseIiifRequest({
        api_version: "0.1",
        operation: "inspect_manifest",
        manifest_url: "https://example.org/m",
      }).operation,
    ).toBe("inspect_manifest");
  });
});
