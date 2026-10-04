import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { exportEvidence, validateAnalysis } from "../src/iiif/evidence.js";
import {
  toWebAnnotations,
  fromWebAnnotations,
} from "../src/iiif/annotations.js";
import { saveWorkspace } from "../src/iiif/workspace.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
describe("IIIF evidence and reading provenance", () => {
  it("exports selected provenance while deferring acquisition until permission is confirmed", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "iiif-evidence-"));
    try {
      const file = path.join(dir, "w.json");
      await saveWorkspace(file, sampleWorkspace(), false);
      const r = await exportEvidence({
        api_version: "0.1",
        operation: "export_evidence",
        workspace_path: file,
        region_ids: ["r1"],
        output_dir: path.join(dir, "evidence"),
        overwrite: false,
        image_permission_confirmed: false,
      });
      const e = JSON.parse(await readFile(r.evidence_json_path, "utf8"));
      expect(e.items[0].selection.xywh).toEqual([100, 200, 300, 400]);
      expect(e.items[0].source.receipt.sha256).toBe("a".repeat(64));
      expect(e.items[0].display_image).toBeNull();
      expect(r.image_paths).toHaveLength(0);
      expect(e.items[0].original_image.sha256).toBeNull();
      await expect(
        exportEvidence({
          api_version: "0.1",
          operation: "export_evidence",
          workspace_path: file,
          region_ids: ["absent"],
          output_dir: path.join(dir, "bad"),
          overwrite: false,
          image_permission_confirmed: false,
        }),
      ).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("preserves annotation coordinates and local IDs in its declared round-trip profile", () => {
    const regions = sampleWorkspace().regions;
    const page = toWebAnnotations(regions as any);
    expect(page.items[0].target.selector.value).toBe("xywh=100,200,300,400");
    expect(fromWebAnnotations(page)).toEqual(regions);
    (page.items[0].target.selector as any).type = "SvgSelector";
    expect(() => fromWebAnnotations(page)).toThrow();
  });
  it("requires real evidence IDs and keeps AI candidates separate from source text", () => {
    const valid = {
      generated_by: "model",
      executed_at: "2026-10-05T00:00:00Z",
      items: [
        {
          evidence_id: "r1",
          observations: ["線が見える"],
          transcription_candidate: "候補",
          interpretation: "解釈",
          uncertainties: ["未校合"],
          verification_state: "ai_candidate",
        },
      ],
    };
    expect(validateAnalysis(valid, ["r1"]).items[0].verification_state).toBe(
      "ai_candidate",
    );
    expect(() => validateAnalysis(valid, ["r2"])).toThrow();
    expect(() =>
      validateAnalysis(
        { ...valid, items: [{ ...valid.items[0], evidence_id: "" }] },
        ["r1"],
      ),
    ).toThrow();
  });
});
