import { afterEach, expect, it } from "vitest";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseBookLayout } from "../src/iiif/bookStructureLayout.js";
import { buildBookStructure, readBookStructure } from "../src/iiif/bookStructure.js";
import { exportBookStructure } from "../src/iiif/bookStructureTei.js";
import { readTeiLinks, linkTei } from "../src/iiif/tei.js";
import { bookFixture } from "./fixtures/iiif/bookStructure.js";
import { makeBookRun } from "./fixtures/iiif/bookRun.js";
import { digest } from "./fixtures/iiif/ocr.js";
const dirs:string[]=[];
afterEach(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
const xml = '<OCRDATASET><PAGE WIDTH="150" HEIGHT="200"><BLOCK TYPE="図版"><SHAPE><POLYGON POINTS="10,10,130,10,130,130,10,130"/></SHAPE></BLOCK></PAGE></OCRDATASET>';

it("preserves a non-text polygon block with its source geometry and Canvas mapping",()=>{
  const regions = parseBookLayout(xml,bookFixture().pages[0]);
  expect(regions[0]).toMatchObject({kind:"figure",image_xywh:[10,10,120,120],canvas_xywh:[120,220,240,240],line_refs:[]});
  expect(regions[0].source_locator.polygon).toEqual([10,10,130,10,130,130,10,130]);
  expect(()=>parseBookLayout(xml.replace('WIDTH="150"','WIDTH="151"'),bookFixture().pages[0])).toThrow();
});

it("builds stable structure from verified original OCR and a hash-bound layout sidecar",async()=>{
  const dir = await mkdtemp(path.join(tmpdir(),"book-source-")); dirs.push(dir); const f=await makeBookRun(dir);
  const layoutPath=path.join(dir,"layout.xml"); await writeFile(layoutPath,xml);
  const request={workspace_path:f.workspacePath,text_ids:[f.textId],profile:"general" as const,output_dir:path.join(dir,"one"),
    layout_sources:[{text_id:f.textId,path:layoutPath,expected_sha256:digest(xml),input_image_sha256:f.source.image_sha256}]};
  const result=await buildBookStructure(request), b=JSON.parse(await readFile(result.structure_path,"utf8"));
  expect(b.lines.map((l:any)=>l.raw_text)).toEqual(["圖一　花の圖","本文。圖一を見よ。"]);
  expect(b.regions.find((r:any)=>r.kind==="figure").canvas_xywh).toEqual([120,220,240,240]);
  const again=await buildBookStructure({...request,output_dir:path.join(dir,"two")});
  expect(JSON.parse(await readFile(again.structure_path,"utf8")).units.map((u:any)=>u.unit_id)).toEqual(b.units.map((u:any)=>u.unit_id));
  await expect(buildBookStructure({...request,output_dir:path.join(dir,"bad"),layout_sources:[{...request.layout_sources[0],input_image_sha256:"0".repeat(64)}]})).rejects.toThrow();
  await expect(buildBookStructure({...request,output_dir:request.output_dir})).rejects.toThrow();
  await writeFile(layoutPath,xml+" ");
  await expect(buildBookStructure({...request,output_dir:path.join(dir,"changed")})).rejects.toThrow();
  await expect(buildBookStructure({...request,output_dir:path.join(f.root,"output")})).rejects.toThrow();
});

it("rejects an altered raw OCR before producing any structure",async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),"book-raw-"));dirs.push(dir);const f=await makeBookRun(dir);
  await writeFile(path.join(f.root,"raw.txt"),"差し替え");
  await expect(buildBookStructure({workspace_path:f.workspacePath,text_ids:[f.textId],profile:"general",output_dir:path.join(dir,"out")})).rejects.toThrow();
});

it.each(["duplicate-text","wrong-canvas"])("rejects %s page assignment before writing a bundle",async kind=>{
  const dir=await mkdtemp(path.join(tmpdir(),"book-pages-"));dirs.push(dir);const f=await makeBookRun(dir),output=path.join(dir,"out");
  const page={text_id:f.textId,page_id:"p1",sequence_index:0,printed_label:"1",coverage:"ready" as const};
  const pages=kind==="duplicate-text"?[page,{...page,page_id:"p2",sequence_index:1}]:[{...page,canvas_id:"https://example.org/wrong-canvas"}];
  await expect(buildBookStructure({workspace_path:f.workspacePath,text_ids:[f.textId],profile:"general",pages,output_dir:output})).rejects.toThrow();
  await expect(access(output)).rejects.toMatchObject({code:"ENOENT"});
});

it("keeps its fixed source workspace after linking TEI into the editable workspace",async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),"book-workspace-"));dirs.push(dir);const f=await makeBookRun(dir);
  const built=await buildBookStructure({workspace_path:f.workspacePath,text_ids:[f.textId],profile:"general",output_dir:path.join(dir,"built")});
  const tei=await exportBookStructure({structure_path:built.structure_path,expected_sha256:built.structure_sha256,format:"tei",output_dir:path.join(dir,"tei")});
  const links=await readTeiLinks(tei.output_path,tei.output_sha256,100,0);
  const linked=linkTei(f.workspace,links,{file_path:tei.output_path,expected_sha256:tei.output_sha256,document_id:"d1",surface_bindings:[]});
  await writeFile(f.workspacePath,JSON.stringify(linked));
  const b=await readBookStructure(built.structure_path,built.structure_sha256);
  expect(b.inputs.find(i=>i.role==="workspace")?.path).not.toBe(f.workspacePath);
  await exportBookStructure({structure_path:built.structure_path,expected_sha256:built.structure_sha256,format:"tei",output_dir:path.join(dir,"tei-again")});
  await writeFile(path.join(f.root,"raw.txt"),"changed");
  await expect(readBookStructure(built.structure_path,built.structure_sha256)).rejects.toThrow(/hash/);
},60000);
