import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { exportOcrTei } from "./ocrTei.js";
import { readWorkspace } from "./workspace.js";
import { protectWorkspaceSources, assertDistinctOutput } from "./outputProtection.js";
import { ocrDigest, readOcrFile } from "./ocrRunner.js";
import { parseBookLayout } from "./bookStructureLayout.js";
import { applyBookProfile } from "./bookStructureProfiles.js";
import { buildBookRequestSchema } from "./bookStructureRequests.js";
export { buildBookRequestSchema } from "./bookStructureRequests.js";
import { parseBookStructure, structureId, type BookStructure, type BookPage } from "./bookStructureSchemas.js";

export type BuildBookRequest=z.input<typeof buildBookRequestSchema>;
export interface StructureResult {structure_path:string;structure_sha256:string;review_queue_path:string;provenance_path:string;diagnostics:string[]}

export async function readBookStructure(file:string,expectedHash:string):Promise<BookStructure> {
  const bytes=await readOcrFile(file,64*1024*1024);if(ocrDigest(bytes)!==expectedHash)throw Error("書籍構造のsnapshot hashが一致しません");
  const b=parseBookStructure(JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/,"")));
  for(const input of b.inputs)if(ocrDigest(await readOcrFile(input.path,64*1024*1024))!==input.sha256)throw Error("書籍構造の原入力hashが一致しません");
  for(const p of b.pages)if(p.image_path&&ocrDigest(await readOcrFile(p.image_path))!==p.image_sha256)throw Error("書籍構造の画像hashが一致しません");
  return b;
}
export async function writeBookSnapshot(b:BookStructure,outputDir:string):Promise<StructureResult> {
  parseBookStructure(b);
  const structurePath=path.join(outputDir,"structure.json"),bytes=JSON.stringify(b,null,2)+"\n";
  await writeFile(structurePath,bytes,{flag:"wx"});
  const queuePath=path.join(outputDir,"review-queue.tsv"),provenancePath=path.join(outputDir,"provenance.json");
  const cell=(s:string)=>s.replace(/[\t\r\n]/g," ");
  await writeFile(queuePath,["subject_id\tkind\ttext\tstate",...b.units.map(u=>[u.unit_id,u.kind,u.fields.map(f=>f.text).join(" / "),"candidate"].map(cell).join("\t")),
    ...b.relations.filter(r=>r.kind!=="precedes").map(r=>[r.relation_id,r.kind,r.reasons.join(" / "),r.state].map(cell).join("\t"))].join("\n")+"\n",{flag:"wx"});
  await writeFile(provenancePath,JSON.stringify({schema_version:"0.1",implementation:"book-structure-0.1",created_at:new Date().toISOString(),
    structure_sha256:ocrDigest(bytes),inputs:b.inputs,profile:b.profile,diagnostics:b.diagnostics},null,2)+"\n",{flag:"wx"});
  return {structure_path:structurePath,structure_sha256:ocrDigest(bytes),review_queue_path:queuePath,provenance_path:provenancePath,diagnostics:b.diagnostics};
}

