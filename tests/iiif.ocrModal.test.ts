import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runIiifCli } from "../src/iiif/cli.js";
import { digest, ocrSource } from "./fixtures/iiif/ocr.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { readWorkspace, saveWorkspace } from "../src/iiif/workspace.js";

const external = vi.hoisted(()=>({ requests: [] as any[], changeEngine:false, failed:false, dropped:false, inspectionFailure:null as null|"remote"|"transport" }));
vi.mock("../src/iiif/ocrModalBridge.js",async importOriginal=>({...await importOriginal<typeof import("../src/iiif/ocrModalBridge.js")>(),modalBridge:async (payload:any)=>{
  const { createHash }=await import("node:crypto");
  const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
  external.requests.push(payload);
  if(payload.operation==="inspect"&&external.inspectionFailure){
    const stderr="Modal call fc-inspect-owned\n"+(external.inspectionFailure==="remote"?"Modal call cancelled fc-inspect-owned\n":"")+"private SDK context token=do-not-expose\n";
    if(external.inspectionFailure==="transport")throw Object.assign(new Error("invalid JSON"),{stdout:'{"partial":',stderr});
    return {response:{ok:false,error:"FunctionTimeoutError"},stderr};
  }
  const metadata={python_version:"3.10.20",torch_version:"2.1.1",cuda_version:"12.1",gpu:"NVIDIA A10",files:[
    {path:"main.py",sha256:"a".repeat(64)},{path:"config.yml",sha256:"b".repeat(64)},
    {path:"src/ndl_kotenseki_layout/models/ndl_kotenseki_layout_ver3.pth",sha256:"c".repeat(64)},
    {path:"src/text_kotenseki_recognition/model/pytorch_model.bin",sha256:"d".repeat(64)},
  ]};
  const result:any={metadata,source_commit:"939cbfaf617eb8fd7e54cf1daeb66fb5a92749ec",image_id:"im-fixture",gpu_type:"A10",status:external.failed?"failed":"completed",
    files:{},output_hashes:{},stdout:"",stderr:"",error:external.failed?"OCR timeout":null,worker_seconds:2,
    call_id:"fc-fixture",client_version:"1.5.1",wall_seconds:3,resource_cpu:2,resource_memory_mib:8192};
  const {gpu:_gpu,...modelMetadata}=metadata;
  result.engine_sha256=hash(JSON.stringify({source_commit:result.source_commit,image_id:result.image_id,metadata:modelMetadata}));
  if(payload.operation==="run") {
    result.input_sha256=external.changeEngine?"f".repeat(64):payload.image_sha256;result.input_width=150;result.input_height=200;
    const raw={imginfo:{img_width:150,img_height:200,img_name:payload.image_name},contents:[[0,0,50,100,"舊字"]]};
    const values:Record<string,string>={"input-1.json":JSON.stringify(raw),"input-1.txt":"舊字\n","gpu-wrapper.py":payload.wrapper_code,
      "gpu-validation.json":JSON.stringify({status:"completed",expected_lines:external.dropped?2:1,returned_lines:1}),"opt.json":"{}"};
    for(const [name,text] of Object.entries(values)){result.files[name]=Buffer.from(text).toString("base64");result.output_hashes[name]=hash(text);}
  }
  return {response:{ok:true,result},stderr:"Modal fixture: external transport only"};
}}));

const dirs:string[]=[];
afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});external.requests=[];external.changeEngine=false;external.failed=false;external.dropped=false;external.inspectionFailure=null;});
async function cli(input:unknown){
  const cwd=await mkdtemp(path.join(tmpdir(),"modal-request-"));dirs.push(cwd);await writeFile(path.join(cwd,"request.json"),JSON.stringify(input));
  let stdout="";const code=await runIiifCli(["--request","request.json"],{cwd,stdout:s=>{stdout+=s;},stderr:()=>{}});
  return {code,...JSON.parse(stdout)};
}
async function fixture(){
  const dir=await mkdtemp(path.join(tmpdir(),"modal-ocr-"));dirs.push(dir);const evidenceDir=path.join(dir,"evidence");await mkdir(evidenceDir);
  const image=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(image);image.write("IHDR",12);image.writeUInt32BE(150,16);image.writeUInt32BE(200,20);
  await writeFile(path.join(evidenceDir,"region.png"),image);const source={...ocrSource(),image_sha256:digest(image)};
  const evidence=path.join(evidenceDir,"evidence.json");await writeFile(evidence,JSON.stringify({schema_version:"0.1",workspace_id:"w1",items:[{
    evidence_id:"r1",selection:source.selection,source:{document_id:"d1",receipt:{sha256:"a".repeat(64)}},canvas:{canvas_id:source.selection.canvas_id,width:1000,height:2000},
    crop:{status:"supported",image_xywh:source.original_image_xywh,transform:source.canvas_to_image},image_permission_confirmed:true,
    display_image:{path:"region.png",receipt:{sha256:digest(image)},width:150,height:200,original_image_xywh:source.original_image_xywh,canvas_to_image:source.canvas_to_image,scale_x:.25,scale_y:.25},
  }]}));
  const inspected=await cli({api_version:"0.1",operation:"inspect_ocr_provider",provider:"ndlkotenocr-modal",approved_image_sha256:[digest(image)]});
  expect(inspected.code,JSON.stringify(inspected)).toBe(0);const config=path.join(dir,"provider.json");await writeFile(config,JSON.stringify(inspected.result.config));
  const run=()=>cli({api_version:"0.1",operation:"run_ocr",evidence_path:evidence,evidence_ids:["r1"],provider_config_path:config,output_dir:path.join(dir,"run")});
  return {dir,image,evidence,config,inspected,run};
}

