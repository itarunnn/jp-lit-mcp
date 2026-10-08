import { expect, it, vi } from "vitest";
import { mkdtemp, copyFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { ocrCandidate } from "./fixtures/iiif/ocr.js";
import { validateWorkspace } from "../src/iiif/schemas.js";
class Element {
  children:Element[]=[]; textContent=""; value=""; disabled=false; dataset:Record<string,string>={};
  onclick?:()=>void; onchange?:()=>void; placeholder="";
  oninput?:()=>void; ontoggle?:()=>void; open=false;
  constructor(public tag:string){}
  append(...children:Element[]){this.children.push(...children);}
  replaceChildren(...children:Element[]){this.children=children;}
  setAttribute(){} scrollIntoView(){}
}
function find(root:Element,predicate:(e:Element)=>boolean):Element|undefined {
  if(predicate(root))return root;
  for(const child of root.children){const found=find(child,predicate);if(found)return found;}
}
it("navigates a later OCR line and records a correction without altering the original",async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),"ocr-panel-"));
  try {
    await Promise.all([copyFile(new URL("../packages/iiif-workbench/web/ocr-panel.mjs",import.meta.url),path.join(dir,"ocr-panel.mjs")),
      copyFile(new URL("../src/iiif/ocr-state.mjs",import.meta.url),path.join(dir,"ocr-state.mjs"))]);
    const {createOcrPanel}=await import(/* @vite-ignore */pathToFileURL(path.join(dir,"ocr-panel.mjs")).href);
    vi.stubGlobal("document",{createElement:(tag:string)=>new Element(tag)});
    const t=ocrCandidate();t.ocr_provenance.lines=Array.from({length:201},(_,i)=>({...t.ocr_provenance.lines[0],line_id:String(i)}));
    const raw=sampleWorkspace();(raw.texts as unknown[]).push(t);const w=validateWorkspace(raw), element=new Element("div"), images:any[]=[],messages:string[]=[];
    const panel=createOcrPanel({element,workspace:()=>w,current:()=>({}),status:(s:string)=>messages.push(s),openImage:(...args:any[])=>images.push(args)});
    panel.render();
    find(element,e=>e.tag==="input"&&e.placeholder==="校合の記録者")!.value="review-test";
    const line=find(element,e=>e.tag==="input"&&e.value==="1")!;line.value="201";line.onchange!();
    find(element,e=>e.tag==="button"&&e.textContent==="この行の画像へ")!.onclick!();
    expect(images[0][1].line_id).toBe("200");expect(images[0][1].canvas_xywh).toEqual([100,200,100,200]);
    find(element,e=>e.tag==="textarea"&&e.placeholder==="原画像で確認した内容")!.value="合成fixtureの保留";
    find(element,e=>e.tag==="textarea"&&e.placeholder==="任意の修訂候補")!.value="訂正候補<script>";
    find(element,e=>e.tag==="textarea"&&e.placeholder==="原画像で確認した内容")!.oninput?.();
    find(element,e=>e.tag==="textarea"&&e.placeholder==="任意の修訂候補")!.oninput?.();
    const details=find(element,e=>e.tag==="details")!;details.open=true;details.ontoggle?.();
    panel.render();
    expect(find(element,e=>e.tag==="textarea"&&e.placeholder==="原画像で確認した内容")!.value).toBe("合成fixtureの保留");
    expect(find(element,e=>e.tag==="textarea"&&e.placeholder==="任意の修訂候補")!.value).toBe("訂正候補<script>");
    expect(find(element,e=>e.tag==="details")!.open).toBe(true);
    expect(find(element,e=>e.tag==="input"&&e.value==="201")).toBeDefined();
    find(element,e=>e.tag==="button"&&e.textContent==="原画像との校合を記録")!.onclick!();
    expect(w.texts[0].text).toBe("古い本文\n");expect(w.texts[0].ocr_provenance!.reviews[0]).toMatchObject({result:"uncertain",author:"review-test",corrected_text:"訂正候補<script>"});
    expect(messages.at(-1)).toMatch(/保存/);expect(validateWorkspace(w).texts[0].verification_state).toBe("unverified");
  }finally{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});}
});
