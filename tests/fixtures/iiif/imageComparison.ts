import { writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { sampleWorkspace } from "./sample.js";
import { digest } from "./ocr.js";
import { validateWorkspace } from "../../../src/iiif/schemas.js";
function crc(bytes:Buffer){let c=0xffffffff;for(const byte of bytes){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(kind:string,data:Buffer){const type=Buffer.from(kind),length=Buffer.alloc(4),check=Buffer.alloc(4);length.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([length,type,data,check]);}
export function comparisonPng(){const header=Buffer.alloc(13);header.writeUInt32BE(150);header.writeUInt32BE(200,4);header[8]=8;
 const data=Buffer.alloc(151*200,235);for(let y=0;y<200;y++){data[y*151]=0;for(let x=0;x<150;x++)if(x%29<3&&y%31<15)data[y*151+1+x]=35;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",deflateSync(data)),chunk("IEND",Buffer.alloc(0))]);}
export async function comparisonFixture(root:string){
 const w=validateWorkspace(sampleWorkspace());w.documents[0].canvases[0].images[0].service=null;
 w.regions.push({...structuredClone(w.regions[0]),selection:{...w.regions[0].selection,region_id:"r2",xywh:[500,200,300,400]}});
 const pixels=comparisonPng(),sha=digest(pixels),items=[];
 for(const [i,r] of w.regions.entries()){
  await writeFile(path.join(root,`image-${i+1}.png`),pixels);
  const rect=r.selection.xywh.map(n=>n*2),transform={scale_x:2,scale_y:2,display_max_edge:2048};
  items.push({evidence_id:r.selection.region_id,selection:r.selection,source:{document_id:"d1",candidate:w.documents[0].candidate,receipt:w.documents[0].receipt,rights:[]},
   canvas:{canvas_id:r.selection.canvas_id,width:1000,height:2000},crop:{status:"supported",image_xywh:rect,transform},image_permission_confirmed:true,
   display_image:{path:`image-${i+1}.png`,receipt:{sha256:sha},width:150,height:200,original_image_xywh:rect,canvas_to_image:transform,scale_x:.25,scale_y:.25},text_evidence:[],tei_evidence:[]});
 }
 const evidencePath=path.join(root,"evidence.json"),workspacePath=path.join(root,"workspace.json");
 await writeFile(evidencePath,JSON.stringify({schema_version:"0.1",workspace_id:w.workspace_id,items}));
 await writeFile(workspacePath,JSON.stringify(w));
 return {w,evidencePath,workspacePath,query:{evidence_path:evidencePath,evidence_id:"r1"},candidates:[{evidence_path:evidencePath,evidence_id:"r2"}],items};
}