describe("Modal classical OCR provider",()=>{
  it.each(["remote","transport"] as const)("returns safe inspection diagnostics for a %s failure",async failure=>{
    external.inspectionFailure=failure;
    const response=await cli({api_version:"0.1",operation:"inspect_ocr_provider",provider:"ndlkotenocr-modal",approved_image_sha256:["a".repeat(64)]});
    expect(response.code).toBe(4);
    expect(response.diagnostics).toEqual({provider:"ndlkotenocr-modal",call_id:"fc-inspect-owned",error_type:failure==="remote"?"FunctionTimeoutError":null,cancellation_confirmed:failure==="remote"});
    expect(JSON.stringify(response)).not.toMatch(/do-not-expose|private SDK context|partial/);
  });
  it("imports cloud output offline and exports its exact line text and Canvas location to TEI",async()=>{
    const f=await fixture(),result=await f.run();expect(result.code,JSON.stringify(result)).toBe(0);
    const run=JSON.parse(await readFile(result.result.run_path,"utf8"));expect(run).toMatchObject({image_transmission:"modal",device:"cuda",status:"completed",engine:{provider:"ndlkotenocr-modal",gpu:"NVIDIA A10"}});
    expect(run.items[0].lines[0].canvas_xywh).toEqual([100,200,100,200]);
    expect(await readFile(path.join(f.dir,"run/input-1.png"))).toEqual(f.image);
    const saved=path.join(f.dir,"workspace.json"),output=path.join(f.dir,"imported.json");await saveWorkspace(saved,sampleWorkspace(),false);
    const imported=await cli({api_version:"0.1",operation:"import_ocr",workspace_path:saved,run_path:result.result.run_path,output_path:output});expect(imported.code,JSON.stringify(imported)).toBe(0);
    const before=external.requests.length,w=await readWorkspace(output);
    const exported=await cli({api_version:"0.1",operation:"export_ocr_tei",workspace_path:output,text_ids:[w.texts[0].text_id],output_dir:path.join(f.dir,"tei")});
    expect(exported.code,JSON.stringify(exported)).toBe(0);expect(external.requests).toHaveLength(before);
    const index=JSON.parse(await readFile(exported.result.index_path,"utf8"));expect(index.items[0].lines[0]).toMatchObject({text:"舊字",canvas_xywh:[100,200,100,200]});
    await writeFile(path.join(f.dir,"run/item-1/input-1.json"),"{}");
    expect((await cli({api_version:"0.1",operation:"import_ocr",workspace_path:saved,run_path:result.result.run_path,output_path:path.join(f.dir,"tampered.json")})).code).not.toBe(0);
  });
  it.each(["scope","adapter"])("rejects %s drift before any further cloud call",async kind=>{
    const f=await fixture(),config=JSON.parse(await readFile(f.config,"utf8"));
    if(kind==="scope")config.approved_image_sha256=["e".repeat(64)];else config.expected_adapter_sha256="f".repeat(64);
    await writeFile(f.config,JSON.stringify(config));const before=external.requests.length;
    expect((await f.run()).code).not.toBe(0);expect(external.requests).toHaveLength(before);await expect(access(path.join(f.dir,"run"))).rejects.toThrow();
  });
  it.each(["input","remote_failure","dropped_lines"])("keeps raw evidence and rejects a bad %s result",async kind=>{
    const f=await fixture();external.changeEngine=kind==="input";external.failed=kind==="remote_failure";external.dropped=kind==="dropped_lines";
    const result=await f.run();expect(result.code).toBe(4);const run=JSON.parse(await readFile(result.result.run_path,"utf8"));
    expect(run.items[0]).toMatchObject({status:"failed",text:null,lines:[]});await access(path.join(f.dir,"run/item-1/modal-response.json"));
  });
  it("rejects a mismatched cloud receipt even when its artifact hash was updated",async()=>{
    const f=await fixture(),result=await f.run();expect(result.code).toBe(0);
    const receiptPath=path.join(f.dir,"run/item-1/modal-receipt.json"),receipt=JSON.parse(await readFile(receiptPath,"utf8"));
    receipt.input_sha256="e".repeat(64);const bytes=JSON.stringify(receipt);await writeFile(receiptPath,bytes);
    const run=JSON.parse(await readFile(result.result.run_path,"utf8"));run.items[0].artifacts.find((a:any)=>a.path.endsWith("modal-receipt.json")).sha256=digest(bytes);
    await writeFile(result.result.run_path,JSON.stringify(run));const w=path.join(f.dir,"workspace.json");await saveWorkspace(w,sampleWorkspace(),false);
    const imported=await cli({api_version:"0.1",operation:"import_ocr",workspace_path:w,run_path:result.result.run_path,output_path:path.join(f.dir,"bad.json")});
    expect(imported.code).not.toBe(0);
  });
});
