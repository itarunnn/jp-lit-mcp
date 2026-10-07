import { assertReadingTarget,recordReadingReview } from "./reading-state.mjs";
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const kinds={image_reading:"画像のみの読解",image_assisted_correction:"画像とOCRを併用した修訂"};
export function createReadingPanel({element,workspace,setWorkspace,status,openImage}) {
  const drafts=new Map();let page=0,regionId=null;
  const attempt=fn=>{try{fn();}catch(e){status(e.message);}};
  function render() {
    const w=workspace();if(!w)return;
    const candidates=w.texts.filter(t=>t.reading_provenance&&(!regionId||t.reading_provenance.source.selection.region_id===regionId));
    page=Math.min(page,Math.max(0,Math.ceil(candidates.length/20)-1));
    element.replaceChildren(node("h2",`AI読解と原画像の確認 · ${candidates.length}件`),node("p","翻刻候補と疑義を表示します。原画像での確認は別に記録し、元の本文を保持します。"));
    const all=node("button","すべてのAI候補"),prev=node("button","前の候補"),next=node("button","次の候補");
    all.onclick=()=>{regionId=null;page=0;render();};prev.disabled=page===0;next.disabled=(page+1)*20>=candidates.length;
    prev.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};element.append(all,prev,next);
    if(!candidates.length)element.append(node("p","読解用の画像と依頼文をAIアプリで開き、応答を取り込んだ作業JSONを読み込むと候補を表示できます。"));
    for(const t of candidates.slice(page*20,(page+1)*20)) {
      const p=t.reading_provenance,r=p.response,key=`${w.workspace_id}:${t.text_id}:${p.response_sha256}`;
      let error="";try{assertReadingTarget(w,t);}catch(e){error=e.message;}
      const draft=drafts.get(key)??{author:"",reviewer_type:"human",result:"uncertain",note:"",corrected_text:"",open:false};drafts.set(key,draft);
      const article=node("article"),source=node("p",`${kinds[p.kind]} / ${r.scope==="full_region"?"全領域との申告":"部分読解"} / 未校合`);
      article.className="text-card";article.append(source,node("p",`${r.generator} · 領域 ${p.source.selection.region_id}`),node("pre",t.text));
      for(const doubt of r.doubts)article.append(node("p",`疑義「${doubt.quote}」 · 候補: ${doubt.alternatives.join(" / ")||"保留"} · ${doubt.note}`));
      const image=node("button","原画像の領域へ");image.disabled=!!error;image.onclick=()=>attempt(()=>openImage(t));article.append(image);
      if(error)article.append(node("p",`保存時の領域を履歴として保持しています。${error}`));
      const details=node("details"),summary=node("summary",`原画像の確認 ${p.reviews.length}件と出典`);details.open=draft.open;details.ontoggle=()=>{draft.open=details.open;};details.append(summary);
      function field(label,tag,property,placeholder="") {
        const wrap=node("label",label),control=node(tag);control.value=draft[property];control.placeholder=placeholder;
        control.oninput=()=>{draft[property]=control.value;};wrap.append(control);details.append(wrap);return control;
      }
      const author=field("確認者","input","author","確認の記録者");author.maxLength=1024;
      const type=field("確認種別","select","reviewer_type");for(const [value,label] of [["human","人による確認"],["ai","AIによる確認"]]){const o=node("option",label);o.value=value;type.append(o);}type.value=draft.reviewer_type;type.onchange=()=>{draft.reviewer_type=type.value;};
      const result=field("結果","select","result");for(const [value,label] of [["uncertain","判断保留"],["match","一致を確認"],["mismatch","相違あり"]]){const o=node("option",label);o.value=value;result.append(o);}result.value=draft.result;result.onchange=()=>{draft.result=result.value;};
      const note=field("確認内容","textarea","note","画像で確認した内容");note.rows=2;note.maxLength=20000;
      const corrected=field("修訂候補（任意）","textarea","corrected_text");corrected.rows=3;corrected.maxLength=2*1024*1024;
      const record=node("button","原画像との確認を記録");record.disabled=!!error;record.onclick=()=>attempt(()=>{
        setWorkspace(recordReadingReview(workspace(),t.text_id,{author:draft.author,reviewer_type:draft.reviewer_type,result:draft.result,note:draft.note,corrected_text:draft.corrected_text||null}));
        drafts.delete(key);render();status("原画像の確認を追加しました。作業を保存してください。");
      });
      details.append(record,node("pre",JSON.stringify({image_viewing:"self_declared",model_version:r.model_version,executed_at:r.executed_at,duration_ms:r.duration_ms,monetary_cost:r.monetary_cost,
        source:p.source,task_path:p.task_path,task_sha256:p.task_sha256,response_path:p.response_path,response_sha256:p.response_sha256,reviews:p.reviews},null,2)));
      article.append(details);element.append(article);
    }
  }
  return {render,showRegion(region){regionId=region.selection.region_id;page=0;render();element.scrollIntoView({block:"start",behavior:"smooth"});}};
}
