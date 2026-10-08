import path from "node:path";
import { ocrRunSchema, ocrAbsoluteSchema } from "./ocrSchemas.js";
import { normalizeProviderOutput, validateOcrSource } from "./ocr.js";
import { validateGpuCounts } from "./ocrGpu.js";
import { ocrDigest, readOcrFile, resolveOcrArtifact, ocrEvidenceSchema, ocrSourceFromEvidenceItem } from "./ocrRunner.js";
import { imageDimensions } from "./imageMetadata.js";
import { validateWorkspace } from "./schemas.js";
// @ts-expect-error Nodeとブラウザが共有する判定
import { assertOcrTarget } from "./ocr-state.mjs";
import type { IiifWorkspace, TextEvidence } from "./types.js";

export async function importOcr(workspace: IiifWorkspace, runPath: string) {
  ocrAbsoluteSchema.parse(runPath);
  const bytes = await readOcrFile(runPath,32*1024*1024), run = ocrRunSchema.parse(JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/,"")));
  if(run.status==="running")throw new Error("OCRは処理途中です。完了と全対象の記録を確認してください");
  if(run.requested_evidence_ids && JSON.stringify(run.requested_evidence_ids)!==JSON.stringify(run.items.map((i)=>i.source.evidence_id)))
    throw new Error("OCR要求の全対象が記録されていません");
  const root = path.dirname(runPath), evidencePath = await resolveOcrArtifact(root,"evidence.json");
  const evidenceBytes=await readOcrFile(evidencePath);
  if (ocrDigest(evidenceBytes) !== run.evidence_sha256) throw new Error("OCR evidenceのhashが一致しません");
  const evidence=ocrEvidenceSchema.parse(JSON.parse(evidenceBytes.toString("utf8").replace(/^\uFEFF/,"")));
  const evidenceIds=evidence.items.map((i)=>(i as {evidence_id?:string}).evidence_id);
  if(new Set(evidenceIds).size!==evidenceIds.length)throw new Error("OCR evidence領域IDの重複があります");
  if (new Set(run.items.map((i) => i.source.evidence_id)).size !== run.items.length) throw new Error("OCR領域IDの重複があります");
  const w = structuredClone(validateWorkspace(workspace)), runHash=ocrDigest(bytes);
  let imported=0, skipped=0;
  for (const item of run.items) {
    if (item.status === "failed") { skipped++; continue; }
    const source = validateOcrSource(item.source);
    const evidenceIndex=evidenceIds.indexOf(source.evidence_id);
    if(evidenceIndex<0 || JSON.stringify(ocrSourceFromEvidenceItem(evidence.items[evidenceIndex],evidence.workspace_id))!==JSON.stringify(source))
      throw new Error("OCR evidenceの内容とrun出典が一致しません");
    if (item.text === null) throw new Error("OCR正常出力の本文がありません");
    if (new Set(item.artifacts.map((a)=>a.path)).size !== item.artifacts.length) throw new Error("OCR artifactの重複があります");
    const artifacts:Array<{path:string;sha256:string;bytes:Buffer}>=[];
    for (const artifact of item.artifacts) {
      const file=await resolveOcrArtifact(root,artifact.path), raw=await readOcrFile(file);
      if (ocrDigest(raw)!==artifact.sha256) throw new Error("OCR原出力・画像のhashが一致しません");
      artifacts.push({...artifact,path:file,bytes:raw});
    }
    const one = (extension:string) => {
      const matches=artifacts.filter((a)=>a.path.endsWith(extension) && !["gpu-validation.json","opt.json"].includes(path.basename(a.path)));
      if (matches.length !== 1) throw new Error(`OCR原出力を確認してください: ${extension}`);
      return matches[0];
    };
    const txt=one(".txt"), json=one(".json"), image=artifacts.filter((a)=>/\.(jpg|png)$/i.test(a.path));
    if(image.length!==1 || image[0].sha256!==source.image_sha256)throw new Error("OCR入力画像が一致しません");
    const dim=imageDimensions(image[0].bytes);
    if(dim.width!==source.image_width || dim.height!==source.image_height)throw new Error("OCR入力画像寸法が一致しません");
    const raw=JSON.parse(json.bytes.toString("utf8")), text=txt.bytes.toString("utf8");
    const lines=normalizeProviderOutput(run.engine.provider,raw,text,source);
    if(run.engine.provider==="ndlkotenocr-ver3") {
      if(raw.imginfo?.img_name!==path.basename(image[0].path))throw new Error("GPU OCRの出力画像名が一致しません");
      const validation=artifacts.filter(a=>path.basename(a.path)==="gpu-validation.json");
      if(validation.length!==1)throw new Error("GPU原検証fileを確認してください");
      await validateGpuCounts(path.dirname(validation[0].path),lines.length);
    }
    if(text!==item.text || JSON.stringify(lines)!==JSON.stringify(item.lines))throw new Error("OCR候補と原出力の本文・行座標が一致しません");
    const textId=`ocr-${ocrDigest(`${run.run_id}:${source.evidence_id}`).slice(0,24)}`;
    const t:TextEvidence={text_id:textId,canvas_id:source.selection.canvas_id,target_xywh:source.selection.xywh,
      source_ref:`${runPath}#${source.evidence_id}`,source_sha256:txt.sha256,text,origin:"ocr_candidate",verification_state:"unverified",
      ocr_provenance:{run_id:run.run_id,run_path:runPath,run_sha256:runHash,evidence_path:evidencePath,evidence_sha256:run.evidence_sha256,
        engine:run.engine,source,started_at:item.started_at,finished_at:item.finished_at,duration_ms:item.duration_ms,
        artifacts:artifacts.map(({path,sha256})=>({path,sha256})),lines,diagnostics:item.diagnostics,reviews:[]}};
    const {region}=assertOcrTarget(w,t);
    const existing=w.texts.find((x)=>x.text_id===textId);
    if (existing) {
      if(existing.ocr_provenance?.run_sha256!==runHash || existing.source_sha256!==t.source_sha256 || existing.text!==text)
        throw new Error("同じOCR候補IDに異なる記録があります");
    } else { w.texts.push(t); imported++; }
    if(!region.text_evidence_ids.includes(textId))region.text_evidence_ids.push(textId);
  }
  if(skipped===run.items.length)throw new Error("importできる正常なOCR出力がありません。保存したrunを確認してください");
  return {workspace:validateWorkspace(w),imported,skipped};
}
