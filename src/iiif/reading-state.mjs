import { assertOcrTarget } from "./ocr-state.mjs";

export function assertReadingTarget(workspace,text) {
  const p=text.reading_provenance;
  if(!p||text.origin!=="ai_candidate"||text.verification_state!=="unverified")throw new Error("AI読解候補の出典を確認してください");
  return assertOcrTarget(workspace,{...text,origin:"ocr_candidate",ocr_provenance:{source:p.source}});
}
export function readingMatchesRegion(workspace,text,regionId) {
  try{return assertReadingTarget(workspace,text).region.selection.region_id===regionId;}catch{return false;}
}
export function recordReadingReview(workspace,textId,input) {
  const w=structuredClone(workspace),text=w.texts.find(t=>t.text_id===textId);
  assertReadingTarget(w,text);
  const p=text.reading_provenance;
  if(!["human","ai"].includes(input.reviewer_type)||!["match","mismatch","uncertain"].includes(input.result)||
      typeof input.author!=="string"||!input.author.trim()||typeof input.note!=="string"||!input.note.trim()||
      input.note.length>20000||input.author.trim().length>1024||p.reviews.length>=100||
      (input.corrected_text!==null&&(typeof input.corrected_text!=="string"||input.corrected_text.length>2*1024*1024)))
    throw new Error("確認者・確認種別・結果・注記を入力してください");
  p.reviews.push({...input,author:input.author.trim(),note:input.note.trim(),recorded_at:new Date().toISOString(),image_sha256:p.source.image_sha256});
  return w;
}
