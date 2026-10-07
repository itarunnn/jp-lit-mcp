import { expect,it } from "vitest";
import { mkdtemp,rm,readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { comparisonFixture } from "./fixtures/iiif/imageComparison.js";
import { startLocalServer } from "../src/iiif/localServer.js";
it("requires session authorization and serves only registered hash-checked comparison PNGs",async()=>{
 const root=await mkdtemp(path.join(tmpdir(),"iiif-image-server-"));let server:Awaited<ReturnType<typeof startLocalServer>>|undefined;
 try{
  const f=await comparisonFixture(root);server=await startLocalServer({workspace_path:f.workspacePath,asset_root:root});
  const url=new URL(server.url),headers={"Content-Type":"application/json","x-iiif-token":url.hash.slice(1),Origin:url.origin};
  const route=url.origin+"/api/images/compare",body=JSON.stringify({evidence_paths:[f.evidencePath],query_region_id:"r1",output_dir:path.join(root,"result")});
  expect((await fetch(route,{method:"POST",headers:{"Content-Type":"application/json"},body})).status).toBe(403);
  // bodyを送る前に同じ認証sessionのPOSTを重ね、解析中のworkspace変更拒否を実transportで確認する。
  let pending!:http.ClientRequest;
  const first=new Promise<{status:number|undefined;record:any}>((resolve,reject)=>{
   pending=http.request(route,{method:"POST",headers:{...headers,"Content-Length":Buffer.byteLength(body),Expect:"100-continue"}},res=>{let text="";res.on("data",chunk=>{text+=chunk;});res.on("end",()=>resolve({status:res.statusCode,record:JSON.parse(text)}));});pending.on("error",reject);pending.flushHeaders();
  });
  // 100-continueが、解析routeのheaders到着とbody待機に対する実transportのbarrierになる。
  await new Promise<void>(resolve=>pending.once("continue",resolve));
  try{
   expect((await fetch(url.origin+"/api/workspace",{method:"POST",headers,body:JSON.stringify(f.w)})).status).toBe(409);
  }finally{pending.end(body);}
  const response=await first;expect(response.status).toBe(200);const record=response.record;
  const saved={...f.w,image_comparisons:[record]};expect((await fetch(url.origin+"/api/workspace",{method:"POST",headers,body:JSON.stringify(saved)})).status).toBe(200);
  const preview=url.origin+`/api/images/preview?report_id=${record.report.report_id}&candidate_id=r2&kind=difference`;
  expect((await fetch(preview)).status).toBe(403);
  const pixels=await (await fetch(preview,{headers})).json();expect(pixels.data_url).toMatch(/^data:image\/png;base64,/);
  expect((await fetch(preview.replace("kind=difference","kind=../workspace.json"),{headers})).status).toBe(400);
  expect((await fetch(preview.replace(record.report.report_id,"unknown"),{headers})).status).toBe(400);
  expect(JSON.parse(await readFile(f.workspacePath,"utf8")).image_comparisons).toHaveLength(1);
 }finally{await server?.close();await rm(root,{recursive:true,force:true});}
},20000);
