import {assertComparisonSource,recordComparisonReview} from "./image-comparison-state.mjs";
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const modes={overlay:"重ね合わせ",query:"基準画像",aligned:"整列画像",raw_difference:"原濃淡の差",difference:"濃淡調整後の差"};
const heldReasons={insufficient_features:"画像の特徴が少ない",insufficient_matches:"対応する特徴が少ない",transform_unavailable:"位置合わせを求められない",weak_or_local_correspondence:"対応が弱い、または小部分に偏っている",insufficient_overlap:"共通して比較できる範囲が狭い"};
export function createImageComparisonPanel({element,workspace,setWorkspace,status,compare,importReport,preview,openImage,assertEditable=()=>{}}){
 let busy=false,epoch=0,reportId=null,regionId=null,page=0;
 const draft={paths:"",query:"",output:"",report:""},reviews=new Map();
 const attempt=fn=>{try{assertEditable();fn();}catch(e){status(e.message);}};
 const sourceError=s=>{try{assertComparisonSource(workspace(),s);return "";}catch(e){return e.message;}};
 function field(parent,label,tag,value,oninput,placeholder=""){
  const wrap=node("label",label),control=node(tag);control.value=value;control.placeholder=placeholder;control.oninput=()=>oninput(control.value);wrap.append(control);parent.append(wrap);return control;
 }
 async function execute(fn){
  try{assertEditable();busy=true;render();const record=await fn();reportId=record.report.report_id;page=0;status("図版の比較候補を保存しました。原領域へ戻って対応を確認できます。");}
  catch(e){status(e.message);}finally{busy=false;render();}
 }
 function render(){
  const w=workspace();if(!w)return;const generation=++epoch;
  element.replaceChildren(node("h2","図版を探して比較する"),node("p","保存した領域画像の形から対応候補を探します。紙色・照明・解像度の差も含むため、図版の対応と相違は原画像で確認します。"));
  const setup=node("details");setup.append(node("summary","保存した画像から検索する"));setup.open=!(w.image_comparisons?.length);
  const paths=field(setup,"画像の出典JSON（1行1件）","textarea",draft.paths,v=>{draft.paths=v;},"保存した読解資料のevidence.jsonの絶対path");paths.rows=3;
  const select=field(setup,"基準にする領域","select",draft.query,v=>{draft.query=v;});
  for(const r of w.regions){const option=node("option",`${r.selection_reason||"領域"} · ${r.selection.region_id}`);option.value=r.selection.region_id;select.append(option);}
  if(!w.regions.some(r=>r.selection.region_id===draft.query))draft.query=w.regions[0]?.selection.region_id??"";select.value=draft.query;select.onchange=()=>{draft.query=select.value;};
  field(setup,"結果を保存する新しいdirectory","input",draft.output,v=>{draft.output=v;},"ResearchLibraryのproject配下の新しい保存先");
  setup.append(node("p","「画像と出典を保存」で取得・利用条件を確認して保存した画像を使います。他の登録済み領域を最大20件比較します。解析はローカルで行います。"));
  const run=node("button",busy?"図版を解析中…":"似た図版を探す");run.className="primary";run.disabled=busy||w.regions.length<2;
  run.onclick=()=>execute(()=>compare({evidence_paths:draft.paths.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),query_region_id:draft.query,output_dir:draft.output}));setup.append(run);
  const load=node("details");load.append(node("summary","保存済みの比較結果を取り込む"));field(load,"比較結果のJSON","input",draft.report,v=>{draft.report=v;},"保存済みreport.jsonの絶対path");
  const importButton=node("button","比較結果を取り込む");importButton.disabled=busy;importButton.onclick=()=>execute(()=>importReport(draft.report));load.append(importButton);setup.append(load);element.append(setup);
  const records=(w.image_comparisons??[]).filter(r=>!regionId||r.report.query.input.source.selection.region_id===regionId||r.report.candidates.some(c=>c.id===regionId));
  if(!records.length){element.append(node("p","比較候補は検索後に表示します。出典と原画像を保持したまま確認できます。"));return;}
  if(!records.some(r=>r.report.report_id===reportId))reportId=records.at(-1).report.report_id;
  const recordSelect=field(element,"保存した比較","select",reportId,v=>{reportId=v;page=0;render();});
  for(const record of records){const o=node("option",`${record.report.query.input.attribution.label} · ${record.report.created_at} · ${record.report.candidates.length}候補`);o.value=record.report.report_id;recordSelect.append(o);}recordSelect.value=reportId;recordSelect.onchange=()=>{reportId=recordSelect.value;page=0;render();};
  const record=records.find(r=>r.report.report_id===reportId),report=record.report;
  const candidates=report.candidates.filter(c=>!regionId||regionId===report.query.input.source.selection.region_id||c.id===regionId);
  page=Math.min(page,Math.max(0,Math.ceil(candidates.length/5)-1));
  const all=node("button","すべての図版候補"),prev=node("button","前の図版候補"),next=node("button","次の図版候補");all.onclick=()=>{regionId=null;page=0;render();};prev.disabled=page===0;next.disabled=(page+1)*5>=candidates.length;
  prev.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};element.append(all,prev,next);
  for(const candidate of candidates.slice(page*5,(page+1)*5)){
   const card=node("article");card.className="text-card image-comparison-card";
   const latest=record.reviews.filter(v=>v.candidate_id===candidate.id).at(-1);
   card.append(node("h3",`${candidate.rank}. ${candidate.input.attribution.label} · ${candidate.id}`),node("p",candidate.status==="aligned"?"位置合わせ候補":"位置合わせ保留"));
   card.append(node("p",latest?`最新の図版確認: ${{match:"対応を確認",mismatch:"対応しない",uncertain:"判断保留"}[latest.result]} · ${latest.author} · ${latest.recorded_at}`:"図版対応の確認待ち"));
   card.append(node("p",candidate.method==="encoded_identity"?"同一の保存画像から比較しています。":`対応点 ${candidate.inliers}/${candidate.matches} · 比較範囲 ${Math.round(candidate.overlap*100)}% · 形のhash差 ${candidate.dhash_distance}/64`));
   const queryError=sourceError(report.query.input.source),candidateError=sourceError(candidate.input.source),error=queryError||candidateError;
   const first=node("button","基準の原領域へ"),second=node("button","候補の原領域へ");first.disabled=!!queryError;second.disabled=!!candidateError;
   first.onclick=()=>attempt(()=>openImage(report.query.input.source));second.onclick=()=>attempt(()=>openImage(candidate.input.source));card.append(first,second);
   if(error)card.append(node("p",`保存時の対応を履歴として保持します。${error}`));
   if(candidate.status==="aligned"){
    const mode=field(card,"比較画像","select","overlay",()=>{});for(const [value,label] of Object.entries(modes)){const o=node("option",label);o.value=value;mode.append(o);}mode.value="overlay";
    const image=node("img");image.alt="基準画像の座標に合わせた図版の比較";image.hidden=true;
    const show=node("button","比較画像を表示");show.onclick=async()=>{show.disabled=true;try{const url=await preview(report.report_id,candidate.id,mode.value);if(epoch===generation){image.src=url;image.hidden=false;}}
     catch(e){status(e.message);}finally{show.disabled=false;}};
    card.append(show,image,node("p","調整差の赤は濃淡の差、灰は比較範囲外です。長辺1024px以下で比較し、原差と調整差を切り替えて撮影条件の影響を確認できます。"),
     node("p",`差のある画素 ${((candidate.changed_fraction??0)*100).toFixed(2)}% · 原濃淡差 ${(candidate.raw_mean_difference??0).toFixed(2)} / 調整差 ${(candidate.normalized_mean_difference??0).toFixed(2)}`));
   }else card.append(node("p",`保留理由: ${candidate.diagnostics.map(d=>heldReasons[d]??d).join(" / ")}`));
   const key=`${record.report_sha256}:${candidate.id}`,d=reviews.get(key)??{author:"",note:"",result:"uncertain"};reviews.set(key,d);
   const detail=node("details");detail.append(node("summary",`図版対応の確認 ${record.reviews.filter(v=>v.candidate_id===candidate.id).length}件と出典`));
   const author=field(detail,"確認者","input",d.author,v=>{d.author=v;},"図版対応を確認した人");author.maxLength=1024;
   const outcome=field(detail,"図版の対応","select",d.result,v=>{d.result=v;});for(const [value,label] of [["uncertain","判断保留"],["match","対応を確認"],["mismatch","対応しない"]]){const o=node("option",label);o.value=value;outcome.append(o);}outcome.value=d.result;outcome.onchange=()=>{d.result=outcome.value;};
   const note=field(detail,"確認内容","textarea",d.note,v=>{d.note=v;},"画像で確認した対応・相違・保留理由");note.rows=2;note.maxLength=20000;
   const save=node("button","図版の対応確認を記録");save.disabled=!!error||busy;save.onclick=()=>attempt(()=>{setWorkspace(recordComparisonReview(workspace(),report.report_id,candidate.id,d));reviews.delete(key);render();status("図版対応の確認を追加しました。作業を保存してください。本文校合は別に保持します。");});
   detail.append(save,node("pre",JSON.stringify({report_path:record.report_path,report_sha256:record.report_sha256,algorithm:report.algorithm,settings:report.settings,engine:report.engine,
    transform_direction:report.transform_direction,matrix:candidate.matrix,candidate_image_to_query_image:candidate.candidate_image_to_query_image,query:report.query.input,candidate:candidate.input,reviews:record.reviews.filter(v=>v.candidate_id===candidate.id)},null,2)));card.append(detail);element.append(card);
  }
 }
 return {render,showRegion(region){regionId=region.selection.region_id;draft.query=regionId;page=0;render();element.scrollIntoView({block:"start",behavior:"smooth"});}};
}
