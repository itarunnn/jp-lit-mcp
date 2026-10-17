import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sampleWorkspace } from "./sample.js";
import { digest, ocrCandidate, ocrSource } from "./ocr.js";
import { normalizeKotenOutput } from "../../../src/iiif/ocr.js";
import { importOcr } from "../../../src/iiif/ocrImport.js";

export async function makeBookRun(dir: string, options: { textless?: boolean } = {}) {
  const root = path.join(dir,"run"); await mkdir(root,{recursive:true});
  const image = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(image);
  image.write("IHDR",12); image.writeUInt32BE(150,16); image.writeUInt32BE(200,20);
  const source = {...ocrSource(),image_sha256:digest(image)};
  const raw = {imginfo:{img_width:150,img_height:200},contents:[options.textless ? [] : [
    {id:0,text:"圖一　花の圖",boundingBox:[[10,150],[130,150],[130,170],[10,170]]},
    {id:1,text:"本文。圖一を見よ。",boundingBox:[[130,10],[145,10],[145,140],[130,140]]},
  ]]};
  const text = options.textless ? "" : "圖一　花の圖\n本文。圖一を見よ。\n", lines = normalizeKotenOutput(raw,source), engine = ocrCandidate().ocr_provenance.engine;
  const evidence = {schema_version:"0.1",workspace_id:"w1",items:[{evidence_id:"r1",selection:source.selection,
    source:{document_id:"d1",receipt:{sha256:source.manifest_sha256}},canvas:{canvas_id:source.selection.canvas_id,width:1000,height:2000},
    crop:{status:"supported",image_xywh:source.original_image_xywh,transform:source.canvas_to_image},
    display_image:{path:"input.png",receipt:{sha256:source.image_sha256},width:150,height:200,original_image_xywh:source.original_image_xywh,
      canvas_to_image:source.canvas_to_image,scale_x:source.scale_x,scale_y:source.scale_y},image_permission_confirmed:true}]};
  const files = {"input.png":image,"raw.json":Buffer.from(JSON.stringify(raw)),"raw.txt":Buffer.from(text)};
  for (const [name,bytes] of Object.entries(files)) await writeFile(path.join(root,name),bytes);
  const evidenceBytes = Buffer.from(JSON.stringify(evidence)); await writeFile(path.join(root,"evidence.json"),evidenceBytes);
  const runPath = path.join(root,"run.json");
  const run = {schema_version:"0.1",run_id:"book-run",status:"completed",device:"cpu",image_transmission:"none",engine,
    evidence_path:path.join(root,"evidence.json"),evidence_sha256:digest(evidenceBytes),items:[{status:"completed",source,text,lines,
      started_at:"2026-10-17T00:00:00Z",finished_at:"2026-10-17T00:00:01Z",duration_ms:1000,error:null,diagnostics:[],
      artifacts:Object.entries(files).map(([name,bytes])=>({path:name,sha256:digest(bytes)}))}]};
  await writeFile(runPath,JSON.stringify(run));
  const base = sampleWorkspace(); base.regions[0].selection = source.selection;
  const workspace = (await importOcr(base,runPath)).workspace, workspacePath = path.join(dir,"workspace.json");
  await writeFile(workspacePath,JSON.stringify(workspace));
  return {root,image,source,workspace,workspacePath,textId:workspace.texts[0].text_id};
}
