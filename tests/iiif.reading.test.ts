import { expect, it } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readingFixture } from "./fixtures/iiif/reading.js";
import { runIiifCli } from "../src/iiif/cli.js";
import { digest } from "./fixtures/iiif/ocr.js";
import { recordReadingReview } from "../src/iiif/reading-state.mjs";
import { exportEvidence } from "../src/iiif/evidence.js";
import { evaluateOcr } from "../src/iiif/ocrEvaluation.js";
import { validateWorkspace } from "../src/iiif/schemas.js";

async function cli(f: Awaited<ReturnType<typeof readingFixture>>, request: unknown) {
  const file = path.join(f.dir, "request.json"), output: string[] = [];
  await writeFile(file, JSON.stringify(request));
  const code = await runIiifCli(["--request", file], {cwd:f.dir,stdout:s=>output.push(s),stderr:()=>{}});
  return {code, response:JSON.parse(output.join(""))};
}
async function prepared(kind="image_reading") {
  const f=await readingFixture(), taskDir=path.join(f.dir, "task");
  const result=await cli(f,{api_version:"0.1",operation:"prepare_reading",workspace_path:f.workspacePath,text_id:f.imported.texts[0].text_id,kind,output_dir:taskDir});
  expect(result.response).toMatchObject({ok:true}); expect(result.code).toBe(0);
  const taskPath=path.join(taskDir,"task.json"), task=JSON.parse(await readFile(taskPath,"utf8"));
  return {...f,taskDir,taskPath,task};
}
async function response(f: Awaited<ReturnType<typeof prepared>>, scope="full_region") {
  const responsePath=path.join(f.dir,"response.json");
  const value={schema_version:"0.1",task_id:f.task.task_id,kind:f.task.kind,image_sha256:f.task.source.image_sha256,
    generator:"synthetic-model",model_version:null,executed_at:"2026-10-08T00:00:00Z",image_opened:true,scope,
    text:"古い本文\n",doubts:[{quote:"本文",alternatives:["本丈"],note:"合成文字の候補"}],duration_ms:null,monetary_cost:null};
  await writeFile(responsePath,JSON.stringify(value)); return {responsePath,value};
}
it("prepares an image-only packet with identical image bytes and no OCR body",async()=>{
  const f=await prepared();
  expect(await readFile(path.join(f.taskDir,f.task.image.path))).toEqual(await readFile(path.join(f.raw,"input.png")));
  expect(f.task.base_text_sha256).toBe(f.imported.texts[0].source_sha256);
  expect(f.task).not.toHaveProperty("ocr_text");
  expect(await readFile(path.join(f.taskDir,"prompt.md"),"utf8")).not.toContain(f.imported.texts[0].text);
});
it("adds the original OCR body only in the assisted condition",async()=>{
  const f=await prepared("image_assisted_correction");
  expect(await readFile(path.join(f.taskDir,"prompt.md"),"utf8")).toContain(f.imported.texts[0].text);
});
it("imports doubts as an unverified AI candidate and preserves prior text",async()=>{
  const f=await prepared(), r=await response(f), outputPath=path.join(f.dir,"with-reading.json");
  const result=await cli(f,{api_version:"0.1",operation:"import_reading",workspace_path:f.workspacePath,task_path:f.taskPath,response_path:r.responsePath,output_path:outputPath});
  expect(result.response).toMatchObject({ok:true});
  const w=JSON.parse(await readFile(outputPath,"utf8"));
  expect(w.texts[0]).toEqual(f.imported.texts[0]);
  expect(w.texts[1]).toMatchObject({origin:"ai_candidate",verification_state:"unverified",source_sha256:digest(r.value.text),
    reading_provenance:{kind:"image_reading",response:r.value,reviews:[]}});
  expect(w.regions[0].text_evidence_ids).toContain(w.texts[1].text_id);
});
it("preserves a valid ISO timestamp with UTC offset from an AI app",async()=>{
  const f=await prepared(),r=await response(f);r.value.executed_at="2026-10-08T04:36:35.7051682+09:00";await writeFile(r.responsePath,JSON.stringify(r.value));
  const outputPath=path.join(f.dir,"offset.json"),result=await cli(f,{api_version:"0.1",operation:"import_reading",workspace_path:f.workspacePath,task_path:f.taskPath,response_path:r.responsePath,output_path:outputPath});
  expect(result.response.ok).toBe(true);
  expect(JSON.parse(await readFile(outputPath,"utf8")).texts[1].reading_provenance.response.executed_at).toBe(r.value.executed_at);
});
it.each(["raw", "image", "task", "response_image", "response_quote", "moved"])("rejects changed reading inputs: %s",async kind=>{
  const f=await prepared(),r=await response(f);
  if(kind==="raw")await writeFile(path.join(f.raw,"input.txt"),"原出力変更");
  if(kind==="image")await writeFile(path.join(f.taskDir,f.task.image.path),"画像変更");
  if(kind==="task") {f.task.base_text_sha256="0".repeat(64);await writeFile(f.taskPath,JSON.stringify(f.task));}
  if(kind==="response_image") {r.value.image_sha256="0".repeat(64);await writeFile(r.responsePath,JSON.stringify(r.value));}
  if(kind==="response_quote") {r.value.doubts[0].quote="存在しない疑義";await writeFile(r.responsePath,JSON.stringify(r.value));}
  if(kind==="moved") {f.imported.regions[0].selection.xywh[0]++;await writeFile(f.workspacePath,JSON.stringify(f.imported));}
  const outputPath=path.join(f.dir,"rejected.json");
  expect((await cli(f,{api_version:"0.1",operation:"import_reading",workspace_path:f.workspacePath,task_path:f.taskPath,response_path:r.responsePath,output_path:outputPath})).response.ok).toBe(false);
  await expect(readFile(outputPath)).rejects.toThrow();
});
it("protects the response and task from output overwrite",async()=>{
  const f=await prepared(),r=await response(f),before=await readFile(r.responsePath);
  expect((await cli(f,{api_version:"0.1",operation:"import_reading",workspace_path:f.workspacePath,task_path:f.taskPath,response_path:r.responsePath,output_path:r.responsePath,overwrite:true})).response.ok).toBe(false);
  expect(await readFile(r.responsePath)).toEqual(before);
});
async function importedReading(scope="full_region") {
  const f=await prepared(),r=await response(f,scope),outputPath=path.join(f.dir,"with-reading.json");
  const req={api_version:"0.1",operation:"import_reading",workspace_path:f.workspacePath,task_path:f.taskPath,response_path:r.responsePath,output_path:outputPath};
  expect((await cli(f,req)).response.ok).toBe(true);
  const w=JSON.parse(await readFile(outputPath,"utf8"));return {...f,...r,outputPath,req,w,ai:w.texts[1]};
}
it("retains a separate AI review across idempotent reimport",async()=>{
  const f=await importedReading(),next=recordReadingReview(f.w,f.ai.text_id,{reviewer_type:"ai",author:"review-model",result:"uncertain",note:"画像実見、文字校合は保留",corrected_text:null});
  validateWorkspace(next);await writeFile(f.outputPath,JSON.stringify(next));
  expect((await cli(f,{...f.req,workspace_path:f.outputPath,overwrite:true})).response.ok).toBe(true);
  const w=JSON.parse(await readFile(f.outputPath,"utf8"));
  expect(w.texts[1].text).toBe(f.ai.text);expect(w.texts[1].reading_provenance.reviews).toHaveLength(1);
  expect(w.texts[1].verification_state).toBe("unverified");
});
it("evaluates an explicitly selected imported full-region reading",async()=>{
  const f=await importedReading();f.evaluation.cases[0].reading_text_ids=[f.ai.text_id];
  await writeFile(f.evaluationPath,JSON.stringify(f.evaluation));
  await evaluateOcr(f.outputPath,f.evaluationPath,f.outputPath+".report.json",false);
  const report=JSON.parse(await readFile(f.outputPath+".report.json","utf8"));
  expect(report.cases[0].candidates[1]).toMatchObject({candidate_id:f.ai.text_id,kind:"image_reading",reading_provenance:{response_sha256:digest(JSON.stringify(f.value))}});
  expect(report.summary.source_collated).toBe(0);
});
it("rejects a partial-region reading from full-region evaluation",async()=>{
  const f=await importedReading("partial_region");f.evaluation.cases[0].reading_text_ids=[f.ai.text_id];
  await writeFile(f.evaluationPath,JSON.stringify(f.evaluation));
  await expect(evaluateOcr(f.outputPath,f.evaluationPath,f.outputPath+".report.json",false)).rejects.toThrow(/部分|full_region/);
});
it("keeps moved AI readings in history and omits them from current-region export",async()=>{
  const f=await importedReading();f.w.regions[0].selection.xywh[0]++;
  await writeFile(f.outputPath,JSON.stringify(f.w));
  const dir=path.join(f.dir,"export");await exportEvidence({api_version:"0.1",operation:"export_evidence",workspace_path:f.outputPath,region_ids:["r1"],output_dir:dir,image_permission_confirmed:false,overwrite:false});
  const evidence=JSON.parse(await readFile(path.join(dir,"evidence.json"),"utf8"));
  expect(evidence.items[0].text_evidence.some((t:any)=>t.text_id===f.ai.text_id)).toBe(false);
  expect(evidence.diagnostics.join(" ")).toMatch(/AI/);
  expect(validateWorkspace(f.w).texts[1].text).toBe(f.ai.text);
});
it.each(["body","id","source_hash"])("rejects AI candidate tampering during evaluation: %s",async kind=>{
  const f=await importedReading();
  if(kind==="body"){f.ai.text="すり替え";f.ai.reading_provenance.response.text=f.ai.text;f.ai.source_sha256=digest(f.ai.text);}
  if(kind==="id"){f.ai.text_id="copied-ai";f.w.regions[0].text_evidence_ids[1]=f.ai.text_id;}
  if(kind==="source_hash")f.ai.reading_provenance.response_sha256="0".repeat(64);
  f.evaluation.cases[0].reading_text_ids=[f.ai.text_id];await writeFile(f.outputPath,JSON.stringify(f.w));await writeFile(f.evaluationPath,JSON.stringify(f.evaluation));
  await expect(evaluateOcr(f.outputPath,f.evaluationPath,f.outputPath+".report.json",false)).rejects.toThrow(/候補|応答|ID/);
});
