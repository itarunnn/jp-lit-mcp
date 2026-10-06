import { manualOcrSource, assertManualOcrTarget, KURONET_VIEWER_URL, KURONET_GUIDE_URL } from './manual-ocr-state.mjs';

export function createManualOcrPanel({ element, workspace, importCandidate, openImage, status }) {
  const node = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
  const field = (caption, input) => { const label = node('label', caption); label.append(input); return label; };
  const body = node('textarea'); body.rows = 6; body.maxLength = 2*1024*1024; body.placeholder = 'KuroNetで取り出した本文';
  const author = node('input'); author.placeholder = '取込の記録者'; author.maxLength = 1024;
  const resultUrl = node('input'); resultUrl.placeholder = '結果URL（任意）'; resultUrl.maxLength = 4096;
  const confirm = node('input'); confirm.type = 'checkbox'; confirm.value = 'confirm-scope';
  const select = node('select'); select.setAttribute('aria-label', '補助OCRの対象領域');
  const manifest = node('input'); manifest.readOnly = true; manifest.setAttribute('aria-label', 'KuroNetへ手動入力するマニフェストURL');
  const context = node('pre'), list = node('div'), save = node('button','OCR候補を保存');
  const help = node('details'); help.append(node('summary','KuroNetによる補助OCR'));
  const viewer = node('a','KuroNetを開く'); viewer.href = KURONET_VIEWER_URL; viewer.target = '_blank'; viewer.rel = 'noopener noreferrer';
  const guide = node('a','公式の利用案内'); guide.href = KURONET_GUIDE_URL; guide.target = '_blank'; guide.rel = 'noopener noreferrer';
  help.append(node('p','公開IIIF資料をPCで処理します。KuroNetではログイン後にOCRとテキスト変換を行い、下の対象と同じ範囲の本文を貼り付けてください。OCR結果はサービス上で公開されます。'), viewer, guide,
    field('対象領域',select),field('マニフェストURL（コピーして入力）',manifest),context,
    field('OCRの原出力',body),field('記録者',author),field('出典URL',resultUrl),
    field('本文がこのページ・領域に対応することを確認した',confirm),
    node('p','対応範囲の確認と文字の校合は別に記録します。貼り付けた本文を未校合のOCR候補として保存します。'),save);
  element.replaceChildren(help,list);
  let regionId = null, sourceKey = null, busy = false;
  function render() {
    const w=workspace();select.replaceChildren();
    const empty=node('option','領域を選んでください');empty.value='';select.append(empty);
    for(const r of w.regions){const o=node('option',`${r.selection.region_id} · ${r.selection.xywh.join(', ')}`);o.value=r.selection.region_id;select.append(o);}
    select.value=w.regions.some(r=>r.selection.region_id===regionId)?regionId:'';
    let target=null;try{target=manualOcrSource(w,select.value);}catch{}
    const nextKey=target?JSON.stringify(target.source):null;
    if(nextKey!==sourceKey){confirm.checked=false;sourceKey=nextKey;}
    manifest.value=target?.doc.receipt.requested_url??'';
    context.textContent=target?`ページ ${target.canvas.canvas_index_1based} / Canvas ${target.canvas.canvas_id}\n領域 ${target.region.selection.xywh.join(', ')} / 回転 ${target.region.selection.rotation_degrees}°`: '対象の領域をコレクションに追加してください。';
    save.disabled=busy||!target;list.replaceChildren();
    const candidates=w.texts.filter(t=>t.manual_ocr_provenance);
    list.append(node('h3',`手動取込のOCR候補 ${candidates.length}件`));
    for(const t of candidates){
      const article=node('article');article.className='tei-link';article.dataset.textId=t.text_id;
      article.append(node('p',`KuroNet · 未校合 · ${t.manual_ocr_provenance.source.selection.region_id}`),node('pre',t.text));
      const go=node('button','原画像の領域へ');let error=null;try{assertManualOcrTarget(w,t);}catch(e){error=e.message;}
      go.disabled=!!error;go.onclick=()=>{try{assertManualOcrTarget(workspace(),t);openImage(t);}catch(e){status(e.message);}};
      article.append(go);if(error)article.append(node('p',error));
      const provenance=node('details');provenance.append(node('summary','出典と取込記録'),node('pre',JSON.stringify(t.manual_ocr_provenance,null,2)));article.append(provenance);list.append(article);
    }
  }
  select.onchange=()=>{regionId=select.value;render();};
  save.onclick=async()=>{
    if(busy)return;
    try{
      if(!confirm.checked)throw Error('本文と対象領域の対応を確認してください');
      const {source}=manualOcrSource(workspace(),regionId);
      if(JSON.stringify(source)!==sourceKey)throw Error('対象が変更されています。対応を確認してください');
      const {canvas_width,canvas_height,...inputSource}=source;
      busy=true;save.disabled=true;
      const result=await importCandidate({provider:'kuronet',source:inputSource,text:body.value,author:author.value,result_url:resultUrl.value.trim()||null,scope_confirmed:true});
      status(result.archived?'手動OCR候補を履歴へ保存しました。対象領域が変更されています。':'手動OCR候補を保存しました。原画像で文字を校合してください。');
    }catch(e){status(e.message);}finally{busy=false;render();}
  };
  return {render,showRegion(region){regionId=region.selection.region_id;help.open=true;render();element.scrollIntoView({block:'start',behavior:'smooth'});}};
}
