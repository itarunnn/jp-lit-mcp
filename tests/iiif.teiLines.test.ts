import { describe, expect, it, vi } from "vitest";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { linkTei } from "../src/iiif/tei.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";

const hash = "a".repeat(64), container = "/t:TEI[1]/t:text[1]/t:body[1]/t:p[1]";
const loc = (xpath: string) => ({ document_sha256: hash, xpath, xml_id: null });
function input(): any {
  const source = loc(container + "/t:lb[1]");
  return { api_version:"0.1", operation:"facsimile_links", ok:true, document:{sha256:hash}, result:{total_occurrences:1,next_offset:null,items:[{
    source_locator:source,source_content:{kind:"element",name:"{http://www.tei-c.org/ns/1.0}lb",attributes:{corresp:"#z"},content:[]},
    omission:null,attribute_name:"corresp",attribute_value:"#z",token_index:0,raw_token:"#z",reference_status:"resolved_local",candidate_count:1,xml_base_chain:[],
    target:{locator:loc("/t:TEI[1]/t:facsimile[1]/t:surface[1]/t:zone[1]"),name:"{http://www.tei-c.org/ns/1.0}zone",attributes:{ulx:"10",uly:"20",lrx:"60",lry:"120"},xml_base_chain:[]},
    surface:{locator:loc("/t:TEI[1]/t:facsimile[1]/t:surface[1]"),name:"{http://www.tei-c.org/ns/1.0}surface",attributes:{sameAs:sampleWorkspace().windows[0].canvas_id,ulx:"0",uly:"0",lrx:"150",lry:"200"},xml_base_chain:[]},graphics:[],diagnostics:[],
    facs_origin:{kind:"explicit",locator:source,attribute_value:"#z"},
    line_range:{start_locator:{...source},end_locator:loc(container+"/t:lb[2]"),container_locator:loc(container),boundary:"next_milestone",omission:null,
      content:{kind:"fragment",content:[{kind:"text",value:"甲<script>"},{kind:"element",name:"{http://www.tei-c.org/ns/1.0}hi",attributes:{},locator:loc(container+"/t:hi[1]"),content:[{kind:"text",value:"字"}]}]}}
  }]}};
}
const options = {file_path:path.join(tmpdir(),"local-ocr-source.xml"),expected_sha256:hash,document_id:"d1",surface_bindings:[]};

describe("Local OCR line range contract", () => {
  it.each(["start", "end", "container", "content", "omission"])("rejects a substituted %s locator hash", key => {
    const response=input(),r=response.result.items[0].line_range;
    if(key==="omission") { r.content=null;r.omission={code:"unit_too_large",locator:{...r.start_locator,document_sha256:"b".repeat(64)}}; }
    else (key==="content"?r.content.content[1].locator:r[`${key}_locator`]).document_sha256="b".repeat(64);
    expect(()=>linkTei(sampleWorkspace(),response,options)).toThrow();
  });
  it.each(["different_start", "foreign_container", "foreign_content", "wrong_source", "wrong_target", "missing_origin", "bad_boundary", "wrong_attribute"])("rejects inconsistent line provenance: %s", kind => {
    const response=input(),ref=response.result.items[0],r=ref.line_range;
    if(kind==="different_start")r.start_locator=loc(container+"/t:lb[99]");
    if(kind==="foreign_container")r.container_locator=loc("/t:TEI[1]/t:div[3]");
    if(kind==="foreign_content")r.content.content[1].locator=loc("/t:TEI[1]/t:facsimile[1]");
    if(kind==="wrong_source")ref.source_content.name="{http://www.tei-c.org/ns/1.0}ref";
    if(kind==="wrong_target")ref.target.name="{http://www.tei-c.org/ns/1.0}surface";
    if(kind==="missing_origin")delete ref.facs_origin;
    if(kind==="bad_boundary")r.boundary="container_end";
    if(kind==="wrong_attribute")delete ref.attribute_name;
    expect(()=>linkTei(sampleWorkspace(),response,options)).toThrow();
  });
  it("shows line content and opens the resolved image in the actual panel", async () => {
    class Element {
      children:Element[]=[];textContent="";value="";dataset:Record<string,string>={};className="";onclick?:()=>void;
      constructor(public tag:string){} append(...v:Element[]){this.children.push(...v);}replaceChildren(...v:Element[]){this.children=v;}setAttribute(){}scrollIntoView(){}
    }
    const dir=await mkdtemp(path.join(tmpdir(),"tei-lines-panel-"));
    try {
      await copyFile(new URL("../packages/iiif-workbench/web/tei-panel.mjs",import.meta.url),path.join(dir,"tei-panel.mjs"));
      await copyFile(new URL("../src/iiif/tei-state.mjs",import.meta.url),path.join(dir,"tei-state.mjs"));
      const {createTeiPanel}=await import(pathToFileURL(path.join(dir,"tei-panel.mjs")).href);
      vi.stubGlobal("document",{createElement:(tag:string)=>new Element(tag)});
      const w=linkTei(sampleWorkspace(),input(),options),root=new Element("section"),opened:any[]=[];
      createTeiPanel({element:root,workspace:()=>w,current:()=>({}),openImage:(link:any)=>opened.push(link.target),selectedRegions:()=>[],status:()=>{}}).render();
      const elements=(e:Element):Element[]=>[e,...e.children.flatMap(elements)],all=elements(root);
      expect(all.some(e=>e.tag==="pre"&&e.textContent.includes("甲&lt;script&gt;")&&e.textContent.includes("字"))).toBe(true);
      expect(all.some(e=>e.textContent.includes("改行後の本文"))).toBe(true);
      all.find(e=>e.tag==="button"&&e.textContent==="対応する画像へ")!.onclick!();
      expect(opened).toEqual([w.tei_links![0].target]);
    } finally {vi.unstubAllGlobals();await rm(dir,{recursive:true,force:true});}
  });
});
