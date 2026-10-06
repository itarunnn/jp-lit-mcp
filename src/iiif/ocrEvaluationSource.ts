import path from "node:path";
import { importOcr } from "./ocrImport.js";
import { importManualOcr } from "./manualOcr.js";
import { ocrRunSchema } from "./ocrSchemas.js";
import { ocrDigest, readOcrFile } from "./ocrRunner.js";
import { assertDistinctOutput } from "./outputProtection.js";
import type { IiifWorkspace, TextEvidence } from "./types.js";
// @ts-expect-error Nodeとブラウザで共有する対応検査
import { assertOcrTarget } from "./ocr-state.mjs";
import { assertManualOcrTarget } from "./manual-ocr-state.mjs";

export async function resolveOcrEvaluationSource(workspace: IiifWorkspace, text: TextEvidence, outputPath: string, verifiedRuns: Map<string, IiifWorkspace>) {
  const manual = text.manual_ocr_provenance;
  if (manual) {
    assertManualOcrTarget(workspace, text);
    const { canvas_width: _width, canvas_height: _height, ...source } = manual.source;
    const original = importManualOcr(workspace, { provider: manual.provider, source, text: text.text,
      author: manual.author, result_url: manual.result_url, scope_confirmed: true }).text;
    if (original.text_id !== text.text_id) throw new Error("手動OCR候補のID・本文・出典が一致しません");
    return { source: { ...manual.source, evidence_id: manual.source.selection.region_id, image_sha256: null },
      run_path: null, run_sha256: null, engine: null, provider: manual.provider, engine_sha256: null,
      created_at: manual.recorded_at, duration_ms: null, image_identity: "service_bytes_unknown",
      provenance_validation: "manual_copy_consistency", manual_ocr_provenance: manual };
  }
  const p = text.ocr_provenance;
  if (!p) throw new Error("評価対象の原OCR候補がありません");
  assertOcrTarget(workspace, text);
  await assertDistinctOutput(outputPath, [path.dirname(p.run_path)]);
  const bytes = await readOcrFile(p.run_path, 32 * 1024 * 1024);
  if (ocrDigest(bytes) !== p.run_sha256) throw new Error("評価対象の原run hashが一致しません");
  const run = ocrRunSchema.parse(JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")));
  const item = run.items.find(item => item.source.evidence_id === p.source.evidence_id);
  if (!item || JSON.stringify([run.run_id, run.engine, run.evidence_sha256, item.source, item.lines, item.started_at, item.finished_at, item.duration_ms]) !==
    JSON.stringify([p.run_id, p.engine, p.evidence_sha256, p.source, p.lines, p.started_at, p.finished_at, p.duration_ms]))
    throw new Error("OCR provenanceと原runが一致しません");
  if (!verifiedRuns.has(p.run_path)) verifiedRuns.set(p.run_path, (await importOcr(workspace, p.run_path)).workspace);
  const originalId = `ocr-${ocrDigest(`${run.run_id}:${item.source.evidence_id}`).slice(0, 24)}`;
  const original = verifiedRuns.get(p.run_path)!.texts.find(t => t.text_id === originalId);
  if (!original || text.text_id !== originalId || text.text !== original.text || text.source_sha256 !== original.source_sha256)
    throw new Error("評価対象の候補ID・本文・本文hashが原OCRと一致しません");
  return { source: p.source, run_path: p.run_path, run_sha256: p.run_sha256, engine: p.engine,
    provider: p.engine.provider, engine_sha256: p.engine.engine_sha256, created_at: p.finished_at,
    duration_ms: p.duration_ms, image_identity: "verified_local_bytes", provenance_validation: "raw_run_verified", manual_ocr_provenance: null };
}
