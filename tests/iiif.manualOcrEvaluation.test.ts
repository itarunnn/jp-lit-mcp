import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { digest } from "./fixtures/iiif/ocr.js";
import { importManualOcr } from "../src/iiif/manualOcr.js";
import { evaluateOcr } from "../src/iiif/ocrEvaluation.js";
const dirs:string[]=[];
afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
async function fixture(){
  const dir=await mkdtemp(path.join(tmpdir(),"manual-evaluation-"));dirs.push(dir);
  const w=sampleWorkspace(),selection=w.regions[0].selection;
  const workspace=importManualOcr(w,{provider:"kuronet",source:{workspace_id:w.workspace_id,document_id:"d1",manifest_sha256:"a".repeat(64),selection},text:"舊字\n",author:"tester",result_url:null,scope_confirmed:true}).workspace;
  const workspacePath=path.join(dir,"workspace.json"),evaluationPath=path.join(dir,"evaluation.json"),outputPath=path.join(dir,"report.json");
  const evaluation:any={schema_version:"0.1",evaluation_id:"manual-1",workspace_id:w.workspace_id,cases:[{case_id:"c1",text_id:workspace.texts.at(-1)!.text_id,
    reference:{scope:"full_region",text:"舊文\n",text_sha256:digest("舊文\n"),origin:"human_transcription",source_ref:"fixture",verification:"unreviewed",review:null,training_overlap:"unknown",note:"合成fixture"},variants:[],observations:null}]};
  async function evaluate(){await writeFile(workspacePath,JSON.stringify(workspace));await writeFile(evaluationPath,JSON.stringify(evaluation));return evaluateOcr(workspacePath,evaluationPath,outputPath,false);}
  return {dir,workspace,evaluation,workspacePath,evaluationPath,outputPath,evaluate};
}
describe("manual OCR evaluation with explicit unknown service image identity",()=>{
  it("calculates text agreement while retaining manual provenance and unknown image/model conditions",async()=>{
    const f=await fixture();await f.evaluate();const report=JSON.parse(await readFile(f.outputPath,"utf8"));
    expect(report.cases[0]).toMatchObject({state:"reference_agreement",image_identity:"service_bytes_unknown",provenance_validation:"manual_copy_consistency",
      engine:null,run_path:null,source:{image_sha256:null,selection:{region_id:"r1"}},manual_ocr_provenance:{provider:"kuronet",acquisition:"manual_copy",model_version:null,source_image_sha256:null},
      candidates:[{generator:"kuronet",duration_ms:null,monetary_cost:null,metrics:{strict:{distance:1,cer:1/3},without_layout_whitespace:{cer:.5}}}]});
    expect(report.groups[0]).toMatchObject({generator:"kuronet",engine_sha256:null,image_identity:"service_bytes_unknown"});
    expect(report.summary).toMatchObject({cases:1,canvases:1,regions:1,source_collated:0});
  });
  it("retains a pending reference without asserting a quality ranking",async()=>{
    const f=await fixture();f.evaluation.cases[0].reference=null;await f.evaluate();const report=JSON.parse(await readFile(f.outputPath,"utf8"));
    expect(report.cases[0]).toMatchObject({state:"pending_reference",candidates:[{metrics:null}]});expect(report.groups).toEqual([]);
  });
  it.each(["text_hash","rewritten_text","changed_id","moved_region"])("rejects inconsistent manual evidence before writing a report: %s",async kind=>{
    const f=await fixture(),t=f.workspace.texts.at(-1)!;
    if(kind==="text_hash")t.text+="字";
    if(kind==="rewritten_text"){t.text+="字";t.source_sha256=digest(t.text);}
    if(kind==="changed_id"){t.text_id="manual-copied";f.evaluation.cases[0].text_id=t.text_id;f.workspace.regions[0].text_evidence_ids=[t.text_id];}
    if(kind==="moved_region")f.workspace.regions[0].selection.xywh[0]+=1;
    await expect(f.evaluate()).rejects.toThrow(/候補|本文|領域|出典/);await expect(readFile(f.outputPath)).rejects.toThrow();
  });
  it("rejects a same-image VLM comparison when the service input bytes are unknown",async()=>{
    const f=await fixture();f.evaluation.cases[0].variants=[{variant_id:"ai-1",kind:"image_reading",scope:"full_region",text:"舊字",text_sha256:digest("舊字"),image_sha256:"b".repeat(64),generator:"fixture-model",created_at:"2026-10-06T00:00:00Z",duration_ms:null}];
    await expect(f.evaluate()).rejects.toThrow(/画像|image/);await expect(readFile(f.outputPath)).rejects.toThrow();
  });
});
