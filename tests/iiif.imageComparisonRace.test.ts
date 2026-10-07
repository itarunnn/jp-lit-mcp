import {it,expect} from "vitest";
import {readFile,mkdtemp,rm} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {comparisonFixture} from "./fixtures/iiif/imageComparison.js";
import {compareImages} from "../src/iiif/imageComparison.js";
import {mergeComparison,comparisonsForRegion,recordComparisonReview} from "../src/iiif/image-comparison-state.mjs";
import {validateWorkspace} from "../src/iiif/schemas.js";
it("keeps completed comparison history and local notes when a region is deleted while analysis responds",async()=>{
 const root=await mkdtemp(path.join(tmpdir(),"image-race-"));
 try{
  const f=await comparisonFixture(root),record=await compareImages(f.w,f.query,f.candidates,path.join(root,"result"));
  const app=await readFile("packages/iiif-workbench/web/app.mjs","utf8"),callback=app.match(/async function comparisonAction\(route,input\)\{([\s\S]*?)\n  \}/)![1];
  let release!:()=>void,entered!:()=>void,server=structuredClone(f.w);
  const gate=new Promise<void>(r=>{release=r;}),waiting=new Promise<void>(r=>{entered=r;});
  const make=new Function("deps",`let workspace=deps.workspace,manualImportBusy=false;const {api,mergeComparison}=deps;const snapshot=()=>workspace;
   return {run:async function(route,input){${callback}},getWorkspace:()=>workspace};`);
  const ui=make({workspace:structuredClone(f.w),mergeComparison,api:async(route:string,body:any)=>{
   if(route==="/api/workspace"){server=validateWorkspace(structuredClone(body));return server;}
   entered();await gate;return record;
  }});
  const pending=ui.run("/api/images/compare",{});await waiting;
  const local=ui.getWorkspace();local.regions[0].note="実行中に追記した原画像の注記";local.regions.pop();release();await pending;
  const final=ui.getWorkspace();expect(final.regions).toHaveLength(1);expect(final.regions[0].note).toBe("実行中に追記した原画像の注記");
  expect(final.image_comparisons).toHaveLength(1);expect(server.image_comparisons).toEqual(final.image_comparisons);
  expect(comparisonsForRegion(final,final.regions[0])).toEqual([]);
  expect(()=>recordComparisonReview(final,record.report.report_id,"r2",{author:"a",result:"match",note:"deleted"})).toThrow();
  expect(()=>mergeComparison({...final,workspace_id:"other"},record,{allow_stale:true})).toThrow();
 }finally{await rm(root,{recursive:true,force:true});}
},20000);
