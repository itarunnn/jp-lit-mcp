import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { digest, ocrCandidate } from "./fixtures/iiif/ocr.js";
import { validateWorkspace } from "../src/iiif/schemas.js";
import { saveWorkspace, readWorkspace } from "../src/iiif/workspace.js";
import { runIiifCli } from "../src/iiif/cli.js";
const dirs:string[]=[];
afterEach(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
async function fixture() {
  const dir=await mkdtemp(path.join(tmpdir(),"ocr-import-")); dirs.push(dir); await mkdir(path.join(dir,"raw"));
  const t=ocrCandidate(), p=t.ocr_provenance, png=Buffer.alloc(24);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.write("IHDR",12); png.writeUInt32BE(150,16);png.writeUInt32BE(200,20);
  p.source.image_sha256=digest(png);
  const files:Record<string,string|Buffer>={"input.png":png,"raw/input.txt":t.text,
    "raw/input.json":JSON.stringify({imginfo:{img_width:150,img_height:200},contents:[p.lines.map(l=>({id:l.line_id,text:l.text,boundingBox:l.bounding_box,confidence:l.detection_confidence}))]})};
  for(const [file,bytes] of Object.entries(files))await writeFile(path.join(dir,file),bytes);
  const s=p.source;
  const evidence=JSON.stringify({schema_version:"0.1",workspace_id:"w1",items:[{evidence_id:"r1",selection:s.selection,
    source:{document_id:s.document_id,receipt:{sha256:s.manifest_sha256}},canvas:{canvas_id:s.selection.canvas_id,width:s.canvas_width,height:s.canvas_height},
    crop:{status:"supported",image_xywh:s.original_image_xywh,transform:s.canvas_to_image},
    display_image:{path:"region.png",receipt:{sha256:s.image_sha256},width:s.image_width,height:s.image_height,original_image_xywh:s.original_image_xywh,canvas_to_image:s.canvas_to_image,scale_x:s.scale_x,scale_y:s.scale_y},
    image_permission_confirmed:true,text_evidence:[]}]}); await writeFile(path.join(dir,"evidence.json"),evidence);
  const run={schema_version:"0.1",run_id:p.run_id,status:"completed",image_transmission:"none",device:"cpu",engine:p.engine,
    evidence_path:path.join(dir,"original.json"),evidence_sha256:digest(evidence),items:[{status:"completed",source:p.source,started_at:p.started_at,finished_at:p.finished_at,duration_ms:p.duration_ms,
      text:t.text,lines:p.lines,artifacts:Object.entries(files).map(([file,b])=>({path:file,sha256:digest(b)})),diagnostics:[],error:null}]};
  const runPath=path.join(dir,"run.json"); await writeFile(runPath,JSON.stringify(run));
  const api=await import("../src/iiif/ocrImport.js"); return {dir,run,runPath,api};
}
describe("OCR import and separate collation",()=>{
  it("rejects a run redirected to another region while its saved evidence is unchanged",async()=>{
    const f=await fixture(),w=validateWorkspace(sampleWorkspace());
    w.regions.push({...structuredClone(w.regions[0]),selection:{...w.regions[0].selection,region_id:"r2"}});
    f.run.items[0].source.evidence_id="r2";f.run.items[0].source.selection.region_id="r2";
    await writeFile(f.runPath,JSON.stringify(f.run));
    await expect(f.api.importOcr(w,f.runPath)).rejects.toThrow(/evidence/);expect(w.texts).toHaveLength(0);
  });
  it("imports unchanged raw candidates idempotently and round trips provenance",async()=>{
    const f=await fixture(), original=validateWorkspace(sampleWorkspace());
    const result=await f.api.importOcr(original,f.runPath), w=result.workspace;
    expect(original.texts).toHaveLength(0);expect(result.imported).toBe(1);
    expect(w.texts[0]).toMatchObject({text:"古い本文\n",origin:"ocr_candidate",verification_state:"unverified"});
    expect(w.regions[0].text_evidence_ids).toEqual([w.texts[0].text_id]);
    const twice=await f.api.importOcr(w,f.runPath);expect(twice.imported).toBe(0);expect(twice.workspace.texts).toHaveLength(1);
    const file=path.join(f.dir,"workspace.json");await saveWorkspace(file,w);expect(await readWorkspace(file)).toEqual(w);
  });
  it("imports the completed part and rejects a run that is still running",async()=>{
    const f=await fixture(),w=validateWorkspace(sampleWorkspace());
    f.run.status="running";await writeFile(f.runPath,JSON.stringify(f.run));
    await expect(f.api.importOcr(w,f.runPath)).rejects.toThrow(/処理途中/);
    f.run.status="partial";
    (f.run.items as unknown[]).push({...structuredClone(f.run.items[0]),status:"failed",text:null,lines:[],error:"fixture failure",artifacts:[],
      source:{...f.run.items[0].source,evidence_id:"r2",selection:{...f.run.items[0].source.selection,region_id:"r2"}}});
    await writeFile(f.runPath,JSON.stringify(f.run));
    const result=await f.api.importOcr(w,f.runPath);expect(result.imported).toBe(1);expect(result.skipped).toBe(1);expect(result.workspace.texts).toHaveLength(1);
  });
  it.each(["workspace","manifest","region","raw","image","lines","text","evidence"])("rejects incompatible or changed evidence: %s",async(kind)=>{
    const f=await fixture(), w=validateWorkspace(sampleWorkspace());
    if(kind==="workspace")w.workspace_id="another";
    if(kind==="manifest")w.documents[0].receipt.sha256="0".repeat(64);
    if(kind==="region")w.regions[0].selection.xywh[0]++;
    if(kind==="raw")await writeFile(path.join(f.dir,"raw/input.txt"),"changed");
    if(kind==="image")await writeFile(path.join(f.dir,"input.png"),"changed");
    if(kind==="lines")f.run.items[0].lines[0].text="changed";
    if(kind==="text")f.run.items[0].text="changed";
    if(kind==="evidence")await writeFile(path.join(f.dir,"evidence.json"),"changed");
    await writeFile(f.runPath,JSON.stringify(f.run));
    await expect(f.api.importOcr(w,f.runPath)).rejects.toThrow();expect(w.texts).toHaveLength(0);
  });
  it("adds an attributed correction without rewriting OCR and preserves it across reimport",async()=>{
    const f=await fixture(), w=(await f.api.importOcr(validateWorkspace(sampleWorkspace()),f.runPath)).workspace;
    const {recordOcrReview}=await import("../src/iiif/ocr-state.mjs");
    const t=w.texts[0];recordOcrReview(w,t.text_id,"校合者","mismatch","合成fixtureで誤字を確認","修訂候補");
    expect(t.text).toBe("古い本文\n");expect(t.verification_state).toBe("unverified");
    expect(t.ocr_provenance!.reviews[0]).toMatchObject({author:"校合者",result:"mismatch",corrected_text:"修訂候補",image_sha256:f.run.items[0].source.image_sha256});
    expect((await f.api.importOcr(w,f.runPath)).workspace.texts[0].ocr_provenance!.reviews).toHaveLength(1);
    w.regions[0].selection.xywh[0]++;
    expect(()=>recordOcrReview(w,t.text_id,"校合者","match","移動後")).toThrow(/領域/);
    expect(t.ocr_provenance!.reviews).toHaveLength(1);
  });
  it("imports through the CLI into a new workspace while retaining the source workspace",async()=>{
    const f=await fixture(), source=path.join(f.dir,"w.json"), output=path.join(f.dir,"with-ocr.json");
    await saveWorkspace(source,sampleWorkspace());const request=path.join(f.dir,"request.json"), logs:string[]=[];
    await writeFile(request,JSON.stringify({api_version:"0.1",operation:"import_ocr",workspace_path:source,run_path:f.runPath,output_path:output}));
    expect(await runIiifCli(["--request",request],{cwd:f.dir,stdout:s=>logs.push(s),stderr:()=>{}})).toBe(0);
    expect(JSON.parse(logs[0]).result.imported).toBe(1);expect((await readWorkspace(source)).texts).toHaveLength(0);
    expect((await readWorkspace(output)).texts[0].origin).toBe("ocr_candidate");
  });
  it.each(["run.json","input.png","evidence.json","raw/input.txt","original.json","region.png"])("rejects CLI output over an OCR source: %s",async file=>{
    const f=await fixture(),source=path.join(f.dir,"w.json"),target=path.join(f.dir,file),request=path.join(f.dir,"request.json"),logs:string[]=[];
    await writeFile(path.join(f.dir,"original.json"),await readFile(path.join(f.dir,"evidence.json")));
    await writeFile(path.join(f.dir,"region.png"),await readFile(path.join(f.dir,"input.png")));
    await saveWorkspace(source,sampleWorkspace());const before=await readFile(target);
    await writeFile(request,JSON.stringify({api_version:"0.1",operation:"import_ocr",workspace_path:source,run_path:f.runPath,output_path:target,overwrite:true}));
    expect(await runIiifCli(["--request",request],{cwd:f.dir,stdout:s=>logs.push(s),stderr:()=>{}})).toBe(4);
    expect(JSON.parse(logs[0])).toMatchObject({ok:false});expect(await readFile(target)).toEqual(before);
  });
  it("permits explicit in-place workspace update while preserving OCR sources",async()=>{
    const f=await fixture(),source=path.join(f.dir,"w.json"),request=path.join(f.dir,"request.json"),before=await readFile(f.runPath);
    await saveWorkspace(source,sampleWorkspace());await writeFile(request,JSON.stringify({api_version:"0.1",operation:"import_ocr",workspace_path:source,run_path:f.runPath,output_path:source,overwrite:true}));
    expect(await runIiifCli(["--request",request],{cwd:f.dir,stdout:()=>{},stderr:()=>{}})).toBe(0);
    expect((await readWorkspace(source)).texts).toHaveLength(1);expect(await readFile(f.runPath)).toEqual(before);
  });
});
