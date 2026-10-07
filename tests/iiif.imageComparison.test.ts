import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { comparisonFixture } from "./fixtures/iiif/imageComparison.js";
import { compareImages,importComparison,verifyComparisonArtifact,verifyComparisonRecord,protectComparisonOutput } from "../src/iiif/imageComparison.js";
import { digest } from "./fixtures/iiif/ocr.js";
import { recordComparisonReview,comparisonsForRegion } from "../src/iiif/image-comparison-state.mjs";
import { runIiifCli } from "../src/iiif/cli.js";
import { validateWorkspace } from "../src/iiif/schemas.js";
import { exportEvidence } from "../src/iiif/evidence.js";
import {protectWorkspaceSources} from "../src/iiif/outputProtection.js";
let root:string;
beforeEach(async()=>{root=await mkdtemp(path.join(tmpdir(),"iiif-images-"));vi.stubGlobal("fetch",()=>{throw Error("Network must not be used");});});
afterEach(async()=>{vi.unstubAllGlobals();await rm(root,{recursive:true,force:true});});
it("saves real worker output with both original region sources and immutable report",async()=>{
 const f=await comparisonFixture(root),r=await compareImages(f.w,f.query,f.candidates,path.join(root,"result"));
 expect(r.report.query.input.source.selection.region_id).toBe("r1");expect(r.report.candidates[0].input.source.selection.region_id).toBe("r2");
 expect(r.report.candidates[0].status).toBe("aligned");expect(r.report.candidates[0].raw_mean_difference).toBe(0);
 expect(r.report.engine.engine_sha256).toMatch(/^[a-f0-9]{64}$/);expect(r.report.image_transmission).toBe("none");
 const bytes=await verifyComparisonArtifact(r,"r2","difference");expect(bytes.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
 expect(validateWorkspace({...f.w,image_comparisons:[r]}).image_comparisons).toHaveLength(1);
},15000);
it("reimports the same report while preserving separate figure review history",async()=>{
 const f=await comparisonFixture(root),r=await compareImages(f.w,f.query,f.candidates,path.join(root,"result"));
 let w=await importComparison(f.w,r.report_path);w=recordComparisonReview(w,r.report.report_id,"r2",{author:"tester",result:"uncertain",note:"合成図版の対応を保留"});
 w=await importComparison(w,r.report_path);expect(w.image_comparisons).toHaveLength(1);expect(w.image_comparisons![0].reviews).toHaveLength(1);expect(w.texts).toEqual([]);
},15000);
it("rejects a changed saved image and changed region selection before worker execution",async()=>{
 const f=await comparisonFixture(root);f.w.regions[0].selection.xywh[0]++;
 await expect(compareImages(f.w,f.query,f.candidates,path.join(root,"bad1"))).rejects.toThrow(/領域|出典/);
 f.w.regions[0].selection.xywh[0]--;const imagePath=path.join(root,"image-1.png");await writeFile(imagePath,Buffer.concat([await readFile(imagePath),Buffer.from("changed")]));
 await expect(compareImages(f.w,f.query,f.candidates,path.join(root,"bad2"))).rejects.toThrow(/hash/);
});
it("protects all source files and duplicate region IDs from output replacement",async()=>{
 const f=await comparisonFixture(root),before=await readFile(f.evidencePath);
 await expect(compareImages(f.w,f.query,f.candidates,f.evidencePath)).rejects.toThrow();
 expect(await readFile(f.evidencePath)).toEqual(before);
 await expect(compareImages(f.w,f.query,[f.query],path.join(root,"bad"))).rejects.toThrow();
});
it("rejects modified artifacts and traversal instead of publishing previews",async()=>{
 const f=await comparisonFixture(root),r=await compareImages(f.w,f.query,f.candidates,path.join(root,"result"));
 const file=path.join(path.dirname(r.report_path),r.report.candidates[0].artifacts.difference!.path);
 await writeFile(file,"changed");await expect(verifyComparisonArtifact(r,"r2","difference")).rejects.toThrow(/hash/);
 r.report.candidates[0].artifacts.difference!.path="../workspace.json";await writeFile(r.report_path,JSON.stringify(r.report));
 await expect(importComparison(f.w,r.report_path)).rejects.toThrow();
},15000);
it("retains moved or deleted region history and excludes its current export",async()=>{
 const f=await comparisonFixture(root),r=await compareImages(f.w,f.query,f.candidates,path.join(root,"result"));
 const w=await importComparison(f.w,r.report_path);w.regions[1].selection.xywh[0]++;
 expect(validateWorkspace(w).image_comparisons).toHaveLength(1);expect(comparisonsForRegion(w,w.regions[0])).toEqual([]);
 expect(()=>recordComparisonReview(w,r.report.report_id,"r2",{author:"a",result:"match",note:"moved"})).toThrow();
 w.regions.pop();expect(validateWorkspace(w).image_comparisons).toHaveLength(1);
},15000);
it("exports the exact figure candidate and review while leaving the original report unchanged",async()=>{
 const f=await comparisonFixture(root),r=await compareImages(f.w,f.query,f.candidates,path.join(root,"result")),raw=await readFile(r.report_path);
 let w=await importComparison(f.w,r.report_path);w=recordComparisonReview(w,r.report.report_id,"r2",{author:"a",result:"uncertain",note:"fixture"});await writeFile(f.workspacePath,JSON.stringify(w));
 const out=await exportEvidence({api_version:"0.1",operation:"export_evidence",workspace_path:f.workspacePath,region_ids:["r1"],output_dir:path.join(root,"export"),overwrite:false,image_permission_confirmed:false});
 const evidence=JSON.parse(await readFile(out.evidence_json_path,"utf8"));expect(evidence.items[0].image_comparison_evidence[0].matches[0].id).toBe("r2");
 expect(evidence.items[0].image_comparison_evidence[0].reviews[0].result).toBe("uncertain");expect(await readFile(r.report_path)).toEqual(raw);
 await expect(exportEvidence({api_version:"0.1",operation:"export_evidence",workspace_path:f.workspacePath,region_ids:["r1"],output_dir:path.join(root,"result","nested-export"),overwrite:false,image_permission_confirmed:false})).rejects.toThrow(/原入力|原資料/);
},15000);
it("runs both public CLI operations from saved evidence",async()=>{
 const f=await comparisonFixture(root);let stdout="";const io={cwd:root,stdout:(s:string)=>{stdout+=s;},stderr:()=>{}};
 const requestPath=path.join(root,"request.json"),output=path.join(root,"out.json");
 await writeFile(requestPath,JSON.stringify({api_version:"0.1",operation:"compare_images",workspace_path:f.workspacePath,query:f.query,candidates:f.candidates,output_dir:path.join(root,"result")}));
 expect(await runIiifCli(["--request",requestPath],io)).toBe(0);const report=JSON.parse(stdout).result.report_path;stdout="";
 await writeFile(requestPath,JSON.stringify({api_version:"0.1",operation:"import_comparison",workspace_path:f.workspacePath,report_path:report,output_path:output}));
 expect(await runIiifCli(["--request",requestPath],io)).toBe(0);expect(JSON.parse(await readFile(output,"utf8")).image_comparisons).toHaveLength(1);
},15000);
it("binds report source coordinates to the actual saved evidence even when the report hash is refreshed",async()=>{
 const f=await comparisonFixture(root),r=await compareImages(f.w,f.query,f.candidates,path.join(root,"result"));
 r.report.candidates[0].input.source.selection.xywh[0]++;
 r.report.candidates[0].input.source.original_image_xywh[0]+=2;
 const bytes=Buffer.from(JSON.stringify(r.report));await writeFile(r.report_path,bytes);r.report_sha256=digest(bytes);
 await expect(verifyComparisonRecord(r)).rejects.toThrow(/原出典|原入力/);
},15000);
it("protects the bundled analysis code and locked dependencies from comparison import outputs",async()=>{
 const f=await comparisonFixture(root),record=await compareImages(f.w,f.query,f.candidates,path.join(root,"result"));
 for(const file of ["iiif_image/analysis.py","uv.lock"]){
  const target=path.resolve("packages/iiif-image-analysis",file),before=await readFile(target);
  await expect(protectComparisonOutput(target,f.w,record.report_path)).rejects.toThrow(/原入力|engine/);
  await expect(protectWorkspaceSources(target,{...f.w,image_comparisons:[record]})).rejects.toThrow(/原入力|engine/);
  expect(await readFile(target)).toEqual(before);
 }
},15000);
it("reports each stale candidate omitted from a partially valid comparison export",async()=>{
 const f=await comparisonFixture(root),third=structuredClone(f.items[1]);third.evidence_id="r3";third.selection.region_id="r3";third.selection.xywh[0]=650;third.display_image.original_image_xywh[0]=1300;third.crop.image_xywh[0]=1300;
 f.w.regions.push({...structuredClone(f.w.regions[1]),selection:structuredClone(third.selection)});
 await writeFile(f.evidencePath,JSON.stringify({schema_version:"0.1",workspace_id:f.w.workspace_id,items:[...f.items,third]}));
 const r=await compareImages(f.w,f.query,[...f.candidates,{evidence_path:f.evidencePath,evidence_id:"r3"}],path.join(root,"result"));
 const w=await importComparison(f.w,r.report_path);w.regions.pop();await writeFile(f.workspacePath,JSON.stringify(w));
 const out=await exportEvidence({api_version:"0.1",operation:"export_evidence",workspace_path:f.workspacePath,region_ids:["r1"],output_dir:path.join(root,"export"),overwrite:false,image_permission_confirmed:false});
 const evidence=JSON.parse(await readFile(out.evidence_json_path,"utf8"));expect(evidence.items[0].image_comparison_evidence[0].matches.map((c:any)=>c.id)).toEqual(["r2"]);
 expect(out.diagnostics.some(d=>d.includes("r3")&&d.includes("除外"))).toBe(true);
},20000);
