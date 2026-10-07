import { afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sampleWorkspace } from "./sample.js";
import { digest, ocrCandidate } from "./ocr.js";
import { importOcr } from "../../../src/iiif/ocrImport.js";
const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
export async function readingFixture(two = false) {
  const dir = await mkdtemp(path.join(tmpdir(), "ocr-evaluation-")); dirs.push(dir);
  const raw = path.join(dir, "run"); await mkdir(raw);
  const t = ocrCandidate(), p = t.ocr_provenance, png = Buffer.alloc(24);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.write("IHDR",12); png.writeUInt32BE(150,16); png.writeUInt32BE(200,20);
  p.source.image_sha256 = digest(png);
  const files = { "input.png": png, "input.txt": t.text, "input.json": JSON.stringify({ imginfo: { img_width: 150, img_height: 200 }, contents: [p.lines.map(l => ({ id: l.line_id, text: l.text, boundingBox: l.bounding_box, confidence: l.detection_confidence }))] }) };
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(raw, name), content);
  const sources = [p.source]; if (two) sources.push({ ...structuredClone(p.source), evidence_id: "r2", selection: { ...p.source.selection, region_id: "r2" } });
  const evidence = JSON.stringify({ schema_version: "0.1", workspace_id: "w1", items: sources.map(s => ({ evidence_id: s.evidence_id, selection: s.selection,
    source: { document_id: s.document_id, receipt: { sha256: s.manifest_sha256 } }, canvas: { canvas_id: s.selection.canvas_id, width: s.canvas_width, height: s.canvas_height },
    crop: { status: "supported", image_xywh: s.original_image_xywh, transform: s.canvas_to_image }, image_permission_confirmed: true,
    display_image: { path: "input.png", receipt: { sha256: s.image_sha256 }, width: s.image_width, height: s.image_height, original_image_xywh: s.original_image_xywh, canvas_to_image: s.canvas_to_image, scale_x: s.scale_x, scale_y: s.scale_y }, text_evidence: [] })) });
  await writeFile(path.join(raw, "evidence.json"), evidence);
  await writeFile(path.join(dir, "original-evidence.json"), evidence); await writeFile(path.join(dir,"input.png"),png);
  const run = { schema_version: "0.1", run_id: "run-1", status: "completed", image_transmission: "none", device: "cpu", engine: p.engine, evidence_path: path.join(dir,"original-evidence.json"), evidence_sha256: digest(evidence),
    items: sources.map(source => ({ status: "completed", source, started_at: p.started_at, finished_at: p.finished_at, duration_ms: 1000, artifacts: Object.entries(files).map(([name, content]) => ({ path: name, sha256: digest(content) })), text: t.text, lines: p.lines, diagnostics: [], error: null })) };
  const runPath = path.join(raw, "run.json"); await writeFile(runPath, JSON.stringify(run));
  const w = sampleWorkspace(); if (two) w.regions.push({ ...structuredClone(w.regions[0]), selection: sources[1].selection });
  const imported = (await importOcr(w, runPath)).workspace;
  const workspacePath = path.join(dir,"workspace.json"), evaluationPath = path.join(dir,"evaluation.json"), outputPath = path.join(dir,"report.json");
  await writeFile(workspacePath, JSON.stringify(imported));
  const evaluation: any = { schema_version: "0.1", evaluation_id: "eval-1", workspace_id: "w1", cases: imported.texts.map((text, i) => ({ case_id: `case-${i}`, text_id: text.text_id,
    reference: i ? null : { scope: "full_region", text: "古い本丈\n", text_sha256: digest("古い本丈\n"), origin: "published_transcription", source_ref: "https://example.org/transcription", verification: "unreviewed", review: null, training_overlap: "unknown", note: "合成fixture" }, variants: [], observations: null })) };
  await writeFile(evaluationPath, JSON.stringify(evaluation));
  const { evaluateOcr } = await import("../../../src/iiif/ocrEvaluation.js");
  const evaluate = async () => evaluateOcr(workspacePath,evaluationPath,outputPath,false);
  return { dir, raw, runPath, imported, workspacePath, evaluationPath, outputPath, evaluation, evaluate };
}