export async function buildBookStructure(input:BuildBookRequest):Promise<StructureResult> {
  const r=buildBookRequestSchema.parse(input),w=await readWorkspace(r.workspace_path);
  if(new Set(r.text_ids).size!==r.text_ids.length)throw Error("OCR候補IDを重複なく指定してください");
  const selected=r.text_ids.map(key=>{const t=w.texts.find(t=>t.text_id===key);if(!t?.ocr_provenance)throw Error("原OCRを持つ候補を指定してください");return t;});
  if(new Set(selected.map(t=>t.ocr_provenance!.source.document_id)).size!==1)throw Error("同じ資料のOCR候補を指定してください");
  if(r.layout_sources.some(s=>!r.text_ids.includes(s.text_id))||new Set(r.layout_sources.map(s=>s.text_id)).size!==r.layout_sources.length)throw Error("layoutとOCR候補の対応が重複または不明です");
  await protectWorkspaceSources(r.output_dir,w,[r.workspace_path,...r.layout_sources.map(s=>s.path)]);
  for(const side of r.layout_sources) {
    const t=selected.find(t=>t.text_id===side.text_id)!;
    if(side.input_image_sha256!==t.ocr_provenance!.source.image_sha256||ocrDigest(await readOcrFile(side.path,10*1024*1024))!==side.expected_sha256)
      throw Error("layout sidecarの画像・原XML hashが一致しません");
  }
  await mkdir(r.output_dir);const sourceDir=path.join(r.output_dir,"source"),sourceWorkspace=path.join(r.output_dir,"source-workspace.json");
  await writeFile(sourceWorkspace,JSON.stringify(w,null,2)+"\n",{flag:"wx"});
  const original=await exportOcrTei({workspace_path:sourceWorkspace,text_ids:r.text_ids,output_dir:sourceDir});
  const index=JSON.parse(await readFile(original.index_path,"utf8"));
  const b:BookStructure={schema_version:"0.1",structure_id:structureId("structure",w.workspace_id,r.text_ids,r.profile),profile:r.profile,
    workspace_id:w.workspace_id,document_id:selected[0].ocr_provenance!.source.document_id,inputs:[],pages:[],lines:[],regions:[],spans:[],units:[],relations:[],reviews:[],revisions:[],diagnostics:[]};
  const paths=new Map<string,string>();
  paths.set(sourceWorkspace,"workspace");for(const file of [original.tei_path,original.index_path,original.provenance_path])paths.set(file,"verified_ocr_export");
  if(r.pages&&(new Set(r.pages.map(p=>p.text_id).filter(Boolean)).size!==selected.length||r.pages.some(p=>p.text_id&&!r.text_ids.includes(p.text_id))))throw Error("印刷頁とOCR候補の対応が不正です");
  for(const [i,item] of index.items.entries()) {
    const spec=r.pages?.find(p=>p.text_id===item.text_id);if(r.pages&&!spec)throw Error("印刷頁の指定が不足しています");
    if(spec&&spec.coverage!=="ready")throw Error("取り込み済みOCRの頁はreadyで指定してください");
    const page:BookPage={page_id:spec?.page_id??structureId("page",item.text_id),sequence_index:spec?.sequence_index??i,printed_label:spec?.printed_label??String(i+1),
      canvas_id:item.source.selection.canvas_id,canvas_width:item.source.canvas_width,canvas_height:item.source.canvas_height,canvas_xywh:item.surface_canvas_xywh,
      image_path:path.join(sourceDir,item.image.path),image_sha256:item.image.sha256,image_width:item.source.image_width,image_height:item.source.image_height,
      text_id:item.text_id,coverage:"ready"};b.pages.push(page);paths.set(page.image_path!,"saved_image");
    const p=selected.find(t=>t.text_id===item.text_id)!.ocr_provenance!;
    paths.set(p.run_path,"ocr_run");paths.set(p.evidence_path,"ocr_evidence");
    for(const artifact of p.artifacts)paths.set(artifact.path,"ocr_artifact");
    for(const l of item.lines) {
      const lineRef=structureId("line",item.text_id,l.line_id),regionId=structureId("region",lineRef),spanId=structureId("span",lineRef,0,Array.from(l.text).length);
      b.lines.push({line_ref:lineRef,page_id:page.page_id,original_line_id:l.line_id,raw_text:l.text,image_xywh:l.image_xywh,canvas_xywh:l.canvas_xywh,
        source_locator:{text_id:item.text_id,run_path:p.run_path,run_sha256:p.run_sha256,xml_id:l.xml_id,zone_id:l.zone_id,layout:l.layout??null}});
      b.regions.push({region_id:regionId,page_id:page.page_id,kind:"text",image_xywh:l.image_xywh,canvas_xywh:l.canvas_xywh,line_refs:[lineRef],origin:"ocr_line",source_locator:{xml_id:l.xml_id}});
      b.spans.push({span_id:spanId,line_ref:lineRef,range_cp:[0,Array.from(l.text).length]});
      b.units.push({unit_id:structureId("unit",lineRef),kind:"text",region_ids:[regionId],span_ids:[spanId],fields:[{field_id:structureId("field",lineRef,"text"),
        role:"text",span_ids:[spanId],raw_text:l.text,text:l.text,normalized_text:l.text.normalize("NFC")}]});
    }
    const side=r.layout_sources.find(s=>s.text_id===item.text_id);
    const xmlArtifact=p.engine.provider==="ndlocr-ver2"?p.artifacts.find(a=>a.path.endsWith(".xml")):undefined;
    const layoutPath=side?.path??xmlArtifact?.path??null;
    if(layoutPath) {
      paths.set(layoutPath,"layout_xml");const regions=parseBookLayout((await readOcrFile(layoutPath,10*1024*1024)).toString("utf8"),page);
      for(const region of regions) {
        region.line_refs=b.lines.filter(l=>l.page_id===page.page_id&&l.image_xywh&&region.image_xywh&&
          l.image_xywh[0]+l.image_xywh[2]/2>=region.image_xywh[0]&&l.image_xywh[0]+l.image_xywh[2]/2<=region.image_xywh[0]+region.image_xywh[2]&&
          l.image_xywh[1]+l.image_xywh[3]/2>=region.image_xywh[1]&&l.image_xywh[1]+l.image_xywh[3]/2<=region.image_xywh[1]+region.image_xywh[3]).map(l=>l.line_ref);
        b.regions.push(region);
      }
    } else b.diagnostics.push(`layout_not_available:${page.page_id}`);
  }
  for(const spec of r.pages?.filter(p=>!p.text_id)??[]) {
    const canvas=w.documents.find(d=>d.document_id===b.document_id)?.canvases.find(c=>c.canvas_id===spec.canvas_id);
    if(spec.coverage==="ready"||!canvas)throw Error("未処理頁のCanvasと処理状態を指定してください");
    b.pages.push({page_id:spec.page_id,sequence_index:spec.sequence_index,printed_label:spec.printed_label,canvas_id:canvas.canvas_id,
      canvas_width:canvas.width,canvas_height:canvas.height,canvas_xywh:null,image_path:null,image_sha256:null,image_width:null,image_height:null,text_id:null,coverage:spec.coverage});
  }
  for(const [file,role] of paths)b.inputs.push({path:file,role,sha256:ocrDigest(await readOcrFile(file,64*1024*1024))});
  return writeBookSnapshot(applyBookProfile(parseBookStructure(b)),r.output_dir);
}

export async function protectBookOutput(outputDir:string,b:BookStructure,additional:string[]=[]) {
  const workspace=b.inputs.find(i=>i.role==="workspace");
  if(workspace)await protectWorkspaceSources(outputDir,await readWorkspace(workspace.path),additional);
  await assertDistinctOutput(outputDir,[...b.inputs.map(i=>i.path),...b.inputs.filter(i=>i.role==="ocr_run"||i.role==="verified_ocr_export").map(i=>path.dirname(i.path)),
    ...b.pages.flatMap(p=>p.image_path?[p.image_path]:[]),...additional]);
}
