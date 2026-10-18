import { createHash } from "node:crypto";
import { readFile,writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { gpuProbe,gpuWrapper } from "./ocrGpu.js";
import { modalBridge,modalProjectRoot } from "./ocrModalBridge.js";
import { modalMetadataSchema,modalInspectionSchema,modalOcrConfigSchema,modalOcrEngineSchema,modalEngineHash,kotenSourceCommit,type ModalOcrEngine } from "./ocrModalSchemas.js";

const digest=(b:string|Uint8Array)=>createHash("sha256").update(b).digest("hex");
export async function modalAdapterHash(){
  const files=["scripts/iiif-ocr-modal.mjs","packages/iiif-ocr-modal/pyproject.toml","packages/iiif-ocr-modal/uv.lock","packages/iiif-ocr-modal/.python-version",
    ...["__init__.py","__main__.py","contracts.py","cloud.py","worker.py"].map(f=>`packages/iiif-ocr-modal/iiif_ocr_modal/${f}`)];
  const hashes=[];for(const file of files)hashes.push({path:file,sha256:digest(await readFile(path.join(modalProjectRoot(),file)))});
  return digest(JSON.stringify({files:hashes,probe:gpuProbe("/root/kotenocr_cli"),wrapper:gpuWrapper}));
}
const resultSchema=z.object({metadata:modalMetadataSchema,source_commit:z.literal(kotenSourceCommit),image_id:z.string().min(1),engine_sha256:z.string(),gpu_type:z.literal("A10"),
  status:z.enum(["completed","failed"]),files:z.record(z.string()),output_hashes:z.record(z.string()),stdout:z.string().max(1048576),stderr:z.string().max(1048576),error:z.string().nullable(),
  worker_seconds:z.number().finite().nonnegative(),wall_seconds:z.number().finite().nonnegative(),call_id:z.string().min(1),client_version:z.string(),
  resource_cpu:z.literal(2),resource_memory_mib:z.literal(8192),input_sha256:z.string().optional(),input_width:z.number().int().positive().optional(),input_height:z.number().int().positive().optional()});
function resultOf(response:unknown){
  const r=z.object({ok:z.literal(true),result:resultSchema}).parse(response).result;
  if(modalEngineHash(r.image_id,r.metadata)!==r.engine_sha256 || !/^NVIDIA A10G?$/.test(r.metadata.gpu))throw new Error("Modal engineの実体記録が一致しません");
  const names=r.metadata.files.map(f=>f.path);
  if(new Set(names).size!==names.length||names.some(n=>n.startsWith("/")||n.includes("\\")||n.split("/").some(p=>!p||p==="."||p===".."))||
    !["main.py","config.yml","src/ndl_kotenseki_layout/models/ndl_kotenseki_layout_ver3.pth"].every(n=>names.includes(n))||
    !names.some(n=>n.startsWith("src/text_kotenseki_recognition/")&&n.endsWith(".bin")))throw new Error("Modal engine file記録を確認してください");
  return r;
}
export async function inspectModalProvider(input:unknown){
  const options=modalInspectionSchema.parse(input),adapter_sha256=await modalAdapterHash();
  if(typeof input==="object"&&input!==null&&"engine" in input){
    const config=modalOcrConfigSchema.parse(input),engine=config.engine;
    if(config.expected_adapter_sha256!==adapter_sha256||engine.adapter_sha256!==adapter_sha256||config.expected_engine_sha256!==engine.engine_sha256||
      modalEngineHash(engine.image_id,engine)!==engine.engine_sha256)throw new Error("Modal adapter・engineの固定記録が変わりました");
    return {engine,config};
  }
  const {response}=await modalBridge({operation:"inspect",probe_code:gpuProbe("/root/kotenocr_cli"),wrapper_code:gpuWrapper,timeout_seconds:600});
  const r=resultOf(response);if(r.status!=="completed")throw new Error("Modal engineの検査に失敗しました");
  const engine=modalOcrEngineSchema.parse({provider:"ndlkotenocr-modal",runtime:"modal",model_version:"3",source_commit:r.source_commit,
    image_id:r.image_id,engine_sha256:r.engine_sha256,adapter_sha256,...r.metadata});
  return {engine,config:modalOcrConfigSchema.parse({...options,expected_engine_sha256:engine.engine_sha256,expected_adapter_sha256:adapter_sha256,engine})};
}
export async function runModalImage(engine:ModalOcrEngine,imagePath:string,rawDir:string,timeout:number){
  const image=await readFile(imagePath),input_sha256=digest(image);
  const {response,stderr:bridgeLog}=await modalBridge({operation:"run",image_name:path.basename(imagePath),image:image.toString("base64"),image_sha256:input_sha256,
    expected_engine_sha256:engine.engine_sha256,probe_code:gpuProbe("/root/kotenocr_cli"),wrapper_code:gpuWrapper,timeout_seconds:Math.ceil(timeout/1000)});
  await writeFile(path.join(rawDir,"modal-response.json"),JSON.stringify(response)+"\n",{flag:"wx"});
  let r:z.infer<typeof resultSchema>;
  try{r=resultOf(response);}catch(error){throw Object.assign(error as Error,{stderr:bridgeLog});}
  if(Object.keys(r.files).length>8||JSON.stringify(Object.keys(r.files).sort())!==JSON.stringify(Object.keys(r.output_hashes).sort()))throw new Error("Modal原出力の集合が一致しません");
  let total=0;
  for(const [name,encoded] of Object.entries(r.files)){
    if(!/^(?:input-[1-4]\.(?:json|txt)|gpu-validation\.json|gpu-wrapper\.py|opt\.json)$/.test(name))throw new Error("Modal原出力pathを確認してください");
    const bytes=Buffer.from(encoded,"base64");total+=bytes.length;
    if(total>8*1024*1024||digest(bytes)!==r.output_hashes[name])throw new Error("Modal原出力hashが一致しません");
    await writeFile(path.join(rawDir,name),bytes,{flag:"wx"});
  }
  const {files:_files,stdout,stderr,...receipt}=r;
  await writeFile(path.join(rawDir,"modal-receipt.json"),JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
  if(r.engine_sha256!==engine.engine_sha256||r.input_sha256!==input_sha256||r.status!=="completed")
    throw Object.assign(new Error(r.error??"Modal入力・engine記録が一致しません"),{stdout,stderr:stderr+"\n"+bridgeLog});
  return {stdout,stderr:stderr+"\n"+bridgeLog};
}

export function validateModalReceipt(receipt:unknown,engine:ModalOcrEngine,imageHash:string,artifacts:{path:string;sha256:string}[]){
  const r=resultOf({ok:true,result:{...z.record(z.unknown()).parse(receipt),files:{},stdout:"",stderr:""}});
  if(r.status!=="completed"||r.engine_sha256!==engine.engine_sha256||r.input_sha256!==imageHash)
    throw new Error("Modal実行receiptの入力・engineが一致しません");
  for(const [name,hash] of Object.entries(r.output_hashes))
    if(!artifacts.some(a=>path.basename(a.path)===name&&a.sha256===hash))throw new Error("Modal receiptの原出力hashが一致しません");
}
