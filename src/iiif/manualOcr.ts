import { createHash } from "node:crypto";
import { manualOcrInputSchema } from "./manualOcrSchemas.js";
import { manualOcrSource } from "./manual-ocr-state.mjs";
import { validateWorkspace } from "./schemas.js";
import type { IiifWorkspace } from "./types.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function importManualOcr(workspace: IiifWorkspace, input: unknown) {
  const w = validateWorkspace(structuredClone(workspace)), request = manualOcrInputSchema.parse(input);
  const { region, doc, canvas, source } = manualOcrSource(w, request.source.selection.region_id);
  if (request.source.workspace_id !== w.workspace_id || request.source.document_id !== doc.document_id ||
      request.source.manifest_sha256 !== doc.receipt.sha256 || JSON.stringify(request.source.selection) !== JSON.stringify(region.selection))
    throw new Error("手動OCRの対象が変更されています。資料と領域を確認してください");
  const source_sha256 = hash(request.text), source_ref = request.result_url ?? "https://mp.ex.nii.ac.jp/kuronet/";
  const text_id = `manual-ocr-${hash(JSON.stringify([source, source_sha256, request.author, source_ref]))}`;
  const text = {
    text_id, canvas_id: canvas.canvas_id, target_xywh: [...region.selection.xywh], source_ref, source_sha256,
    text: request.text, origin: "ocr_candidate", verification_state: "unverified",
    manual_ocr_provenance: { provider: "kuronet", acquisition: "manual_copy", recorded_at: new Date().toISOString(),
      author: request.author, result_url: request.result_url, scope_verification: "user_declared", model_version: null,
      source_image_sha256: null, source },
  };
  const previous = w.texts.find((t) => t.text_id === text_id);
  if (previous) {
    const canonical = (value: typeof previous | typeof text) => JSON.stringify({ ...value, manual_ocr_provenance: value.manual_ocr_provenance ? { ...value.manual_ocr_provenance, recorded_at: null } : null });
    if (canonical(previous) !== canonical(text)) throw new Error("同じ手動OCR候補IDに異なる記録があります");
    if (!region.text_evidence_ids.includes(text_id)) region.text_evidence_ids.push(text_id);
    return { workspace: validateWorkspace(w), text: previous, imported: false };
  }
  w.texts.push(text as IiifWorkspace["texts"][number]);
  region.text_evidence_ids.push(text_id);
  const next = validateWorkspace(w);
  return { workspace: next, text: next.texts.find((t) => t.text_id === text_id)!, imported: true };
}
