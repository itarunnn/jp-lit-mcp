import { createHash } from "node:crypto";
import { sampleWorkspace } from "./sample.js";
export const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export function ocrSource() {
  const w = sampleWorkspace();
  return { workspace_id: w.workspace_id, document_id: "d1", manifest_sha256: "a".repeat(64),
    evidence_id: "r1", selection: w.regions[0].selection, canvas_width: 1000, canvas_height: 2000,
    image_sha256: "b".repeat(64), image_width: 150, image_height: 200,
    original_image_xywh: [200, 400, 600, 800], canvas_to_image: { scale_x: 2, scale_y: 2 }, scale_x: .25, scale_y: .25 };
}
export function ocrCandidate() {
  return { text_id: "ocr-1", canvas_id: "https://example.org/c1", target_xywh: [100, 200, 300, 400],
    source_ref: "J:/research/run.json#r1", source_sha256: digest("古い本文\n"), text: "古い本文\n", origin: "ocr_candidate", verification_state: "unverified",
    ocr_provenance: { run_id: "run-1", run_path: "J:/research/run.json", run_sha256: "c".repeat(64),
      evidence_path: "J:/research/evidence.json", evidence_sha256: "d".repeat(64),
      engine: { provider: "ndlkotenocr-lite", engine_dir: "J:/engine", python_path: "J:/python.exe", python_version: "Python 3.12", engine_sha256: "e".repeat(64),
        files: [{ path: "src/ocr.py", sha256: "f".repeat(64) }] },
      source: ocrSource(), started_at: "2026-10-05T00:00:00Z", finished_at: "2026-10-05T00:00:01Z", duration_ms: 1000,
      artifacts: [{ path: "J:/research/raw/image.txt", sha256: digest("古い本文\n") }],
      lines: [{ line_id: "0", text: "古い本文", bounding_box: [[0,0],[0,100],[50,0],[50,100]], image_xywh: [0,0,50,100], canvas_xywh: [100,200,100,200], detection_confidence: .8 }],
      diagnostics: [], reviews: [] } };
}
