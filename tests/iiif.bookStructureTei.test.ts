import { afterEach,expect,it } from "vitest";
import { mkdtemp,readFile,rm,writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildBookStructure } from "../src/iiif/bookStructure.js";
import { renderBookTei,exportBookStructure } from "../src/iiif/bookStructureTei.js";
import { structureId } from "../src/iiif/bookStructureSchemas.js";
import { readTeiLinks,linkTei } from "../src/iiif/tei.js";
import { makeBookRun } from "./fixtures/iiif/bookRun.js";
import { digest } from "./fixtures/iiif/ocr.js";
import { bookFixture } from "./fixtures/iiif/bookStructure.js";
import { applyBookProfile } from "../src/iiif/bookStructureProfiles.js";
const dirs:string[]=[];afterEach(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});

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
