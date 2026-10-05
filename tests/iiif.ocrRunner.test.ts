import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { digest, ocrSource } from "./fixtures/iiif/ocr.js";
import { runIiifCli } from "../src/iiif/cli.js";
const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function fixture(mode = "ok") {
  const dir = await mkdtemp(path.join(tmpdir(), "iiif-ocr-")); dirs.push(dir);
  const engine = path.join(dir,"engine"), src = path.join(engine,"src"), input = path.join(dir,"evidence");
  await mkdir(path.join(src,"model"), { recursive: true }); await mkdir(path.join(src,"config")); await mkdir(input);
  // 実subprocessで出力と引数を検査するfixture。実モデルは別の公開画像pilotで確認する。
  await writeFile(path.join(src,"ocr.py"), `const fs=require('node:fs'),p=require('node:path');
    const a=process.argv.slice(2), image=a[a.indexOf('--sourceimg')+1], out=a[a.indexOf('--output')+1];
    if(a.includes('--json-only')||a.includes('--viz')||a[a.indexOf('--device')+1]!=='cpu')process.exit(9);
    if(${JSON.stringify(mode)}==='timeout'){setInterval(()=>{},1000);}else{
    const name=p.basename(image).split('.')[0];
    if(${JSON.stringify(mode)}==='fail'){fs.writeFileSync(p.join(out,name+'.xml'),'<partial/>');process.exit(7);}
    if(${JSON.stringify(mode)}!=='empty'){
    fs.writeFileSync(p.join(out,name+'.json'),JSON.stringify({imginfo:{img_width:150,img_height:200,img_path:image},contents:[[{id:0,text:'舊字',confidence:.8,boundingBox:[[0,0],[0,100],[50,0],[50,100]]}]]}));
    fs.writeFileSync(p.join(out,name+'.txt'),'舊字\\n');fs.writeFileSync(p.join(out,name+'.xml'),'<raw/>');}}
  `);
  for (const f of ["model/rtmdet-s-1280x1280.onnx", "model/parseq-ndl-32x384-tiny-10.onnx", "config/ndl.yaml", "config/NDLmoji.yaml"])
    await writeFile(path.join(src,f), "fixture");
  const png = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.write("IHDR",12); png.writeUInt32BE(150,16); png.writeUInt32BE(200,20);
  await writeFile(path.join(input,"region.png"),png);
  const s = ocrSource();
  const evidence = { schema_version: "0.1", workspace_id: s.workspace_id, items: [{ evidence_id: "r1", selection: s.selection,
    source: { document_id:s.document_id, receipt:{sha256:s.manifest_sha256} }, canvas: { canvas_id:s.selection.canvas_id,width:s.canvas_width,height:s.canvas_height },
    crop:{status:"supported",image_xywh:s.original_image_xywh,transform:s.canvas_to_image},
    display_image:{path:"region.png",receipt:{sha256:digest(png)},width:150,height:200,original_image_xywh:s.original_image_xywh,canvas_to_image:s.canvas_to_image,scale_x:s.scale_x,scale_y:s.scale_y},
    image_permission_confirmed:true,text_evidence:[] }] };
  const evidencePath = path.join(input,"evidence.json"); await writeFile(evidencePath,JSON.stringify(evidence));
  const provider = { engine_dir:engine,python_path:process.execPath };
  const api = await import("../src/iiif/ocrRunner.js");
  const inspected = await api.inspectOcrProvider(provider);
  const configPath = path.join(dir,"provider.json"); await writeFile(configPath,JSON.stringify(inspected.config));
  const request = { evidence_path:evidencePath,evidence_ids:["r1"],provider_config_path:configPath,output_dir:path.join(dir,"run"),allow_existing_text:false };
  return {dir,provider,inspected,request,evidence,evidencePath,configPath,api};
}
describe("optional local Koten OCR runner", () => {
  it("exposes provider inspection and a local run through the JSON CLI", async () => {
    const f=await fixture(), outputs:string[]=[];
    const file=path.join(f.dir,"request.json"), io={cwd:f.dir,stdout:(s:string)=>outputs.push(s),stderr:()=>{}};
    await writeFile(file,JSON.stringify({api_version:"0.1",operation:"inspect_ocr_provider",...f.provider}));
    expect(await runIiifCli(["--request",file],io)).toBe(0);
    expect(JSON.parse(outputs.pop()!).result.engine.provider).toBe("ndlkotenocr-lite");
    await writeFile(file,JSON.stringify({api_version:"0.1",operation:"run_ocr",...f.request}));
    expect(await runIiifCli(["--request",file],io)).toBe(0);
    expect(JSON.parse(outputs.pop()!).result.status).toBe("completed");
  });
  it("runs a pinned engine on a local copied image and preserves raw text, files and source hash", async () => {
    const f = await fixture(), original = await readFile(f.evidencePath);
    const result = await f.api.runOcr(f.request), run = JSON.parse(await readFile(result.run_path,"utf8"));
    expect(result.status).toBe("completed"); expect(run.items[0].text).toBe("舊字\n");
    expect(run.items[0].lines[0].canvas_xywh).toEqual([100,200,100,200]);
    expect(run.image_transmission).toBe("none"); expect(run.engine.engine_sha256).toBe(f.inspected.config.expected_engine_sha256);
    expect(run.items[0].artifacts.some((a: any)=>a.path.endsWith(".xml"))).toBe(true);
    expect(await readFile(f.evidencePath)).toEqual(original);
    expect((await readdir(f.request.output_dir)).includes("evidence.json")).toBe(true);
  });
  it("rejects changed engine code before creating an output directory", async () => {
    const f = await fixture(); await writeFile(path.join(f.provider.engine_dir,"src","ocr.py"),"changed");
    await expect(f.api.runOcr(f.request)).rejects.toThrow(/engine.*hash/);
    await expect(readdir(f.request.output_dir)).rejects.toThrow();
  });
  it("returns a CLI runtime error while reporting the retained failed run", async () => {
    const f=await fixture("fail"), outputs:string[]=[];
    const file=path.join(f.dir,"request.json");
    await writeFile(file,JSON.stringify({api_version:"0.1",operation:"run_ocr",...f.request}));
    expect(await runIiifCli(["--request",file],{cwd:f.dir,stdout:s=>outputs.push(s),stderr:()=>{}})).toBe(4);
    expect(JSON.parse(outputs[0])).toMatchObject({ok:false,result:{status:"failed"}});
    expect(JSON.parse(await readFile(JSON.parse(outputs[0]).result.run_path,"utf8")).items[0].error).toBeTruthy();
  });
  it.each(["hash","path","transform","text","duplicate"])("rejects unsafe or redundant input before processing: %s", async (kind) => {
    const f = await fixture(), item = f.evidence.items[0];
    if(kind==="hash")item.display_image.receipt.sha256="f".repeat(64);
    if(kind==="path")item.display_image.path="../provider.json";
    if(kind==="transform")item.display_image.scale_x=1;
    if(kind==="text")(item.text_evidence as unknown[]).push({origin:"provider_annotation",text:"already available"});
    if(kind==="duplicate")f.request.evidence_ids.push("r1");
    await writeFile(f.evidencePath,JSON.stringify(f.evidence));
    await expect(f.api.runOcr(f.request)).rejects.toThrow();
    await expect(readdir(f.request.output_dir)).rejects.toThrow();
  });
  it("preserves previous output and permits an explicit comparison with existing text", async () => {
    const f = await fixture(); (f.evidence.items[0].text_evidence as unknown[]).push({text:"existing"});
    await writeFile(f.evidencePath,JSON.stringify(f.evidence)); f.request.allow_existing_text=true;
    await f.api.runOcr(f.request); const previous=await readFile(path.join(f.request.output_dir,"run.json"));
    await expect(f.api.runOcr(f.request)).rejects.toThrow(/新しい保存先/);
    expect(await readFile(path.join(f.request.output_dir,"run.json"))).toEqual(previous);
  });
  it.each(["fail","empty","timeout"])("records a failed engine and retains partial files: %s", async (mode) => {
    const f = await fixture(mode), config=f.inspected.config; config.timeout_ms=1000;
    await writeFile(f.configPath,JSON.stringify(config));
    const result = await f.api.runOcr(f.request), run=JSON.parse(await readFile(result.run_path,"utf8"));
    expect(result.status).toBe("failed"); expect(run.items[0].error).toBeTruthy();
    expect(run.items[0].artifacts.some((a: any)=>a.path.endsWith("input-1.png"))).toBe(true);
    if(mode==="fail")expect(run.items[0].artifacts.some((a: any)=>a.path.endsWith(".xml"))).toBe(true);
  });
});
