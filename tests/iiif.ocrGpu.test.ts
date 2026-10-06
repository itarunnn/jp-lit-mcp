import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { digest, ocrSource } from "./fixtures/iiif/ocr.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";

// Docker/GPUは外部process境界だけを代替し、run/import/hash/座標処理は実処理を使う。
const boundary=vi.hoisted(()=>({command:vi.fn()}));
vi.mock("node:child_process",async(importOriginal)=>{
  const original=await importOriginal<typeof import("node:child_process")>();
  const fake=Object.assign(vi.fn(),{[Symbol.for("nodejs.util.promisify.custom")]:boundary.command});
  return {...original,execFile:fake};
});
const dirs:string[]=[];
afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
const imageId="sha256:"+"e".repeat(64);
const metadata={python_version:"3.10.12",torch_version:"2.1.1+cu121",cuda_version:"12.1",gpu:"fixture GPU",files:[
  {path:"main.py",sha256:"1".repeat(64)},{path:"config.yml",sha256:"2".repeat(64)},
  {path:"src/ndl_kotenseki_layout/models/ndl_kotenseki_layout_ver3.pth",sha256:"3".repeat(64)},
  {path:"src/text_kotenseki_recognition/model-ver2/pytorch_model.bin",sha256:"4".repeat(64)},
]};
let mode="ok",lastRunArgs:string[]=[];
beforeEach(()=>{
  mode="ok";lastRunArgs=[];boundary.command.mockReset();
  boundary.command.mockImplementation(async(file:string,args:string[])=>{
    expect(path.isAbsolute(file)).toBe(true);
    expect(args.slice(0,2)).toEqual(["--host",process.platform==="win32"?"npipe:////./pipe/docker_engine":"unix:///var/run/docker.sock"]);
    if(args.includes("inspect"))return {stdout:mode==="image_changed"?"sha256:"+"f".repeat(64):imageId,stderr:""};
    if(args.includes("-c")){
      if(mode==="probe_timeout")throw Object.assign(new Error("GPU probe timeout"),{killed:true});
      return {stdout:JSON.stringify(mode==="weights_changed"?{...metadata,files:metadata.files.map(f=>({...f,sha256:"9".repeat(64)}))}:metadata),stderr:""};
    }
    if(args.includes("rm"))return {stdout:"removed",stderr:""};
    lastRunArgs=args;
    const mounts=args.flatMap((v,i)=>v==="--mount"?[args[i+1]]:[]);
    const out=mounts.find(m=>m.endsWith(",target=/out"))!.slice("type=bind,source=".length,-",target=/out".length);
    await writeFile(path.join(out,"partial.xml"),"<partial/>");
    if(mode==="timeout")throw Object.assign(new Error("GPU timeout"),{killed:true,stdout:"partial stdout",stderr:""});
    const image=mounts.find(m=>m.includes(",target=/input/"))!;
    const name=path.basename(image.slice("type=bind,source=".length).split(",target=")[0]).split(".")[0];
    const result=path.join(out,"results",name);
    await mkdir(path.join(result,"json"),{recursive:true});await mkdir(path.join(result,"txt"));
    if(mode!=="missing"){
      await writeFile(path.join(result,"json",`${name}.json`),JSON.stringify({imginfo:{img_name:name+".png",img_width:mode==="dimensions"?151:150,img_height:200},contents:[[0,0,50,100,"舊字"]]}));
      await writeFile(path.join(result,"txt",`${name}_main.txt`),mode==="text_mismatch"?"別文\n":"舊字\n");
    }
    await writeFile(path.join(out,"gpu-validation.json"),JSON.stringify({status:"completed",expected_lines:mode==="line_omission"?2:1,returned_lines:1}));
    return {stdout:"fixture GPU completed",stderr:""};
  });
});
async function fixture(){
  const dir=await mkdtemp(path.join(tmpdir(),"iiif-gpu-"));dirs.push(dir);
  const input=path.join(dir,"evidence");await mkdir(input);
  const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write("IHDR",12);png.writeUInt32BE(150,16);png.writeUInt32BE(200,20);
  await writeFile(path.join(input,"region.png"),png);
  const s=ocrSource();
  const evidence={schema_version:"0.1",workspace_id:s.workspace_id,items:[{evidence_id:s.evidence_id,selection:s.selection,
    source:{document_id:s.document_id,receipt:{sha256:s.manifest_sha256}},canvas:{canvas_id:s.selection.canvas_id,width:s.canvas_width,height:s.canvas_height},
    crop:{status:"supported",image_xywh:s.original_image_xywh,transform:s.canvas_to_image},image_permission_confirmed:true,text_evidence:[],
    display_image:{path:"region.png",receipt:{sha256:digest(png)},width:150,height:200,original_image_xywh:s.original_image_xywh,canvas_to_image:s.canvas_to_image,scale_x:s.scale_x,scale_y:s.scale_y}}]};
  const evidencePath=path.join(input,"evidence.json");await writeFile(evidencePath,JSON.stringify(evidence));
  const {inspectOcrProvider,runOcr}=await import("../src/iiif/ocrRunner.js");
  const inspected=await inspectOcrProvider({provider:"ndlkotenocr-ver3",docker_path:process.execPath,image_id:imageId} as any);
  const configPath=path.join(dir,"provider.json");await writeFile(configPath,JSON.stringify(inspected.config));
  return {dir,inspected,runOcr,request:{evidence_path:evidencePath,evidence_ids:["r1"],provider_config_path:configPath,output_dir:path.join(dir,"run"),allow_existing_text:false}};
}
describe("optional immutable local GPU provider",()=>{
  it("stops its inspection container after a probe timeout",async()=>{
    const f=await fixture();boundary.command.mockClear();mode="probe_timeout";
    const {inspectOcrProvider}=await import("../src/iiif/ocrRunner.js");
    await expect(inspectOcrProvider({provider:"ndlkotenocr-ver3",docker_path:process.execPath,image_id:imageId})).rejects.toThrow(/probe timeout/);
    const launch=boundary.command.mock.calls.find(([,args])=>args.includes("-c"))![1];
    const cleanup=boundary.command.mock.calls.find(([,args])=>args.includes("rm"))?.[1];
    expect(cleanup?.slice(2)).toEqual(["container","rm","--force",launch[launch.indexOf("--name")+1]]);
  });
  it("runs and imports GPU output with original provider, raw files and Canvas coordinates",async()=>{
    const f=await fixture();const result=await f.runOcr(f.request);
    expect(result).toMatchObject({status:"completed",completed:1,failed:0});
    const run=JSON.parse(await readFile(result.run_path,"utf8"));
    expect(run).toMatchObject({device:"cuda",image_transmission:"none",engine:{provider:"ndlkotenocr-ver3",runtime:"docker",image_id:imageId,files:metadata.files},items:[{text:"舊字\n",lines:[{canvas_xywh:[100,200,100,200],detection_confidence:null}]}]});
    expect(lastRunArgs).toContain("never");expect(lastRunArgs).toContain("none");
    const inputMount=lastRunArgs.find(a=>a.includes(",target=/input/"));expect(inputMount).toMatch(/,readonly$/);
    const {importOcr}=await import("../src/iiif/ocrImport.js");
    const imported=(await importOcr(sampleWorkspace(),result.run_path)).workspace;
    expect(imported.texts[0]).toMatchObject({text:"舊字\n",verification_state:"unverified",ocr_provenance:{engine:{provider:"ndlkotenocr-ver3"}}});
    expect(imported.texts[0].ocr_provenance!.artifacts.some(a=>a.path.endsWith("gpu-validation.json"))).toBe(true);
    const again=await importOcr(imported,result.run_path);expect(again.imported).toBe(0);
  });
  it.each(["image_changed","weights_changed"])("rejects changed immutable engine before creating output: %s",async value=>{
    const f=await fixture();mode=value;
    await expect(f.runOcr(f.request)).rejects.toThrow(/image|engine.*hash/);
    await expect(readFile(path.join(f.request.output_dir,"run.json"))).rejects.toThrow();
  });
  it.each(["missing","dimensions","text_mismatch","line_omission"])("retains a failed run for incomplete or mismatched outputs despite process exit zero: %s",async value=>{
    const f=await fixture();mode=value;const result=await f.runOcr(f.request);
    expect(result.status).toBe("failed");const run=JSON.parse(await readFile(result.run_path,"utf8"));
    expect(run.items[0].text).toBeNull();expect(run.items[0].error).toBeTruthy();
    expect(run.items[0].artifacts.some((a:any)=>a.path.endsWith("gpu-validation.json"))).toBe(true);
  });
  it("stops only its own container after timeout and retains partial output",async()=>{
    const f=await fixture();mode="timeout";const result=await f.runOcr(f.request);
    expect(result.status).toBe("failed");const calls=boundary.command.mock.calls;
    const launch=calls.find(([,args])=>args.includes("--mount"))![1];
    const cleanup=calls.find(([,args])=>args.includes("rm"))![1];
    expect(cleanup.slice(2)).toEqual(["container","rm","--force",launch[launch.indexOf("--name")+1]]);
    expect(await readFile(path.join(f.request.output_dir,"item-1","partial.xml"),"utf8")).toBe("<partial/>");
  });
  it("rejects changed raw GPU text during import",async()=>{
    const f=await fixture();const result=await f.runOcr(f.request);
    const run=JSON.parse(await readFile(result.run_path,"utf8"));
    const txt=run.items[0].artifacts.find((a:any)=>a.path.endsWith("_main.txt"));
    await writeFile(path.join(f.request.output_dir,txt.path),"変更\n");
    const {importOcr}=await import("../src/iiif/ocrImport.js");await expect(importOcr(sampleWorkspace(),result.run_path)).rejects.toThrow(/hash/);
  });
});
