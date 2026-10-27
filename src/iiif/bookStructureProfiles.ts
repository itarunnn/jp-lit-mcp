import { parseBookStructure, structureId, type BookStructure, type BookUnit, type BookField } from "./bookStructureSchemas.js";
import { illustrationUnits, isLongVerticalBody, captionGeometry, enclosesIllustration } from "./bookStructureIllustrations.js";

type Line=BookStructure["lines"][number];
function quantile(values:number[],p:number) {const a=[...values].sort((a,b)=>a-b),i=(a.length-1)*p,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l);}
function rows(lines:Line[],height:number) {
  const long=lines.filter(l=>l.image_xywh&&l.image_xywh[3]>height*.15&&l.image_xywh[3]/l.image_xywh[2]>5);
  if(!long.length)return {anchors:[0],tolerance:0};
  const ys=long.map(l=>l.image_xywh![1]),width=quantile(long.map(l=>l.image_xywh![2]),.5);
  const k=long.length>=6&&Math.max(...ys)-Math.min(...ys)>height*.35?3:1;
  let centers=k===1?[quantile(ys,.5)]:[.15,.5,.85].map(p=>quantile(ys,p));
  for(let i=0;i<20;i++)centers=centers.map((c,n)=>{const group=ys.filter(y=>centers.reduce((best,v,j)=>Math.abs(y-v)<Math.abs(y-centers[best])?j:best,0)===n);return group.length?quantile(group,.5):c;});
  centers.sort((a,b)=>a-b);
  const anchors=centers.map((c,n)=>{const group=ys.filter(y=>centers.reduce((best,v,j)=>Math.abs(y-v)<Math.abs(y-centers[best])?j:best,0)===n);return group.length?quantile(group,.25):c;});
  return {anchors,tolerance:width*.8};
}
const headPattern=/^[\s(（\[〔「『{〈]*([ぁ-ゖァ-ヺー・\-]{1,35})\s*[（(〔\[]\s*(自動|他動|名|代|形|副|感|動|助)[）)〕\]]?/u;
function numberKey(s:string) {
  s=s.normalize("NFKC");const trimZero=(value:string)=>value.replace(/^0+(?=\d)/,"");
  if(/^\d+$/.test(s))return trimZero(s);
  const digits:Record<string,number>={〇:0,零:0,一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
  if(Array.from(s).every(c=>c in digits))return trimZero(Array.from(s,c=>digits[c]).join(""));
  let total=0,n=0;
  for(const c of s)if(c in digits)n=digits[c];else if(c==="十"||c==="百"||c==="千"){total+=(n||1)*({十:10,百:100,千:1000}[c]);n=0;}else return s;
  return String(total+n);
}
const figurePattern=/(?:([圖図表])\s*([〇零一二三四五六七八九十百千0-9０-９]{1,20})|第?([〇零一二三四五六七八九十百千0-9０-９]{1,20})\s*([圖図表]))/gu;
function figureKeys(text:string) {return [...text.matchAll(figurePattern)].map(m=>({key:`${(m[1]??m[4])==="表"?"table":"figure"}:${numberKey(m[2]??m[3])}`,index:m.index!,end:m.index!+m[0].length}));}

/** 共通の物理データへ候補の論理単位と関係を追加する。原行は常に保持する。 */
export function applyBookProfile(input:BookStructure):BookStructure {
  const b=parseBookStructure(structuredClone(input));
  const lineMap=new Map(b.lines.map(l=>[l.line_ref,l])),spanMap=new Map(b.spans.map(s=>[s.span_id,s]));
  const originalUnits=new Map(b.lines.map(l=>[l.line_ref,b.units.find(u=>u.kind==="text"&&u.span_ids.some(s=>spanMap.get(s)?.line_ref===l.line_ref))]));
  const regionFor=(l:Line)=>b.regions.find(r=>r.origin==="ocr_line"&&r.line_refs.includes(l.line_ref))?.region_id;
  const fullSpan=(l:Line)=>b.spans.find(s=>s.line_ref===l.line_ref&&s.range_cp[0]===0&&s.range_cp[1]===Array.from(l.raw_text).length)!.span_id;
  const span=(l:Line,start:number,end:number)=>{
    const range:[number,number]=[Array.from(l.raw_text.slice(0,start)).length,Array.from(l.raw_text.slice(0,end)).length],key=structureId("span",l.line_ref,...range);
    if(!spanMap.has(key)){const item={span_id:key,line_ref:l.line_ref,range_cp:range};b.spans.push(item);spanMap.set(key,item);}return key;
  };
  const field=(owner:string,role:string,ids:string[]):BookField=>{
    const raw=ids.map(key=>{const s=spanMap.get(key)!;return Array.from(lineMap.get(s.line_ref)!.raw_text).slice(...s.range_cp).join("");}).join("\n");
    return {field_id:structureId("field",owner,role,ids),role,span_ids:ids,raw_text:raw,text:raw,normalized_text:raw.normalize("NFC")};
  };
  const relation=(kind:BookStructure["relations"][number]["kind"],from:string,to:string,reasons:string[],score:number|null=null)=>{
    const id=structureId("relation",kind,from,to);if(!b.relations.some(r=>r.relation_id===id))b.relations.push({relation_id:id,kind,from_id:from,to_id:to,reasons,score,state:"candidate"});
  };
  const pages=[...b.pages].sort((a,b)=>a.sequence_index-b.sequence_index);
  const figureUnits=illustrationUnits(b.regions,b.profile==="illustrated");
  b.units.push(...figureUnits);
  for(const u of figureUnits)if(u.region_ids.length>1)b.diagnostics.push(`near_duplicate_figure_regions:${u.region_ids.join(",")}`);
  const captionLines=new Set<string>(),keyTargets=new Map<string,Set<string>>();
  const captionData=b.profile==="illustrated"?b.lines.flatMap(line=>{
    const keys=figureKeys(line.raw_text),explicit=b.regions.some(r=>r.kind==="caption"&&r.line_refs.includes(line.line_ref));
    const page=pages.find(p=>p.page_id===line.page_id)!;
    const numberOnly=keys.length===1&&line.raw_text.slice(0,keys[0].index).trim()===""&&line.raw_text.slice(keys[0].end).trim()==="";
    if(!explicit&&((!numberOnly&&isLongVerticalBody(line.image_xywh,page))||!keys.some(k=>line.raw_text.slice(0,k.index).trim()===""&&!/^\s*[)）]/u.test(line.raw_text.slice(k.end)))))return [];
    const matches=figureUnits.flatMap<{u:BookUnit;geometry:ReturnType<typeof captionGeometry>}>(u=>{
      const r=b.regions.find(r=>r.region_id===u.region_ids[0])!;if(r.page_id!==line.page_id)return [];
      if(keys.length&&!keys.some(k=>k.key.startsWith(u.kind+":")))return [];
      if(!line.image_xywh||!r.image_xywh)return explicit?[{u,geometry:null}]:[];
      const geometry=captionGeometry(line.image_xywh,r.image_xywh,page);
      return geometry?[{u,geometry}]:[];
    });
    const region=(u:BookUnit)=>b.regions.find(r=>r.region_id===u.region_ids[0])!;
    const nearby=matches.filter(m=>m.geometry?.side!=="inside"||!matches.some(other=>other.u.kind===m.u.kind&&other.geometry&&other.geometry.side!=="inside"&&enclosesIllustration(region(m.u),region(other.u))));
    const nearest=Math.min(...nearby.flatMap(m=>m.geometry?[m.geometry.distance]:[]));
    const targets=nearby.filter(m=>!m.geometry||m.geometry.distance<=nearest+.02);
    return [{line,keys,explicit,targets}];
  }):[];
  // 図の外側で一つに定まる別番号の説明文を根拠に、隣の図への二重対応を整理する。
  // 図内の番号は図群に属する別の図を示すことがあるため、排他の根拠にしない。
  // 近い候補が残る場合や全候補を失う場合は競合を保持する。
  let changed=true;
  while(changed){changed=false;
    const anchors=captionData.filter(c=>c.keys.length===1&&c.targets.length===1&&c.targets[0].geometry&&c.targets[0].geometry.side!=="inside");
    for(const caption of captionData){
      if(caption.keys.length!==1||caption.targets.length<2)continue;
      const remaining=caption.targets.filter(t=>!anchors.some(a=>a.line.page_id===caption.line.page_id&&a.keys[0].key!==caption.keys[0].key&&a.targets[0].u.unit_id===t.u.unit_id));
      if(remaining.length&&remaining.length<caption.targets.length){caption.targets=remaining;changed=true;}
    }
  }
  for(const {line,keys,explicit,targets}of captionData) {
    captionLines.add(line.line_ref);const unit=originalUnits.get(line.line_ref);if(!unit)continue;
    for(const {u:target,geometry}of targets) {
      const distance=geometry?.distance;
      relation("caption_of",unit.unit_id,target.unit_id,[explicit?"explicit_caption_region":"caption_number_at_line_start","same_page",
        ...(distance===undefined?["distance_unavailable"]:["nearby_region","aligned_caption_axis",`caption_side:${geometry!.side}`,`edge_gap_px:${geometry!.gap}`,`normalized_center_distance:${distance}`,"distance_denominator:page_diagonal","distance_threshold:0.4","nearest_distance_margin:0.02"]),...(keys.map(k=>k.key))]);
      for(const {key} of keys){if(!keyTargets.has(key))keyTargets.set(key,new Set());keyTargets.get(key)!.add(target.unit_id);}
    }
    if(targets.length>1)b.diagnostics.push(`ambiguous_caption:${line.line_ref}`);
    if(!targets.length)b.diagnostics.push(`unmatched_caption:${line.line_ref}`);
  }
  if(b.profile==="illustrated")for(const line of b.lines)if(!captionLines.has(line.line_ref)) {
    const from=originalUnits.get(line.line_ref);if(!from)continue;
    for(const {key} of figureKeys(line.raw_text))for(const target of keyTargets.get(key)??[])relation("refers_to",from.unit_id,target,["figure_number",key]);
  }
  let previousEntry:BookUnit|undefined,previousPage:number|undefined;
  for(const page of pages) {
    if(page.coverage!=="ready")continue;
    const lines=b.lines.filter(l=>l.page_id===page.page_id),row=rows(lines,page.image_height!);
    const rowNumber=(l:Line)=>l.image_xywh?row.anchors.reduce((best,v,i)=>Math.abs(l.image_xywh![1]-v)<Math.abs(l.image_xywh![1]-row.anchors[best])?i:best,0):Number.MAX_SAFE_INTEGER;
    const ordered=b.profile==="dictionary"?[...lines].sort((a,b)=>rowNumber(a)-rowNumber(b)||(b.image_xywh?.[0]??0)-(a.image_xywh?.[0]??0)||(a.image_xywh?.[1]??0)-(b.image_xywh?.[1]??0)):lines;
    const body=ordered.filter(l=>!captionLines.has(l.line_ref)&&!b.regions.some(r=>(r.kind==="figure"||r.kind==="table")&&r.line_refs.includes(l.line_ref)));
    for(let i=1;i<body.length;i++){const from=originalUnits.get(body[i-1].line_ref),to=originalUnits.get(body[i].line_ref);if(from&&to)relation("precedes",from.unit_id,to.unit_id,[b.profile==="dictionary"?"per_page_rows_right_to_left":"original_ocr_order"]);}
    if(b.profile!=="dictionary")continue;
    const starts=ordered.map((l,i)=>({l,i,match:headPattern.exec(l.raw_text)})).filter(({l,match})=>match&&l.image_xywh&&l.image_xywh[3]/l.image_xywh[2]>2&&Math.abs(l.image_xywh[1]-row.anchors[rowNumber(l)])<=row.tolerance);
    if(previousEntry&&ordered.length&&(starts.length===0||starts[0].i>0)) {
      const to=originalUnits.get(ordered[0].line_ref);
      if(previousPage!==undefined&&page.sequence_index===previousPage+1&&to)relation("continues",previousEntry.unit_id,to.unit_id,["adjacent_ready_pages","headless_page_start"]);
      else {b.diagnostics.push(`continuation_gap:${page.page_id}`);previousEntry=undefined;}
    }
    for(let i=0;i<starts.length;i++) {
      const start=starts[i],match=start.match!,part=ordered.slice(start.i,starts[i+1]?.i??ordered.length),owner=structureId("entry",start.l.line_ref);
      const headStart=start.l.raw_text.indexOf(match[1]),posStart=start.l.raw_text.indexOf(match[2],headStart+match[1].length);
      const entry:BookUnit={unit_id:owner,kind:"entry",region_ids:part.flatMap(l=>{const r=regionFor(l);return r?[r]:[];}),span_ids:part.map(fullSpan),
        fields:[field(owner,"headword",[span(start.l,headStart,headStart+match[1].length)]),field(owner,"part_of_speech",[span(start.l,posStart,posStart+match[2].length)])]};
      b.units.push(entry);previousEntry=entry;
      const bodySpans=part.flatMap((l,n)=>{const from=n===0?match[0].length:0;return from<l.raw_text.length?[span(l,from,l.raw_text.length)]:[];});
      if(bodySpans.length)entry.fields.push(field(owner,"entry_body",bodySpans));
      let sense:BookUnit|undefined;
      for(const [n,l]of part.entries()) {
        const from=n===0?match[0].length:0,text=l.raw_text.slice(from);if(!text)continue;
        const markers=[...text.matchAll(/[①-⑳]/gu)],segments=markers.length?markers.map((m,j)=>({from:from+m.index!,to:from+(markers[j+1]?.index??text.length),label:m[0]})):[{from,to:l.raw_text.length,label:""}];
        if(markers.length&&markers[0].index!>0)segments.unshift({from,to:from+markers[0].index!,label:""});
        for(const segment of segments) {
          if(!sense||segment.label){sense={unit_id:structureId("sense",owner,l.line_ref,segment.from),kind:"sense",region_ids:entry.region_ids,span_ids:[],fields:[]};b.units.push(sense);relation("contains",owner,sense.unit_id,["sense_marker_or_unsegmented_definition"]);}
          const segmentSpan=span(l,segment.from,segment.to);sense.span_ids.push(segmentSpan);
          if(segment.label)sense.fields.push(field(sense.unit_id,"sense_label",[span(l,segment.from,segment.from+segment.label.length)]));
          const fragment=l.raw_text.slice(segment.from+segment.label.length,segment.to),base=segment.from+segment.label.length;
          const quotes=[...fragment.matchAll(/「([^」]*)」|『([^』]*)』/gu)];let last=0;const defs:string[]=[];
          for(const q of quotes) {
            if(q.index!>last)defs.push(span(l,base+last,base+q.index!));
            const quoteSpan=span(l,base+q.index!+1,base+q.index!+q[0].length-1),qid=structureId("example",owner,quoteSpan);
            b.units.push({unit_id:qid,kind:"example",region_ids:entry.region_ids,span_ids:[quoteSpan],fields:[field(qid,"quote",[quoteSpan])]});
            relation("contains",sense.unit_id,qid,["quotation_marks"]);last=q.index!+q[0].length;
          }
          if(last<fragment.length)defs.push(span(l,base+last,segment.to));
          if(defs.length)sense.fields.push(field(sense.unit_id,"definition",defs));
        }
      }
    }
    previousPage=page.sequence_index;
  }
  return parseBookStructure(b);
}
