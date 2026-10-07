// 図版対応の候補・確認と本文校合を別々に保つ。両側の元領域へ戻る。
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function assertComparisonSource(workspace,source){
 const region=workspace.regions.find(r=>r.selection.region_id===source.selection.region_id);
 const win=workspace.windows.find(w=>w.window_id===region?.selection.window_id);
 const doc=workspace.documents.find(d=>d.document_id===win?.document_id),canvas=doc?.canvases.find(c=>c.canvas_id===region?.selection.canvas_id);
 if(source.workspace_id!==workspace.workspace_id||!region||doc?.document_id!==source.document_id||doc.receipt.sha256!==source.manifest_sha256||
  !canvas||canvas.width!==source.canvas_width||canvas.height!==source.canvas_height||!same(region.selection,source.selection))throw Error("図版候補の出典と現在の領域が一致しません");
 return {region,doc,canvas};
}
export function mergeComparison(workspace,record,{allow_stale=false}={}){
 const sources=[record.report.query.input.source,...record.report.candidates.map(c=>c.input.source)];
 for(const source of sources){
  if(source.workspace_id!==workspace.workspace_id)throw Error("図版比較のworkspace出典が一致しません");
  if(!allow_stale)assertComparisonSource(workspace,source);
 }
 const w=structuredClone(workspace),existing=w.image_comparisons?.find(r=>r.report.report_id===record.report.report_id);
 if(existing){if(!same({...existing,reviews:[]},{...record,reviews:[]}))throw Error("同じ比較IDに異なる原snapshotがあります");}
 else {w.image_comparisons??=[];if(w.image_comparisons.length>=20)throw Error("比較履歴の上限です");w.image_comparisons.push(structuredClone(record));}
 return w;
}
export function recordComparisonReview(workspace,reportId,candidateId,{author,result,note}){
 const w=structuredClone(workspace),record=w.image_comparisons?.find(r=>r.report.report_id===reportId),candidate=record?.report.candidates.find(c=>c.id===candidateId);
 if(!record||!candidate)throw Error("図版候補がありません");assertComparisonSource(w,record.report.query.input.source);assertComparisonSource(w,candidate.input.source);
 if(!author?.trim()||author.trim().length>1024||!note?.trim()||note.trim().length>20000||!["match","mismatch","uncertain"].includes(result))throw Error("記録者・図版対応の結果・確認内容を入力してください");
 if(record.reviews.length>=100)throw Error("図版確認の上限です");
 record.reviews.push({candidate_id:candidateId,recorded_at:new Date().toISOString(),author:author.trim(),result,note:note.trim(),
  query_image_sha256:record.report.query.input.source.image_sha256,candidate_image_sha256:candidate.input.source.image_sha256});
 return w;
}
export function comparisonsForRegion(workspace,region){
 const results=[];
 for(const record of workspace.image_comparisons??[]){
  try{assertComparisonSource(workspace,record.report.query.input.source);}catch{continue;}
  const matches=record.report.candidates.filter(c=>{
   try{assertComparisonSource(workspace,c.input.source);}catch{return false;}
   return region.selection.region_id===record.report.query.input.source.selection.region_id||region.selection.region_id===c.id;
  });
  if(matches.length)results.push({report_id:record.report.report_id,report_path:record.report_path,report_sha256:record.report_sha256,algorithm:record.report.algorithm,
   engine:record.report.engine,settings:record.report.settings,query:record.report.query,matches,reviews:record.reviews.filter(v=>matches.some(c=>c.id===v.candidate_id)),verification_state:"figure_candidate"});
 }
 return results;
}
