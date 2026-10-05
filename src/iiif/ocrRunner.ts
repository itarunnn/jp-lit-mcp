import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, realpath, readdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { atomicWrite } from "./workspace.js";
import { imageDimensions } from "./imageMetadata.js";
import { normalizeKotenOutput, validateOcrSource } from "./ocr.js";
import { ocrAbsoluteSchema, ocrConfigSchema, ocrEngineSchema, ocrHashSchema, ocrRunSchema, type OcrRun } from "./ocrSchemas.js";
const exec = promisify(execFile);
export const ocrDigest = (b: string | Uint8Array) => createHash("sha256").update(b).digest("hex");
const same = (a: unknown,b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const inside = (root: string,file: string) => { const r=path.relative(root,file); return r !== ".." && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r); };
const localEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(systemroot|windir|path|temp|tmp|pathext|systemdrive)$/i.test(k)).concat([["PYTHONUTF8","1"],["PYTHONIOENCODING","utf-8"],["PYTHONNOUSERSITE","1"]]));
export async function readOcrFile(file: string, maxBytes = 10*1024*1024): Promise<Buffer> {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) throw new Error("OCR fileの形式・容量を確認してください");
  const bytes=await readFile(file);
  if(bytes.length > maxBytes)throw new Error("OCR file容量が上限を超えます");
  return bytes;
}
export async function resolveOcrArtifact(root: string, relative: string): Promise<string> {
  if (path.isAbsolute(relative) || relative.includes("\\") || relative.split("/").some((p) => !p || p === "." || p === ".."))
    throw new Error("OCR fileの局所pathを指定してください");
  const base = await realpath(root), file=path.resolve(base,relative), resolved=await realpath(file);
  if(!inside(base,file) || !inside(base,resolved) || resolved !== file)throw new Error("OCR fileが保存先の外にあります");
  return file;
}
async function hashFile(file: string) {
  const stat=await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512*1024*1024) throw new Error("OCR engine fileの形式・容量を確認してください");
  const hash=createHash("sha256");
  for await(const chunk of createReadStream(file))hash.update(chunk);
  return hash.digest("hex");
}
export async function inspectOcrProvider(input: { engine_dir:string; python_path:string }) {
  const parsed=z.object({engine_dir:ocrAbsoluteSchema,python_path:ocrAbsoluteSchema}).parse(input);
  const engine_dir=await realpath(parsed.engine_dir), python_path=await realpath(parsed.python_path);
  if(!(await lstat(python_path)).isFile())throw new Error("Python実行fileを指定してください");
  const files: Array<{path:string;sha256:string}> = [];
  async function walk(dir:string) {
    for(const name of (await readdir(dir)).sort()) {
      if(name === "__pycache__")continue;
      const file=path.join(dir,name), stat=await lstat(file);
      if(stat.isSymbolicLink())throw new Error("OCR engineのsymbolic linkは扱えません");
      if(stat.isDirectory())await walk(file);
      else if(/\.(py|yaml|yml|onnx)$/i.test(name)) {
        if(files.length >= 1000)throw new Error("OCR engine file数が上限を超えます");
        files.push({path:path.relative(engine_dir,file).split(path.sep).join("/"),sha256:await hashFile(file)});
      }
    }
  }
  await walk(path.join(engine_dir,"src"));
  for(const required of ["src/ocr.py","src/model/rtmdet-s-1280x1280.onnx","src/model/parseq-ndl-32x384-tiny-10.onnx","src/config/ndl.yaml","src/config/NDLmoji.yaml"])
    if(!files.some((f)=>f.path===required))throw new Error(`OCR engine fileを確認してください: ${required}`);
  files.sort((a,b)=>a.path.localeCompare(b.path,"en"));
  const engine_sha256=ocrDigest(JSON.stringify(files));
  const version=await exec(python_path,["--version"],{shell:false,windowsHide:true,env:localEnv(),timeout:15000,maxBuffer:65536,encoding:"utf8"});
  const engine=ocrEngineSchema.parse({provider:"ndlkotenocr-lite",engine_dir,python_path,python_version:version.stdout.trim() || version.stderr.trim(),engine_sha256,files});
  return {engine,config:ocrConfigSchema.parse({provider:engine.provider,engine_dir,python_path,expected_engine_sha256:engine_sha256})};
}
const itemSchema=z.object({
  evidence_id:z.string(), selection:z.unknown(), source:z.object({document_id:z.string(),receipt:z.object({sha256:ocrHashSchema})}),
  canvas:z.object({canvas_id:z.string(),width:z.number(),height:z.number()}),
  crop:z.object({status:z.literal("supported"),image_xywh:z.unknown(),transform:z.unknown()}),
  display_image:z.object({path:z.string(),receipt:z.object({sha256:ocrHashSchema}),width:z.number(),height:z.number(),
    original_image_xywh:z.unknown(),canvas_to_image:z.unknown(),scale_x:z.number(),scale_y:z.number()}),
  image_permission_confirmed:z.literal(true), text_evidence:z.array(z.unknown()).default([]), tei_evidence:z.array(z.unknown()).default([]),
});
export const ocrEvidenceSchema=z.object({schema_version:z.literal("0.1"),workspace_id:z.string(),items:z.array(z.unknown()).max(4)});
export function ocrSourceFromEvidenceItem(input:unknown,workspaceId:string) {
  const item=itemSchema.parse(input), display=item.display_image;
  if(!same(display.original_image_xywh,item.crop.image_xywh) || !same(display.canvas_to_image,item.crop.transform))throw new Error("evidence画像取得記録のcrop・変換が一致しません");
  const source=validateOcrSource({workspace_id:workspaceId,document_id:item.source.document_id,manifest_sha256:item.source.receipt.sha256,
    evidence_id:item.evidence_id,selection:item.selection,canvas_width:item.canvas.width,canvas_height:item.canvas.height,image_sha256:display.receipt.sha256,
    image_width:display.width,image_height:display.height,original_image_xywh:display.original_image_xywh,canvas_to_image:display.canvas_to_image,scale_x:display.scale_x,scale_y:display.scale_y});
  if(source.selection.canvas_id!==item.canvas.canvas_id)throw new Error("evidenceのOCR出典Canvasが一致しません");
  return source;
}
export async function runOcr(request: { evidence_path:string; evidence_ids:string[]; provider_config_path:string; output_dir:string; allow_existing_text:boolean }) {
  for(const file of [request.evidence_path,request.provider_config_path,request.output_dir])ocrAbsoluteSchema.parse(file);
  if(!request.evidence_ids.length || request.evidence_ids.length > 4 || new Set(request.evidence_ids).size !== request.evidence_ids.length)
    throw new Error("OCR領域IDを重複なしで1〜4件指定してください");
  const config=ocrConfigSchema.parse(JSON.parse((await readOcrFile(request.provider_config_path,1024*1024)).toString("utf8").replace(/^\uFEFF/,"")));
  const {engine}=await inspectOcrProvider(config);
  if(engine.engine_sha256 !== config.expected_engine_sha256)throw new Error("OCR engineのhashが一致しません。変更内容を確認して再固定してください");
  if(inside(engine.engine_dir,path.resolve(request.output_dir)))throw new Error("OCR出力をengineの外へ保存してください");
  const evidenceBytes=await readOcrFile(request.evidence_path), evidence=ocrEvidenceSchema.parse(JSON.parse(evidenceBytes.toString("utf8").replace(/^\uFEFF/,"")));
  const ids=evidence.items.map((item)=>z.object({evidence_id:z.string()}).parse(item).evidence_id);
  if(new Set(ids).size !== ids.length)throw new Error("evidence領域IDの重複があります");
  const inputs=[];
  for(const id of request.evidence_ids) {
    const index=ids.indexOf(id); if(index<0)throw new Error("OCR領域IDが見つかりません");
    const item=itemSchema.parse(evidence.items[index]), display=item.display_image;
    if(item.text_evidence.length && !request.allow_existing_text)throw new Error("既存テキストがあります。比較目的の場合はallow_existing_textを指定してください");
    if(item.tei_evidence.length && !request.allow_existing_text)throw new Error("既存TEI併読情報があります。比較目的の場合はallow_existing_textを指定してください");
    const imagePath=await resolveOcrArtifact(path.dirname(request.evidence_path),display.path), bytes=await readOcrFile(imagePath), dim=imageDimensions(bytes);
    if(ocrDigest(bytes)!==display.receipt.sha256)throw new Error("OCR入力画像のhashが一致しません");
    if(dim.width !== display.width || dim.height !== display.height || dim.width*dim.height>16000000)throw new Error("OCR入力画像の寸法が一致しません");
    const source=ocrSourceFromEvidenceItem(item,evidence.workspace_id);
    inputs.push({source,bytes,format:dim.format});
  }
  await mkdir(path.dirname(request.output_dir),{recursive:true});
  try { await mkdir(request.output_dir); } catch(error) { if((error as NodeJS.ErrnoException).code==="EEXIST")throw new Error("OCRには新しい保存先を指定してください"); throw error; }
  const outputRoot=await realpath(request.output_dir), runPath=path.join(outputRoot,"run.json");
  await writeFile(path.join(outputRoot,"evidence.json"),evidenceBytes,{flag:"wx"});
  const run:OcrRun={schema_version:"0.1",run_id:randomUUID(),status:"running",image_transmission:"none",device:"cpu",engine,
    evidence_path:await realpath(request.evidence_path),evidence_sha256:ocrDigest(evidenceBytes),items:[],requested_evidence_ids:[...request.evidence_ids],active_evidence_id:request.evidence_ids[0]};
  await atomicWrite(runPath,JSON.stringify(ocrRunSchema.parse(run),null,2)+"\n",false);
  for(const [index,input] of inputs.entries()) {
    const name=`input-${index+1}`, imagePath=path.join(outputRoot,`${name}.${input.format}`), rawDir=path.join(outputRoot,`item-${index+1}`);
    await writeFile(imagePath,input.bytes,{flag:"wx"}); await mkdir(rawDir);
    const started=Date.now(), started_at=new Date(started).toISOString();
    let text:string|null=null,lines:OcrRun["items"][number]["lines"]=[],error:string|null=null,stdout="",stderr="";
    try {
      const result=await exec(engine.python_path,[path.join(engine.engine_dir,"src","ocr.py"),"--sourceimg",imagePath,"--output",rawDir,"--device","cpu"],
        {cwd:path.join(engine.engine_dir,"src"),env:localEnv(),shell:false,windowsHide:true,timeout:config.timeout_ms,killSignal:"SIGKILL",maxBuffer:1024*1024,encoding:"utf8"});
      stdout=result.stdout; stderr=result.stderr;
      const json=JSON.parse((await readOcrFile(await resolveOcrArtifact(rawDir,`${name}.json`))).toString("utf8"));
      lines=normalizeKotenOutput(json,input.source);
      text=(await readOcrFile(await resolveOcrArtifact(rawDir,`${name}.txt`),2*1024*1024)).toString("utf8");
      if(!lines.length && text.trim())throw new Error("OCR行座標と本文が一致しません");
    } catch(e) {
      const failure=e as Error & {stdout?:string;stderr?:string};
      error=failure.message; stdout=failure.stdout??stdout; stderr=failure.stderr??stderr; text=null; lines=[];
    }
    await writeFile(path.join(rawDir,"stdout.log"),stdout,{flag:"wx"}); await writeFile(path.join(rawDir,"stderr.log"),stderr,{flag:"wx"});
    const artifacts=[{path:path.basename(imagePath),sha256:input.source.image_sha256}];
    for(const file of [`${name}.json`,`${name}.txt`,`${name}.xml`,`${name}_tei.xml`,"stdout.log","stderr.log"]) {
      try {
        const resolved=await resolveOcrArtifact(rawDir,file);
        artifacts.push({path:`item-${index+1}/${file}`,sha256:ocrDigest(await readOcrFile(resolved))});
      } catch(e) { if((e as NodeJS.ErrnoException).code!=="ENOENT") {error=error??(e as Error).message; text=null;lines=[];} }
    }
    run.items.push({status:error?"failed":"completed",source:input.source,started_at,finished_at:new Date().toISOString(),duration_ms:Date.now()-started,
      artifacts,text,lines,diagnostics:lines.length?[]:["認識行なし。原出力と画像を確認してください"],error});
    const successes=run.items.filter((i)=>i.status==="completed").length;
    run.active_evidence_id=inputs[index+1]?.source.evidence_id??null;
    run.status=index+1<inputs.length?"running":successes===inputs.length?"completed":successes?"partial":"failed";
    await atomicWrite(runPath,JSON.stringify(ocrRunSchema.parse(run),null,2)+"\n",true);
  }
  return {run_path:runPath,status:run.status,completed:run.items.filter((i)=>i.status==="completed").length,failed:run.items.filter((i)=>i.status==="failed").length};
}
