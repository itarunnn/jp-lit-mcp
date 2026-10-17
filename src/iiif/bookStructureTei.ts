import path from "node:path";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { z } from "zod";
import { readBookStructure,protectBookOutput } from "./bookStructure.js";
import { structureFingerprint,structureId,parseBookStructure,type BookStructure,type BookUnit,type BookField } from "./bookStructureSchemas.js";
import { exportBookSqlite,bookStructureProject } from "./bookStructureSqlite.js";
import { ocrDigest } from "./ocrRunner.js";
import { exportBookRequestSchema } from "./bookStructureRequests.js";
export { exportBookRequestSchema } from "./bookStructureRequests.js";

export interface StructureExportResult {output_path:string;output_sha256:string;provenance_path:string;diagnostics:string[]}
function xml(s:string) {
  if(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(s))throw Error("XMLに保存できない文字があります");
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\r/g,"&#13;").replace(/\n/g,"&#10;").replace(/\t/g,"&#9;");
}
function imageName(p:BookStructure["pages"][number],i:number) {return `images/page-${i+1}${path.extname(p.image_path!).toLowerCase()}`;}

export function renderBookTei(input:BookStructure):string {
  const b=parseBookStructure(input),units=new Map(b.units.map(u=>[u.unit_id,u])),spans=new Map(b.spans.map(s=>[s.span_id,s]));
  const ids=new Map<string,string>(),emitted=new Set<string>();
  const zone=(key:string)=>structureId("zone",key),uid=(key:string)=>structureId("unit",key);
  const regionsFor=(spanIds:string[])=>[...new Set(spanIds.flatMap(s=>{const line=spans.get(s)?.line_ref;return b.regions.filter(r=>r.origin==="ocr_line"&&r.line_refs.includes(line??"")&&r.image_xywh).map(r=>r.region_id);}))];
  const categories=new Set<string>();
  const attrs=(key:string,value:unknown,regionIds:string[],prefix="unit")=>{
    const xid=prefix==="unit"?uid(key):structureId(prefix,key);ids.set(key,xid);
    const latest=new Map<string,BookStructure["reviews"][number]>();
    for(const r of b.reviews)if(r.subject_id===key)latest.set(r.aspect,r);
    const statuses=["candidate",...[...latest.values()].filter(r=>r.subject_sha256===structureFingerprint(value)).map(r=>`review-${r.aspect}-${r.result}-${r.actor.kind}`)];
    for(const status of statuses)categories.add(status);
    const facs=[...new Set(regionIds)].filter(key=>b.regions.some(r=>r.region_id===key&&r.image_xywh)).map(key=>`#${zone(key)}`).join(" ");
    return `xml:id="${xid}" ana="${statuses.map(s=>"#"+s).join(" ")}"${facs?` facs="${facs}"`:""}`;
  };
  const field=(f:BookField,tag="seg")=>`<${tag} ${attrs(f.field_id,f,regionsFor(f.span_ids),"field")}${tag==="seg"?` type="${xml(f.role)}"`:""}>${xml(f.text)}</${tag}>`;
  const children=new Map<string,string[]>();
  for(const r of b.relations.filter(r=>r.kind==="contains"&&units.has(r.from_id)&&units.has(r.to_id)))children.set(r.from_id,[...(children.get(r.from_id)??[]),r.to_id]);
  const render=(u:BookUnit):string=>{
    if(emitted.has(u.unit_id))return `<note type="shared-unit"><ptr target="#${uid(u.unit_id)}"/></note>`;
    emitted.add(u.unit_id);const a=attrs(u.unit_id,u,[...u.region_ids,...regionsFor(u.span_ids)]);
    const nested=(children.get(u.unit_id)??[]).map(key=>render(units.get(key)!)).join("");
    if(u.kind==="entry")return `<entryFree ${a}>${u.fields.map(f=>f.role==="headword"?`<form type="lemma">${field(f,"orth")}</form>`:
      f.role==="part_of_speech"?`<gramGrp>${field(f,"pos")}</gramGrp>`:field(f,"dictScrap")).join("")}${nested}</entryFree>`;
    if(u.kind==="sense")return `<sense ${a}>${u.fields.map(f=>field(f,f.role==="definition"?"def":"lbl")).join("")}${nested}</sense>`;
    if(u.kind==="example")return `<cit type="example" ${a}>${u.fields.map(f=>field(f,f.role==="quote"?"quote":"bibl")).join("")}${nested}</cit>`;
    if(u.kind==="figure"||u.kind==="table") {
      const captions=b.relations.filter(r=>r.kind==="caption_of"&&r.to_id===u.unit_id).flatMap(r=>units.get(r.from_id)?.fields??[]);
      // キャプションの本体は元unitに一度だけ保存し、図側は参照する。
      return `<figure${u.kind==="table"?' type="table"':""} ${a}>${captions.map(f=>`<head corresp="#${structureId("field",f.field_id)}">${xml(f.text)}</head>`).join("")}${u.fields.map(f=>field(f)).join("")}${nested}</figure>`;
    }
    return `<ab type="${u.kind}" ${a}>${u.fields.map(f=>field(f)).join("")}${nested}</ab>`;
  };
  const childIds=new Set([...children.values()].flat());
  const roots=b.units.filter(u=>!childIds.has(u.unit_id));
  const logical=roots.map(u=>u.kind==="sense"?`<entryFree type="orphan-sense">${render(u)}</entryFree>`:render(u)).join("");
  const remaining=b.units.filter(u=>!emitted.has(u.unit_id)).map(u=>render(u)).join("");
  const raw=b.lines.map(l=>{
    const facs=regionsFor(b.spans.filter(s=>s.line_ref===l.line_ref).map(s=>s.span_id)).map(key=>`#${zone(key)}`).join(" ");
    return `<ab xml:id="${structureId("raw-line",l.line_ref)}"${facs?` facs="${facs}"`:""} xml:space="preserve">${xml(l.raw_text)}</ab>`;
  }).join("");
  const surfaces=b.pages.map((p,i)=>{
    if(p.coverage!=="ready")return "";const [x,y,w,h]=p.canvas_xywh!;
    const zones=b.regions.filter(r=>r.page_id===p.page_id&&r.image_xywh).map(r=>{ids.set(r.region_id,zone(r.region_id));const [x,y,w,h]=r.image_xywh!;return `<zone xml:id="${zone(r.region_id)}" type="${r.kind}" ulx="${x}" uly="${y}" lrx="${x+w}" lry="${y+h}"/>`;}).join("");
    return `<surface xml:id="${structureId("surface",p.page_id)}" sameAs="${xml(p.canvas_id)}#xywh=${[x,y,w,h].join(",")}" ulx="0" uly="0" lrx="${p.image_width}" lry="${p.image_height}"><graphic url="${imageName(p,i)}" width="${p.image_width}px" height="${p.image_height}px"/>${zones}</surface>`;
  }).join("");
  const links=b.relations.filter(r=>ids.has(r.from_id)&&ids.has(r.to_id)).map(r=>`<link xml:id="${structureId("link",r.relation_id)}" type="${r.kind}" target="#${ids.get(r.from_id)} #${ids.get(r.to_id)}" ana="#candidate"/>`).join("");
  const actors=new Map(b.reviews.map(r=>[structureId("actor",r.actor),r.actor]));
  const revisions=b.reviews.map(r=>`<change who="#${structureId("actor",r.actor)}" when="${r.recorded_at}" type="${r.aspect}" n="${r.result}"${ids.has(r.subject_id)?` corresp="#${ids.get(r.subject_id)}"`:""}>${xml(r.note)}</change>`).join("");
  categories.add("candidate");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>位置と関係を持つ書籍構造</title>${[...actors].map(([id,a])=>`<respStmt xml:id="${id}"><resp>${a.kind}</resp><name>${xml(a.name)}</name></respStmt>`).join("")}</titleStmt><publicationStmt><p>候補構造と確認記録。出典と訂正履歴はstructure.jsonとprovenance.jsonを参照。</p></publicationStmt><sourceDesc><p>IIIF原画像と検証済みOCR。</p></sourceDesc></fileDesc><encodingDesc><classDecl><taxonomy xml:id="structure-status">${[...categories].map(c=>`<category xml:id="${c}"><catDesc>${c}</catDesc></category>`).join("")}</taxonomy></classDecl></encodingDesc>${revisions?`<revisionDesc>${revisions}</revisionDesc>`:""}</teiHeader><facsimile>${surfaces}</facsimile>${links?`<standOff><linkGrp type="book-relations">${links}</linkGrp></standOff>`:""}<text><group><text type="ocr-source"><body>${raw}</body></text><text type="structure"><body>${logical}${remaining}</body></text></group></text></TEI>\n`;
}

export async function exportBookStructure(input:z.input<typeof exportBookRequestSchema>):Promise<StructureExportResult> {
  const r=exportBookRequestSchema.parse(input),b=await readBookStructure(r.structure_path,r.expected_sha256);
  await protectBookOutput(r.output_dir,b,[r.structure_path,...(r.format==="sqlite"?[await bookStructureProject()]:[])]);
  await mkdir(r.output_dir);const snapshot=path.join(r.output_dir,"structure.json");await writeFile(snapshot,JSON.stringify(b,null,2)+"\n",{flag:"wx"});
  const output=path.join(r.output_dir,r.format==="sqlite"?"book.sqlite":"structure.xml"),artifacts=[];
  if(r.format==="sqlite")await exportBookSqlite(snapshot,output);
  else {
    await mkdir(path.join(r.output_dir,"images"));
    for(const [i,p]of b.pages.entries())if(p.image_path){const bytes=await readFile(p.image_path);if(ocrDigest(bytes)!==p.image_sha256)throw Error("保存画像のhashが一致しません");const image=imageName(p,i);await writeFile(path.join(r.output_dir,image),bytes,{flag:"wx"});artifacts.push({path:image,sha256:ocrDigest(bytes)});}
    await writeFile(output,renderBookTei(b),{flag:"wx"});
  }
  const digest=ocrDigest(await readFile(output)),provenance=path.join(r.output_dir,"provenance.json");
  const diagnostics=[...b.diagnostics,...b.units.filter(u=>u.kind==="table").map(u=>`table_region_without_cell_structure:${u.unit_id}`)];
  await writeFile(provenance,JSON.stringify({schema_version:"0.1",source_structure_sha256:r.expected_sha256,profile:b.profile,inputs:b.inputs,
    artifacts:[{path:path.basename(output),sha256:digest},...artifacts],diagnostics},null,2)+"\n",{flag:"wx"});
  return {output_path:output,output_sha256:digest,provenance_path:provenance,diagnostics};
}
