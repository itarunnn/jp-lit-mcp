import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rename, rm, lstat, writeFile } from "node:fs/promises";
import { readingTaskSchema, readingResponseSchema, readingKindSchema } from "./readingSchemas.js";
import { readWorkspace } from "./workspace.js";
import { validateWorkspace } from "./schemas.js";
import { protectWorkspaceSources, assertDistinctOutput } from "./outputProtection.js";
import { resolveOcrEvaluationSource } from "./ocrEvaluationSource.js";
import { readOcrFile, ocrDigest, resolveOcrArtifact } from "./ocrRunner.js";
import { imageDimensions } from "./imageMetadata.js";
import type { IiifWorkspace, TextEvidence } from "./types.js";
import type { ReadingTask } from "./readingSchemas.js";
import { assertReadingTarget } from "./reading-state.mjs";
const parse=(b:Buffer)=>JSON.parse(b.toString("utf8").replace(/^\uFEFF/,""));

function prompt(task:Omit<ReadingTask,"prompt_sha256">,text:string) {
  return `# 選択領域の画像読解\n\n同梱の ${task.image.path} を実際に開いてください。縦書きは列の順序を確認し、見える字だけを翻刻してください。判読不能は〓、候補と疑義は別に記録し、物語の記憶から補わないでください。全領域を覆えない場合は partial_region と申告してください。\n\n領域ID: ${task.source.selection.region_id}\nCanvas: ${task.source.selection.canvas_id}\n領域 xywh: ${JSON.stringify(task.source.selection.xywh)}\n画像 SHA-256: ${task.image.sha256}\n課題ID: ${task.task_id}\n条件: ${task.kind}\n\nresponse-template.json の形式で応答してください。generator は実際のモデル名、model_version・duration_ms は確認できなければnull、monetary_cost はnullです。image_opened は実見の自己申告で、校合済みを意味しません。doubts.quote は候補本文から引用してください。\n`+
    (task.kind==="image_assisted_correction"?`\n## 原OCR候補\n\n画像と照合し、修訂候補を提示してください。以下の候補も未校合です。\n\n${text}\n`:"\n画像のみを入力とし、他のOCR・翻刻・TEIを参照しないでください。\n");
}
async function baseSource(w:IiifWorkspace,textId:string,outputPath:string) {
  const text=w.texts.find(t=>t.text_id===textId);
  if(!text?.ocr_provenance||text.manual_ocr_provenance||text.reading_provenance)throw new Error("同画像を検証できるローカル原OCR候補を指定してください");
  await resolveOcrEvaluationSource(w,text,outputPath,new Map());
  return text;
}
export async function prepareReading(workspacePath:string,textId:string,kind:unknown,outputDir:string) {
  const w=await readWorkspace(workspacePath),mode=readingKindSchema.parse(kind);
  await protectWorkspaceSources(outputDir,w,[workspacePath]);
  const text=await baseSource(w,textId,outputDir),p=text.ocr_provenance!;
  const candidates=p.artifacts.filter(a=>/\.(jpg|png)$/i.test(a.path));
  if(candidates.length!==1)throw new Error("OCR入力画像を確認してください");
  const imageBytes=await readOcrFile(candidates[0].path),dim=imageDimensions(imageBytes);
  if(ocrDigest(imageBytes)!==p.source.image_sha256||dim.width!==p.source.image_width||dim.height!==p.source.image_height)throw new Error("原画像hash・寸法が一致しません");
  try {await lstat(outputDir);throw new Error("課題の保存先には新しいdirectoryを指定してください");}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
  const taskBase={schema_version:"0.1" as const,task_id:randomUUID(),created_at:new Date().toISOString(),kind:mode,
    delivery:"current_app_file_handoff" as const,automatic_transmission:"none" as const,base_text_id:textId,
    base_text_sha256:text.source_sha256,base_run_path:p.run_path,base_run_sha256:p.run_sha256,source:p.source,
    image:{path: (/\.png$/i.test(candidates[0].path)?"image.png":"image.jpg") as "image.png"|"image.jpg",sha256:p.source.image_sha256}};
  const promptText=prompt(taskBase,text.text),task=readingTaskSchema.parse({...taskBase,prompt_sha256:ocrDigest(promptText)});
  await mkdir(path.dirname(outputDir),{recursive:true});
  const stage=await mkdtemp(path.join(path.dirname(outputDir),".reading-"));
  try {
    const template={schema_version:"0.1",task_id:task.task_id,kind:task.kind,image_sha256:task.source.image_sha256,
      generator:"利用中のモデル名",model_version:null,executed_at:task.created_at,image_opened:false,scope:"partial_region",
      text:"",doubts:[{quote:"候補本文中の疑義箇所",alternatives:["代替候補"],note:"画像上の根拠・保留理由（疑義なしの場合はdoubtsを空配列にする）"}],duration_ms:null,monetary_cost:null};
    for(const [file,content] of Object.entries({"task.json":JSON.stringify(task,null,2),"prompt.md":promptText,
      "response-template.json":JSON.stringify(template,null,2),[task.image.path]:imageBytes}))await writeFile(path.join(stage,file),content);
    await rename(stage,outputDir);
  } catch(e){await rm(stage,{recursive:true,force:true});throw e;}
  return {task_path:path.join(outputDir,"task.json"),prompt_path:path.join(outputDir,"prompt.md"),image_path:path.join(outputDir,task.image.path),response_template_path:path.join(outputDir,"response-template.json"),task_id:task.task_id};
}
async function verifyTask(w:IiifWorkspace,taskPath:string,outputPath:string) {
  const taskBytes=await readOcrFile(taskPath),task=readingTaskSchema.parse(parse(taskBytes)),root=path.dirname(taskPath);
  await assertDistinctOutput(outputPath,[root]);
  const text=await baseSource(w,task.base_text_id,outputPath),p=text.ocr_provenance!;
  if(JSON.stringify(p.source)!==JSON.stringify(task.source)||p.run_path!==task.base_run_path||p.run_sha256!==task.base_run_sha256||text.source_sha256!==task.base_text_sha256||task.image.sha256!==p.source.image_sha256)
    throw new Error("読解課題と原OCR・領域が一致しません");
  const imagePath=await resolveOcrArtifact(root,task.image.path),image=await readOcrFile(imagePath),dim=imageDimensions(image);
  if(ocrDigest(image)!==task.image.sha256||dim.width!==task.source.image_width||dim.height!==task.source.image_height)throw new Error("読解画像のhash・寸法が一致しません");
  const promptBytes=await readOcrFile(await resolveOcrArtifact(root,"prompt.md"));
  if(ocrDigest(promptBytes)!==task.prompt_sha256||promptBytes.toString("utf8")!==prompt(task,text.text))throw new Error("読解指示のhash・内容が一致しません");
  return {task,taskBytes,imagePath};
}
export async function importReading(workspace:IiifWorkspace,taskPath:string,responsePath:string,outputPath:string) {
  const w=structuredClone(validateWorkspace(workspace));
  await protectWorkspaceSources(outputPath,w,[path.dirname(taskPath),responsePath]);
  const {task,taskBytes,imagePath}=await verifyTask(w,taskPath,outputPath),responseBytes=await readOcrFile(responsePath),response=readingResponseSchema.parse(parse(responseBytes));
  if(response.task_id!==task.task_id||response.kind!==task.kind||response.image_sha256!==task.source.image_sha256)throw new Error("AI応答の課題・条件・画像が一致しません");
  const textId=`ai-${ocrDigest(`${task.task_id}:${ocrDigest(responseBytes)}`).slice(0,24)}`;
  const t:TextEvidence={text_id:textId,canvas_id:task.source.selection.canvas_id,target_xywh:task.source.selection.xywh,
    source_ref:`${responsePath}#${task.task_id}`,source_sha256:ocrDigest(response.text),text:response.text,origin:"ai_candidate",verification_state:"unverified",
    reading_provenance:{kind:task.kind,source:task.source,task,task_path:taskPath,task_sha256:ocrDigest(taskBytes),response_path:responsePath,
      response_sha256:ocrDigest(responseBytes),image_path:imagePath,response,reviews:[]}};
  const {region}=assertReadingTarget(w,t),existing=w.texts.find(x=>x.text_id===textId);
  if(existing) {
    const strip=(x:TextEvidence)=>({...x,reading_provenance:{...x.reading_provenance,reviews:[]}});
    if(JSON.stringify(strip(existing))!==JSON.stringify(strip(t)))throw new Error("同じAI候補IDに異なる本文・出典があります");
  }else w.texts.push(t);
  if(!region.text_evidence_ids.includes(textId))region.text_evidence_ids.push(textId);
  return {workspace:validateWorkspace(w),text_id:textId,imported:existing?0:1};
}
export async function verifyReading(workspace:IiifWorkspace,text:TextEvidence,outputPath:string) {
  const p=text.reading_provenance;
  if(!p)throw new Error("AI候補の出典を確認してください");
  assertReadingTarget(workspace,text);
  const imported=await importReading(workspace,p.task_path,p.response_path,outputPath);
  if(imported.text_id!==text.text_id)throw new Error("AI候補IDと原応答が一致しません");
  return p;
}
