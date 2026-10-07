import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir,mkdtemp,lstat,readFile,writeFile,rename,rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify,isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { imageReferenceSchema,imageComparisonReportSchema,imageComparisonRecordSchema,type ImageComparisonRecord,type ImageComparisonInput,type ImageReference } from "./imageComparisonSchemas.js";
import { ocrSourceFromEvidenceItem,ocrEvidenceSchema,readOcrFile,ocrDigest,resolveOcrArtifact } from "./ocrRunner.js";
import { validateOcrSource } from "./ocr.js";
import { imageDimensions } from "./imageMetadata.js";
import { protectWorkspaceSources,assertDistinctOutput } from "./outputProtection.js";
import { validateWorkspace } from "./schemas.js";
import { assertComparisonSource,mergeComparison } from "./image-comparison-state.mjs";
import type { IiifWorkspace } from "./types.js";
const exec=promisify(execFile),parse=(b:Buffer)=>JSON.parse(b.toString("utf8").replace(/^\uFEFF/,""));
async function runtime(){
 for(const url of [new URL("../../scripts/iiif-images.mjs",import.meta.url),new URL("../../../scripts/iiif-images.mjs",import.meta.url)]){
  const launcher=fileURLToPath(url);try{if((await lstat(launcher)).isFile()){
   const project=path.resolve(path.dirname(launcher),"../packages/iiif-image-analysis"),parts=[];
   for(const file of ["pyproject.toml","uv.lock","iiif_image/__init__.py","iiif_image/__main__.py","iiif_image/analysis.py"])parts.push({path:file,sha256:ocrDigest(await readFile(path.join(project,file)))});
   return {launcher,project,engine_sha256:ocrDigest(JSON.stringify(parts))};
  }}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
 }throw Error("同梱の画像解析moduleを確認してください");
}
async function savedImage(workspace:IiifWorkspace,reference:ImageReference){
 const ref=imageReferenceSchema.parse(reference),evidenceBytes=await readOcrFile(ref.evidence_path,2*1024*1024),evidence=ocrEvidenceSchema.parse(parse(evidenceBytes));
 const matches=evidence.items.filter(item=>(item as {evidence_id?:unknown}).evidence_id===ref.evidence_id);
 if(matches.length!==1)throw Error("保存済み画像の領域IDを1件指定してください");
 const item=matches[0] as {display_image:{path:string};source:{rights?:unknown[]}},source=ocrSourceFromEvidenceItem(item,evidence.workspace_id);
 const {doc}=assertComparisonSource(workspace,source);
 if(source.selection.rotation_degrees!==0)throw Error("回転0度で保存した領域画像を指定してください");
 const imagePath=await resolveOcrArtifact(path.dirname(ref.evidence_path),item.display_image.path),bytes=await readOcrFile(imagePath),dim=imageDimensions(bytes);
 if(ocrDigest(bytes)!==source.image_sha256)throw Error("原画像hashが一致しません");
 if(dim.width!==source.image_width||dim.height!==source.image_height||dim.width*dim.height>16000000)throw Error("原画像寸法が一致しません");
 const input:ImageComparisonInput={evidence_path:ref.evidence_path,evidence_sha256:ocrDigest(evidenceBytes),image_path:imagePath,source,
  attribution:{manifest_url:doc.candidate.manifest_url,record_url:doc.candidate.record_url,label:doc.label.flatMap(l=>l.values).join(" / "),rights:item.source.rights??doc.rights}};
 return {input,bytes,format:dim.format};
}
export async function compareImages(workspace:IiifWorkspace,query:ImageReference,candidates:ImageReference[],outputDir:string):Promise<ImageComparisonRecord>{
 const w=validateWorkspace(workspace),refs=[imageReferenceSchema.parse(query),...z.array(imageReferenceSchema).min(1).max(20).parse(candidates)];
 if(new Set(refs.map(r=>r.evidence_id)).size!==refs.length)throw Error("queryと候補の領域IDを重複なしで指定してください");
 if(!path.isAbsolute(outputDir))throw Error("絶対pathの保存先を指定してください");
 const inputs=await Promise.all(refs.map(ref=>savedImage(w,ref))),engine=await runtime();
 await protectWorkspaceSources(outputDir,w,[engine.project,...inputs.flatMap(v=>[v.input.evidence_path,v.input.image_path])]);
 try{await lstat(outputDir);throw Error("新しい保存先directoryを指定してください");}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
 await mkdir(path.dirname(outputDir),{recursive:true});const stage=await mkdtemp(path.join(path.dirname(outputDir),".images-")),started=Date.now();
 try{
  const workerInputs=[];
  for(const [i,item] of inputs.entries()){
   const file=path.join(stage,`input-${i+1}.${item.format}`);await writeFile(file,item.bytes,{flag:"wx"});
   workerInputs.push({id:item.input.source.selection.region_id,image_path:file,sha256:item.input.source.image_sha256,width:item.input.source.image_width,height:item.input.source.image_height});
  }
  const requestPath=path.join(stage,"request.json");await writeFile(requestPath,JSON.stringify({query:workerInputs[0],candidates:workerInputs.slice(1),output_dir:path.join(stage,"analysis")}));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(systemroot|windir|path|temp|tmp|pathext|systemdrive|UV_CACHE_DIR|JP_LIT_IMAGE_ENVIRONMENT)$/i.test(key)).concat([["PYTHONUTF8","1"],["PYTHONIOENCODING","utf-8"],["PYTHONNOUSERSITE","1"]]));
  let stdout:string;try{({stdout}=await exec(process.execPath,[engine.launcher,"--request",requestPath],{env,shell:false,windowsHide:true,timeout:300000,maxBuffer:2*1024*1024,encoding:"utf8"}));}
  catch{throw Error("ローカル画像解析に失敗しました。uv/Python3.13の環境と保存済み画像を確認してください。初回はnode scripts/iiif-images.mjs --setupで準備します。");}
  const response=parse(Buffer.from(stdout));if(response.ok!==true)throw Error("画像解析の応答が成功していません");
  const result=response.result,convert=(a:{path:string;sha256:string})=>({...a,path:`analysis/${a.path}`});
  const report=imageComparisonReportSchema.parse({schema_version:"0.1",report_id:randomUUID(),created_at:new Date().toISOString(),image_transmission:"none",algorithm:"orb_affine_v1",transform_direction:"candidate_to_query",
   engine:{...result.engine,engine_sha256:engine.engine_sha256},settings:result.settings,query:{...result.query,artifact:convert(result.query.artifact),input:inputs[0].input},
   candidates:result.candidates.map((candidate:{id:string;artifacts:Record<string,{path:string;sha256:string}>})=>({...candidate,
    input:inputs.find(v=>v.input.source.selection.region_id===candidate.id)?.input,artifacts:Object.fromEntries(Object.entries(candidate.artifacts).map(([kind,a])=>[kind,convert(a)]))})),duration_ms:Date.now()-started});
  if(report.candidates.length!==inputs.length-1||report.candidates.some(c=>c.id===refs[0].evidence_id))throw Error("画像解析の候補件数が一致しません");
  for(const artifact of [report.query.artifact,...report.candidates.flatMap(c=>Object.values(c.artifacts))]){
   const bytes=await readOcrFile(await resolveOcrArtifact(stage,artifact.path));if(ocrDigest(bytes)!==artifact.sha256)throw Error("解析artifact hashが一致しません");
  }
  const bytes=Buffer.from(JSON.stringify(report,null,2)+"\n");if(bytes.length>2*1024*1024)throw Error("比較report容量が上限を超えます");
  await writeFile(path.join(stage,"report.json"),bytes);await rename(stage,outputDir);
  return imageComparisonRecordSchema.parse({report_path:path.join(outputDir,"report.json"),report_sha256:ocrDigest(bytes),report,reviews:[]});
 }finally{await rm(stage,{recursive:true,force:true});}
}
async function checkRecord(record:ImageComparisonRecord){
 const r=imageComparisonRecordSchema.parse(record),bytes=await readOcrFile(r.report_path,2*1024*1024);
 if(ocrDigest(bytes)!==r.report_sha256||!isDeepStrictEqual(imageComparisonReportSchema.parse(parse(bytes)),r.report))throw Error("比較原reportのhash・snapshotが一致しません");
 return r;
}
export async function verifyComparisonArtifact(record:ImageComparisonRecord,candidateId:string,kind:string):Promise<Buffer>{
 const r=await checkRecord(record),candidate=r.report.candidates.find(c=>c.id===candidateId);
 const artifact=kind==="query"?r.report.query.artifact:candidate?.artifacts[kind as keyof typeof candidate.artifacts];
 if(!artifact)throw Error("登録された比較artifactを指定してください");
 const bytes=await readOcrFile(await resolveOcrArtifact(path.dirname(r.report_path),artifact.path));if(ocrDigest(bytes)!==artifact.sha256)throw Error("比較artifact hashが一致しません");
 const dim=imageDimensions(bytes);if(dim.format!=="png"||Math.max(dim.width,dim.height)>1024)throw Error("比較PNG寸法を確認してください");
 return bytes;
}
export async function verifyComparisonRecord(record:ImageComparisonRecord){
 const r=await checkRecord(record);
 for(const input of [r.report.query.input,...r.report.candidates.map(c=>c.input)]){
  validateOcrSource(input.source);const evidenceBytes=await readOcrFile(input.evidence_path,2*1024*1024),image=await readOcrFile(input.image_path);
  if(ocrDigest(evidenceBytes)!==input.evidence_sha256||ocrDigest(image)!==input.source.image_sha256)throw Error("比較原入力hashが一致しません");
  const evidence=ocrEvidenceSchema.parse(parse(evidenceBytes)),items=evidence.items.filter(item=>(item as {evidence_id?:unknown}).evidence_id===input.source.evidence_id);
  if(items.length!==1||!isDeepStrictEqual(ocrSourceFromEvidenceItem(items[0],evidence.workspace_id),input.source))throw Error("比較原出典の領域・画像対応が一致しません");
  const item=items[0] as {display_image:{path:string}},originalPath=await resolveOcrArtifact(path.dirname(input.evidence_path),item.display_image.path),dim=imageDimensions(image);
  if(originalPath!==input.image_path||dim.width!==input.source.image_width||dim.height!==input.source.image_height)throw Error("比較原入力のpath・寸法が一致しません");
 }
 await verifyComparisonArtifact(r,"","query");
 for(const c of r.report.candidates)for(const kind of Object.keys(c.artifacts))await verifyComparisonArtifact(r,c.id,kind);
 return r;
}
export async function importComparison(workspace:IiifWorkspace,reportPath:string):Promise<IiifWorkspace>{
 const bytes=await readOcrFile(reportPath,2*1024*1024),report=imageComparisonReportSchema.parse(parse(bytes));
 const record=imageComparisonRecordSchema.parse({report_path:reportPath,report_sha256:ocrDigest(bytes),report,reviews:[]});
 for(const input of [report.query.input,...report.candidates.map(c=>c.input)]){
  const saved=await savedImage(workspace,{evidence_path:input.evidence_path,evidence_id:input.source.evidence_id});
  if(!isDeepStrictEqual(saved.input,input))throw Error("比較reportと原出典が一致しません");
 }
 await verifyComparisonRecord(record);return validateWorkspace(mergeComparison(workspace,record));
}
export async function compareFromEvidencePaths(workspace:IiifWorkspace,evidencePaths:string[],queryRegionId:string,outputDir:string){
 const refs:ImageReference[]=[];
 for(const file of z.array(z.string()).min(1).max(21).parse(evidencePaths)){
  const evidence=ocrEvidenceSchema.parse(parse(await readOcrFile(file,2*1024*1024)));
  for(const item of evidence.items){const id=(item as {evidence_id?:unknown}).evidence_id;if(typeof id!=="string")throw Error("保存済み領域IDを確認してください");refs.push(imageReferenceSchema.parse({evidence_path:file,evidence_id:id}));}
 }
 const query=refs.find(ref=>ref.evidence_id===queryRegionId);if(!query)throw Error("query領域の保存済み画像がありません");
 return compareImages(workspace,query,refs.filter(ref=>ref!==query),outputDir);
}
export async function protectComparisonOutput(output:string,workspace:IiifWorkspace,reportPath:string){
 await protectWorkspaceSources(output,workspace,[path.dirname(reportPath)]);
 const report=imageComparisonReportSchema.parse(parse(await readOcrFile(reportPath,2*1024*1024)));
 await assertDistinctOutput(output,[report.query.input,...report.candidates.map(c=>c.input)].flatMap(input=>[input.evidence_path,input.image_path]));
}
