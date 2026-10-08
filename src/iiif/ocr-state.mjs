// OCR原文と人による校合・修訂候補を別々に保持する。
export function assertOcrTarget(workspace, text) {
  const p = text.ocr_provenance, s = p?.source;
  if (!s || text.origin !== "ocr_candidate" || text.verification_state !== "unverified") throw new Error("OCR候補を指定してください");
  const doc = workspace.documents.find((d) => d.document_id === s.document_id);
  const canvas = doc?.canvases.find((c) => c.canvas_id === s.selection.canvas_id);
  const region = workspace.regions.find((r) => r.selection.region_id === s.selection.region_id);
  const window = workspace.windows.find((w) => w.window_id === region?.selection.window_id);
  if (workspace.workspace_id !== s.workspace_id || doc?.receipt.sha256 !== s.manifest_sha256 ||
      !canvas || canvas.width !== s.canvas_width || canvas.height !== s.canvas_height || text.canvas_id !== canvas.canvas_id ||
      !region || window?.document_id !== doc.document_id || JSON.stringify(region.selection) !== JSON.stringify(s.selection) ||
      JSON.stringify(text.target_xywh) !== JSON.stringify(s.selection.xywh)) throw new Error("OCR出典と現在の領域・資料が一致しません");
  return { source: s, region, doc, canvas };
}
export function recordOcrReview(workspace, textId, author, result, note, correctedText = null) {
  const text = workspace.texts.find((t) => t.text_id === textId);
  if (!text) throw new Error("OCR候補が見つかりません");
  const { source } = assertOcrTarget(workspace, text);
  if (typeof author !== "string" || !author.trim() || author.trim().length > 1024 ||
      typeof note !== "string" || !note.trim() || note.trim().length > 20000 || !["match", "mismatch", "uncertain"].includes(result) ||
      (correctedText !== null && (typeof correctedText !== "string" || correctedText.length > 2*1024*1024)))
    throw new Error("校合の記録者・結果・確認内容を入力してください");
  if (text.ocr_provenance.reviews.length >= 100) throw new Error("OCR校合記録数が上限を超えます");
  text.ocr_provenance.reviews.push({ recorded_at: new Date().toISOString(), author: author.trim(), result, note: note.trim(),
    corrected_text: correctedText, image_sha256: source.image_sha256 });
}
