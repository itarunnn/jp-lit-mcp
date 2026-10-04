import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { exportEvidence, validateAnalysis } from "../src/iiif/evidence.js";
import {
  toWebAnnotations,
  fromWebAnnotations,
} from "../src/iiif/annotations.js";
import { saveWorkspace } from "../src/iiif/workspace.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
describe("IIIF evidence and reading provenance", () => {
  it("rejects an existing bundle even with overwrite and preserves source images and user analysis without fetching", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "iiif-existing-bundle-"));
    try {
      const file = path.join(dir, "w.json"), out = path.join(dir, "export");
      await saveWorkspace(file, sampleWorkspace(), false);
      await mkdir(out);
      const originals = {
        "evidence.json": '{"items":[{"evidence_id":"previous-region"}]}',
        "region-1.png": "previous-image-bytes",
        "region-1.info.json": '{"width":900,"height":1200}',
        "analysis.json": '{"researcher_note":"preserve my collation"}',
      };
      for (const [name, bytes] of Object.entries(originals)) await writeFile(path.join(out, name), bytes);
      let calls = 0;
      await expect(exportEvidence({
        api_version: "0.1", operation: "export_evidence", workspace_path: file,
        region_ids: ["r1"], output_dir: out, overwrite: true, image_permission_confirmed: true,
      }, async () => { calls++; throw new Error("Must not fetch"); })).rejects.toThrow(/新しい保存先/);
      expect(calls).toBe(0);
      expect((await readdir(out)).sort()).toEqual(Object.keys(originals).sort());
      for (const [name, bytes] of Object.entries(originals)) expect(await readFile(path.join(out, name), "utf8")).toBe(bytes);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
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
  it("fetches service info before cropping a thumbnail and exports metadata receipts and image rights", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "iiif-service-evidence-"));
    try {
      const w = sampleWorkspace(),
        image = w.documents[0].canvases[0].images[0];
      image.width = 500;
      image.height = 1000;
      (image as any).rights = [
        {
          scope: "image:" + image.image_id,
          field: "requiredStatement",
          value: "Image Credit",
        },
      ];
      const file = path.join(dir, "w.json");
      await saveWorkspace(file, w, false);
      const info = Buffer.from(
        JSON.stringify({
          "@context": "http://iiif.io/api/image/2/context.json",
          "@id": image.service.service_id,
          width: 2000,
          height: 4000,
          profile: "http://iiif.io/api/image/2/level1.json",
          attribution: "Service Credit",
        }),
      );
      const png = Buffer.alloc(24);
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
      png.write("IHDR", 12, "ascii");
      png.writeUInt32BE(600, 16);
      png.writeUInt32BE(800, 20);
      const urls: string[] = [];
      const r = await exportEvidence(
        {
          api_version: "0.1",
          operation: "export_evidence",
          workspace_path: file,
          region_ids: ["r1"],
          output_dir: path.join(dir, "export"),
          overwrite: false,
          image_permission_confirmed: true,
        },
        async (url: string) => {
          urls.push(url);
          const body = url.endsWith("info.json") ? info : png;
          return {
            body,
            content_type: url.endsWith("info.json")
              ? "application/json"
              : "image/png",
            receipt: {
              ...w.documents[0].receipt,
              requested_url: url,
              final_url: url,
              sha256: createHash("sha256").update(body).digest("hex"),
              bytes: body.length,
            },
          };
        },
      );
      expect(urls).toEqual([
        "https://example.org/image/info.json",
        "https://example.org/image/200,400,600,800/,800/0/default.jpg",
      ]);
      const e = JSON.parse(await readFile(r.evidence_json_path, "utf8"));
      expect(e.items[0].image_service.width).toBe(2000);
      expect(e.items[0].image_service.receipt.sha256).toBe(
        createHash("sha256").update(info).digest("hex"),
      );
      expect(
        await readFile(
          path.join(dir, "export", e.items[0].image_service.raw_path),
        ),
      ).toEqual(info);
      expect(JSON.stringify(e.items[0].source.rights)).toContain(
        "Image Credit",
      );
      expect(JSON.stringify(e.items[0].source.rights)).toContain(
        "Service Credit",
      );
      expect(e.items[0].display_image.original_image_xywh).toEqual([
        200, 400, 600, 800,
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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
