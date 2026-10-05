import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { digest, ocrCandidate } from "./fixtures/iiif/ocr.js";
import { importOcr } from "../src/iiif/ocrImport.js";
import { runIiifCli } from "../src/iiif/cli.js";
const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function fixture(two = false) {
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
  const { evaluateOcr } = await import("../src/iiif/ocrEvaluation.js");
  const evaluate = async () => evaluateOcr(workspacePath,evaluationPath,outputPath,false);
  return { dir, raw, runPath, imported, workspacePath, evaluationPath, outputPath, evaluation, evaluate };
}
describe("source-bound OCR evaluation", () => {
  it("reports reference agreement with original provenance and preserves inputs", async () => {
    const f = await fixture(), before = await readFile(f.workspacePath);
    await f.evaluate(); const report = JSON.parse(await readFile(f.outputPath,"utf8"));
    expect(report.cases[0]).toMatchObject({ state: "reference_agreement", reference: { verification: "unreviewed", training_overlap: "unknown" }, candidates: [{ kind: "ocr", metrics: { strict: { distance: 1, cer: .2 }, without_layout_whitespace: { cer: .25 } } }] });
    expect(report.summary).toMatchObject({ cases: 1, canvases: 1, regions: 1, pending_reference: 0, source_collated: 0 });
    expect(report.groups[0]).toMatchObject({ kind: "ocr", verification: "unreviewed", training_overlap: "unknown", strict: { cer: .2 } });
    expect(await readFile(f.workspacePath)).toEqual(before);
  });
  it("keeps pending references distinct and counts two regions on one Canvas once", async () => {
    const f = await fixture(true); await f.evaluate(); const report = JSON.parse(await readFile(f.outputPath,"utf8"));
    expect(report.summary).toMatchObject({ cases: 2, canvases: 1, regions: 2, pending_reference: 1 });
    expect(report.cases[1]).toMatchObject({ state: "pending_reference", candidates: [{ metrics: null }] });
  });
  it.each(["reference_hash", "image_hash", "variant_hash", "ai_reference", "unattributed_review", "duplicate"])("rejects invalid comparisons: %s", async kind => {
    const f = await fixture(), c = f.evaluation.cases[0];
    if (kind === "reference_hash") c.reference.text += "字";
    if (["image_hash","variant_hash"].includes(kind)) c.variants.push({ variant_id:"ai-1",kind:"image_reading",scope:"full_region",text:"候補",text_sha256:digest("候補"),image_sha256:kind==="image_hash"?"0".repeat(64):f.imported.texts[0].ocr_provenance!.source.image_sha256,generator:"test",created_at:"2026-10-05T00:00:00Z",duration_ms:null });
    if (kind === "variant_hash") c.variants[0].text += "字";
    if (kind === "ai_reference") c.reference.origin = "image_reading";
    if (kind === "unattributed_review") c.reference.verification = "source_collated";
    if (kind === "duplicate") f.evaluation.cases.push(structuredClone(c));
    await writeFile(f.evaluationPath, JSON.stringify(f.evaluation)); await expect(f.evaluate()).rejects.toThrow();
    await expect(readFile(f.outputPath)).rejects.toThrow();
  });
  it("verifies raw OCR files again before calculating metrics", async () => {
    const f = await fixture(); await writeFile(path.join(f.raw,"input.txt"),"変更された原出力");
    await expect(f.evaluate()).rejects.toThrow(/hash/);
  });
  it("compares an image-assisted candidate without promoting it to a reference",async()=>{
    const f=await fixture(),c=f.evaluation.cases[0];
    c.variants.push({variant_id:"ai-1",kind:"image_assisted_correction",scope:"full_region",text:c.reference.text,text_sha256:c.reference.text_sha256,image_sha256:f.imported.texts[0].ocr_provenance!.source.image_sha256,generator:"synthetic-model",created_at:"2026-10-05T00:00:00Z",duration_ms:null});
    await writeFile(f.evaluationPath,JSON.stringify(f.evaluation));await f.evaluate();const report=JSON.parse(await readFile(f.outputPath,"utf8"));
    expect(report.cases[0].candidates[1].metrics.strict.distance).toBe(0);expect(report.summary.source_collated).toBe(0);expect(report.groups).toHaveLength(2);
  });
  it.each(["engine","duration","line_confidence"])("rejects workspace provenance that disagrees with the raw run: %s",async kind=>{
    const f=await fixture(),p=f.imported.texts[0].ocr_provenance!;
    if(kind==="engine")p.engine.engine_sha256="0".repeat(64);
    if(kind==="duration")p.duration_ms=42;
    if(kind==="line_confidence")p.lines[0].detection_confidence=.2;
    await writeFile(f.workspacePath,JSON.stringify(f.imported));await expect(f.evaluate()).rejects.toThrow(/provenance|原run/);
  });
  it.each(["original-evidence.json","input.png"])("protects the original evidence and image: %s",async file=>{
    const f=await fixture(),target=path.join(f.dir,file),before=await readFile(target);
    const {evaluateOcr}=await import("../src/iiif/ocrEvaluation.js");
    await expect(evaluateOcr(f.workspacePath,f.evaluationPath,target,true)).rejects.toThrow(/保存先/);
    expect(await readFile(target)).toEqual(before);
  });
  it.each(["workspace", "evaluation", "run"])("rejects report overwrite of inputs: %s", async kind => {
    const f = await fixture(), target = kind==="workspace"?f.workspacePath:kind==="evaluation"?f.evaluationPath:f.runPath, before=await readFile(target);
    const { evaluateOcr } = await import("../src/iiif/ocrEvaluation.js");
    await expect(evaluateOcr(f.workspacePath,f.evaluationPath,target,true)).rejects.toThrow(/保存先/);
    expect(await readFile(target)).toEqual(before);
  });
  it("exposes local evaluation through the JSON CLI", async () => {
    const f = await fixture(), request=path.join(f.dir,"request.json"), output:string[]=[];
    await writeFile(request,JSON.stringify({api_version:"0.1",operation:"evaluate_ocr",workspace_path:f.workspacePath,evaluation_path:f.evaluationPath,output_path:f.outputPath}));
    expect(await runIiifCli(["--request",request],{cwd:f.dir,stdout:s=>output.push(s),stderr:()=>{}})).toBe(0);
    expect(JSON.parse(output[0])).toMatchObject({ok:true,result:{report_path:f.outputPath,cases:1,canvases:1}});
  });
});
