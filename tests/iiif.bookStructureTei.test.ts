import { afterEach,expect,it } from "vitest";
import { mkdtemp,readFile,rm,writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildBookStructure } from "../src/iiif/bookStructure.js";
import { renderBookTei,exportBookStructure } from "../src/iiif/bookStructureTei.js";
import { structureId, structureFingerprint } from "../src/iiif/bookStructureSchemas.js";
import { readTeiLinks,linkTei } from "../src/iiif/tei.js";
import { makeBookRun } from "./fixtures/iiif/bookRun.js";
import { digest } from "./fixtures/iiif/ocr.js";
import { bookFixture } from "./fixtures/iiif/bookStructure.js";
import { applyBookProfile } from "../src/iiif/bookStructureProfiles.js";
const dirs:string[]=[];afterEach(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});

async function validateTei(file:string) {
  await promisify(execFile)("uv",["run","--quiet","--directory",path.resolve("packages/book-structure"),"--frozen","--inexact","python","-m","book_structure.validate",
    "--input",file,"--schema",path.resolve("packages/book-structure/tests/fixtures/tei_all.rng")],{windowsHide:true,timeout:60000});
}

it.each(["figure-only","blank"])("exports schema-valid %s pages with empty OCR",async mode=>{
  const dir=await mkdtemp(path.join(tmpdir(),"book-empty-tei-"));dirs.push(dir);const f=await makeBookRun(dir,{textless:true});
  const layout=path.join(dir,"layout.xml"),xml='<OCRDATASET><PAGE WIDTH="150" HEIGHT="200"><BLOCK TYPE="図版" X="10" Y="10" WIDTH="120" HEIGHT="120"/></PAGE></OCRDATASET>';
  await writeFile(layout,xml);
  const built=await buildBookStructure({workspace_path:f.workspacePath,text_ids:[f.textId],profile:"illustrated",output_dir:path.join(dir,"built"),
    layout_sources:mode==="figure-only"?[{text_id:f.textId,path:layout,expected_sha256:digest(xml),input_image_sha256:f.source.image_sha256}]:[]});
  const exported=await exportBookStructure({structure_path:built.structure_path,expected_sha256:built.structure_sha256,format:"tei",output_dir:path.join(dir,"tei")});
  const b=JSON.parse(await readFile(built.structure_path,"utf8"));expect(b.lines).toHaveLength(0);
  expect(b.units.filter((u:any)=>u.kind==="figure")).toHaveLength(mode==="figure-only"?1:0);
  await validateTei(exported.output_path);
},60000);

it.each(["figure","table"])("exports schema-valid %s transcription fields",async kind=>{
  const dir=await mkdtemp(path.join(tmpdir(),"book-figure-field-"));dirs.push(dir);const b=bookFixture();b.spans[0].range_cp=[0,6];b.units[0].kind=kind;
  if(kind==="table")b.units[0].fields[0].role="text";
  const file=path.join(dir,"structure.xml"),xml=renderBookTei(b);await writeFile(file,xml);
  expect(xml).toContain("圖一　𠮷の花");await validateTei(file);
},60000);

it("keeps printed captions as heads and other figure transcription as block text",()=>{
  const b=bookFixture();b.spans[0].range_cp=[0,6];
  expect(renderBookTei(b)).toMatch(/<head [^>]*>圖一　𠮷の花<\/head>/);
  b.units[0].fields[0].role="text";
  expect(renderBookTei(b)).toContain('<ab type="transcription">');
});

it("preserves relations to every entity kind with resolvable TEI targets",async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),"book-endpoints-"));dirs.push(dir);const b=bookFixture();b.spans[0].range_cp=[0,6];b.units[0].kind="text";
  b.pages.push({...b.pages[0],page_id:"missing",sequence_index:1,coverage:"ocr_failed",text_id:null,image_path:null,image_sha256:null,image_width:null,image_height:null,canvas_xywh:null});
  b.regions.push({...b.regions[0],region_id:"unlocated",image_xywh:null,canvas_xywh:null});
  b.relations=[["r1","l1"],["p1","s1"],["s1","f1"],["missing","unlocated"],["u1","f1"]].map(([from_id,to_id],i)=>({relation_id:`r-${i}`,kind:"refers_to",from_id,to_id,reasons:[],score:null,state:"candidate"}));
  b.reviews.push({review_id:"review",subject_id:"l1",subject_sha256:structureFingerprint(b.lines[0]),aspect:"transcription",result:"accepted",actor:{kind:"agent",name:"reader"},note:"照合",recorded_at:"2026-10-17T00:00:00Z"});
  b.revisions.push({revision_id:"revision",operation:"review",subject_id:"u1",before_sha256:structureFingerprint(b.units[0]),payload:{},actor:{kind:"agent",name:"reader"},recorded_at:"2026-10-17T00:00:00Z"});
  b.relations.push({relation_id:"metadata",kind:"refers_to",from_id:"r-0",to_id:"review",reasons:[],score:null,state:"candidate"},
    {relation_id:"revision-link",kind:"refers_to",from_id:"revision",to_id:"p1",reasons:[],score:null,state:"candidate"});
  const xml=renderBookTei(b),links=[...xml.matchAll(/<link\s[^>]*\btarget="([^"]+)"/g)],ids=[...xml.matchAll(/\bxml:id="([^"]+)"/g)].map(m=>m[1]);
  expect(links).toHaveLength(7);expect(new Set(ids).size).toBe(ids.length);
  for(const link of links)for(const target of link[1].split(" "))expect(ids).toContain(target.slice(1));
  const file=path.join(dir,"structure.xml");await writeFile(file,xml);await validateTei(file);
},60000);

