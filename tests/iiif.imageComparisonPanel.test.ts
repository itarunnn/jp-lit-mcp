import { expect,it,vi } from "vitest";
import { copyFile,mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { comparisonFixture } from "./fixtures/iiif/imageComparison.js";
import { compareImages } from "../src/iiif/imageComparison.js";
import { mergeComparison } from "../src/iiif/image-comparison-state.mjs";
class Element{children:Element[]=[];textContent="";value="";disabled=false;dataset:Record<string,string>={};placeholder="";src="";alt="";open=false;
 onclick?:()=>unknown;oninput?:()=>unknown;onchange?:()=>unknown;rows=0;constructor(public tag:string){}append(...c:Element[]){this.children.push(...c);}replaceChildren(...c:Element[]){this.children=c;}scrollIntoView(){}}
function find(e:Element,p:(e:Element)=>boolean):Element|undefined{if(p(e))return e;for(const c of e.children){const result=find(c,p);if(result)return result;}}
it("shows candidate geometry, navigates both sources and preserves separate review history after rerender",async()=>{
 const root=await mkdtemp(path.join(tmpdir(),"image-panel-"));
 try{
  const f=await comparisonFixture(root),record=await compareImages(f.w,f.query,f.candidates,path.join(root,"result"));let w=mergeComparison(f.w,record);
  await copyFile(new URL("../packages/iiif-workbench/web/image-comparison-panel.mjs",import.meta.url),path.join(root,"panel.mjs"));
  await copyFile(new URL("../src/iiif/image-comparison-state.mjs",import.meta.url),path.join(root,"image-comparison-state.mjs"));
  const {createImageComparisonPanel}=await import(/* @vite-ignore */pathToFileURL(path.join(root,"panel.mjs")).href);
  vi.stubGlobal("document",{createElement:(tag:string)=>new Element(tag)});const element=new Element("section"),images:string[]=[],messages:string[]=[];
  const panel=createImageComparisonPanel({element,workspace:()=>w,setWorkspace:(next:any)=>{w=next;},status:(s:string)=>messages.push(s),compare:async()=>record,
   importReport:async()=>record,openImage:(source:any)=>images.push(source.selection.region_id),preview:async()=>"data:image/png;base64,AA=="});panel.render();
  find(element,e=>e.tag==="button"&&e.textContent==="基準の原領域へ")!.onclick!();find(element,e=>e.tag==="button"&&e.textContent==="候補の原領域へ")!.onclick!();expect(images).toEqual(["r1","r2"]);
  await find(element,e=>e.tag==="button"&&e.textContent==="比較画像を表示")!.onclick!();expect(find(element,e=>e.tag==="img")!.src).toMatch(/^data:image\/png/);
  const author=find(element,e=>e.placeholder==="図版対応を確認した人")!,note=find(element,e=>e.placeholder==="画像で確認した対応・相違・保留理由")!;
  author.value="reader";author.oninput!();note.value="同じ印の配置を確認した合成fixture";note.oninput!();
  find(element,e=>e.tag==="button"&&e.textContent==="図版の対応確認を記録")!.onclick!();expect(w.image_comparisons![0].reviews[0].result).toBe("uncertain");
  panel.render();expect(w.image_comparisons![0].reviews).toHaveLength(1);w.regions.pop();panel.render();
  expect(find(element,e=>e.tag==="p"&&e.textContent.includes("最新の図版確認: 判断保留")&&e.textContent.includes("reader"))).toBeDefined();
  expect(find(element,e=>e.tag==="button"&&e.textContent==="候補の原領域へ")!.disabled).toBe(true);expect(w.image_comparisons).toHaveLength(1);
 }finally{vi.unstubAllGlobals();await rm(root,{recursive:true,force:true});}
},20000);
