import { expect, it, vi } from "vitest";
import { copyFile, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { readingFixture } from "./fixtures/iiif/reading.js";
import { prepareReading,importReading } from "../src/iiif/reading.js";
import { validateWorkspace } from "../src/iiif/schemas.js";
class Element {
  children:Element[]=[];textContent="";value="";disabled=false;placeholder="";open=false;
  onclick?:()=>void;oninput?:()=>void;onchange?:()=>void;ontoggle?:()=>void;
  constructor(public tag:string){}
  append(...e:Element[]){this.children.push(...e);} replaceChildren(...e:Element[]){this.children=e;}
  setAttribute(){} scrollIntoView(){}
}
function find(root:Element,p:(e:Element)=>boolean):Element|undefined {
  if(p(root))return root;for(const c of root.children){const hit=find(c,p);if(hit)return hit;}
}
it("shows doubts safely and records an AI confirmation separately from the text",async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),"reading-panel-"));
  try {
    for(const [from,to] of [["packages/iiif-workbench/web/reading-panel.mjs","reading-panel.mjs"],["src/iiif/reading-state.mjs","reading-state.mjs"],["src/iiif/ocr-state.mjs","ocr-state.mjs"]])
      await copyFile(new URL("../"+from,import.meta.url),path.join(dir,to));
    const {createReadingPanel}=await import(/* @vite-ignore */pathToFileURL(path.join(dir,"reading-panel.mjs")).href);
    const f=await readingFixture(),task=await prepareReading(f.workspacePath,f.imported.texts[0].text_id,"image_reading",path.join(f.dir,"task"));
    const raw=JSON.parse(await readFile(task.response_template_path,"utf8"));Object.assign(raw,{generator:"test",image_opened:true,text:"候補<script>",doubts:[{quote:"候補",alternatives:["古本"],note:"画像で保留"}]});
    const responsePath=path.join(f.dir,"response.json");await writeFile(responsePath,JSON.stringify(raw));
    let w=(await importReading(f.imported,task.task_path,responsePath,path.join(f.dir,"next.json"))).workspace;
    vi.stubGlobal("document",{createElement:(tag:string)=>new Element(tag)});
    const element=new Element("section"),images:string[]=[],messages:string[]=[];let busy=false;
    const panel=createReadingPanel({element,workspace:()=>w,setWorkspace:(next:any)=>{w=next;},assertEditable:()=>{if(busy)throw Error("保存中");},status:(s:string)=>messages.push(s),openImage:(t:any)=>images.push(t.text_id)});
    panel.render();expect(find(element,e=>e.tag==="pre"&&e.textContent==="候補<script>")).toBeDefined();
    find(element,e=>e.tag==="button"&&e.textContent==="原画像の領域へ")!.onclick!();expect(images).toEqual([w.texts[1].text_id]);
    const author=find(element,e=>e.tag==="input"&&e.placeholder==="確認の記録者")!;author.value="test-reader";author.oninput!();
    const note=find(element,e=>e.tag==="textarea"&&e.placeholder==="画像で確認した内容")!;note.value="AIによる実見、未校合";note.oninput!();
    const type=find(element,e=>e.tag==="select"&&e.value==="human")!;type.value="ai";type.onchange!();
    panel.render();expect(find(element,e=>e.tag==="textarea"&&e.value==="AIによる実見、未校合")).toBeDefined();
    find(element,e=>e.tag==="button"&&e.textContent==="原画像との確認を記録")!.onclick!();
    expect(w.texts[1].text).toBe(raw.text);expect(validateWorkspace(w).texts[1].reading_provenance!.reviews[0]).toMatchObject({reviewer_type:"ai",result:"uncertain",author:"test-reader"});
    const secondAuthor=find(element,e=>e.tag==="input"&&e.placeholder==="確認の記録者")!;secondAuthor.value="blocked-reader";secondAuthor.oninput!();
    const secondNote=find(element,e=>e.tag==="textarea"&&e.placeholder==="画像で確認した内容")!;secondNote.value="保存中に追加を試す";secondNote.oninput!();
    busy=true;find(element,e=>e.tag==="button"&&e.textContent==="原画像との確認を記録")!.onclick!();
    expect(w.texts[1].reading_provenance!.reviews).toHaveLength(1);expect(messages.at(-1)).toBe("保存中");busy=false;
    w.regions[0].selection.xywh[0]++;panel.render();expect(find(element,e=>e.tag==="button"&&e.textContent==="原画像の領域へ")!.disabled).toBe(true);
  }finally{vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});}
});