it("keeps actor-specific review states and relation decisions linked in TEI",()=>{
  const b=bookFixture();b.spans[0].range_cp=[0,6];b.units[0].kind="text";
  const profiled=applyBookProfile(b),relation=profiled.relations.find(r=>r.kind==="caption_of")!,field=profiled.units[0].fields[0];
  const review=(id:string,subject:any,actor:any,result:string,aspect:string)=>({review_id:id,subject_id:subject.field_id??subject.relation_id,
    subject_sha256:structureFingerprint(subject),actor,result,aspect,note:"test",recorded_at:"2026-10-17T00:00:00Z"});
  profiled.reviews.push(review("human",field,{kind:"human",name:"reader"},"accepted","transcription"),
    review("agent",field,{kind:"agent",name:"reviewer"},"needs_review","transcription"),
    review("relation-review",relation,{kind:"human",name:"reader"},"rejected","association"));
  const xml=renderBookTei(profiled);
  expect(xml).toContain("#review-transcription-accepted-human");expect(xml).toContain("#review-transcription-needs_review-agent");
  const linkId=structureId("link",relation.relation_id);
  expect(xml).toMatch(new RegExp(`<link[^>]+xml:id="${linkId}"[^>]+review-association-rejected-human`));
  expect(xml).toContain(`corresp="#${linkId}"`);expect(xml).not.toContain("<head ");
  profiled.reviews.at(-1)!.result="accepted";
  const accepted=renderBookTei(profiled);expect(accepted).toContain("<head ");expect(accepted).toContain(`#${linkId}`);
});

it("exports a two-page figure whose facs tokens resolve separately through the real reader",async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),"book-tei-"));dirs.push(dir);const f=await makeBookRun(dir);
  const canvas2={...f.workspace.documents[0].canvases[0],canvas_id:"https://example.org/canvas2"};f.workspace.documents[0].canvases.push(canvas2);
  await writeFile(f.workspacePath,JSON.stringify(f.workspace));
  const built=await buildBookStructure({workspace_path:f.workspacePath,text_ids:[f.textId],profile:"general",output_dir:path.join(dir,"built")});
  const b=JSON.parse(await readFile(built.structure_path,"utf8"));
  b.pages.push({...b.pages[0],page_id:"page2",sequence_index:1,canvas_id:canvas2.canvas_id});
  const region={region_id:"figure1",page_id:b.pages[0].page_id,kind:"figure",image_xywh:[10,10,120,120],canvas_xywh:[120,220,240,240],line_refs:[],origin:"ocr_layout",source_locator:{}};
  b.regions.push(region,{...region,region_id:"figure2",page_id:"page2"});
  b.units.push({unit_id:"spread-figure",kind:"figure",region_ids:["figure1","figure2"],span_ids:[],fields:[]});
  const xml=renderBookTei(b);expect(xml).toContain('<figure');
  const snapshot=path.join(dir,"structure.json");await writeFile(snapshot,JSON.stringify(b));
  const result=await exportBookStructure({structure_path:snapshot,expected_sha256:digest(JSON.stringify(b)),format:"tei",output_dir:path.join(dir,"tei")});
  const response=await readTeiLinks(result.output_path,result.output_sha256,100,0);
  const linked=linkTei(f.workspace,response,{file_path:result.output_path,expected_sha256:result.output_sha256,document_id:"d1",surface_bindings:[]});
  const figure=linked.tei_links!.filter(l=>l.reference.source_locator.xml_id===structureId("unit","spread-figure"));
  expect(figure).toHaveLength(2);expect(figure.map(l=>l.target?.canvas_id)).toEqual([b.pages[0].canvas_id,canvas2.canvas_id]);
  expect(figure.map(l=>l.target?.xywh)).toEqual([[120,220,240,240],[120,220,240,240]]);
  expect(linked.tei_links!.every(l=>l.state==="resolved")).toBe(true);
  await promisify(execFile)("uv",["run","--quiet","--directory",path.resolve("packages/book-structure"),"--frozen","python","-m","book_structure.validate",
    "--input",result.output_path,"--schema",path.resolve("packages/book-structure/tests/fixtures/tei_all.rng")],{windowsHide:true,timeout:60000});
},60000);

it("validates dictionary entries, senses and examples against the fixed TEI schema",async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),"book-dictionary-tei-"));dirs.push(dir);
  const b=bookFixture(),text="あ（名）①語釋。「用例」";
  b.profile="dictionary";Object.assign(b.lines[0],{raw_text:text,image_xywh:[120,10,20,180],canvas_xywh:[340,220,40,360]});
  Object.assign(b.regions[0],{kind:"text",origin:"ocr_line",line_refs:["l1"],image_xywh:[120,10,20,180],canvas_xywh:[340,220,40,360]});
  b.spans[0].range_cp=[0,Array.from(text).length];
  Object.assign(b.units[0],{kind:"text",region_ids:["r1"]});Object.assign(b.units[0].fields[0],{role:"text",raw_text:text,text,normalized_text:text});
  const xml=renderBookTei(applyBookProfile(b)),file=path.join(dir,"dictionary.xml");await writeFile(file,xml);
  expect(xml).toContain("<entryFree");expect(xml).toContain("<sense");expect(xml).toContain('<cit type="example"');
  await promisify(execFile)("uv",["run","--quiet","--directory",path.resolve("packages/book-structure"),"--frozen","python","-m","book_structure.validate",
    "--input",file,"--schema",path.resolve("packages/book-structure/tests/fixtures/tei_all.rng")],{windowsHide:true,timeout:60000});
},60000);
