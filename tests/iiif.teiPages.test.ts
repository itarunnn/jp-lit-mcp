import { describe, it, expect, vi } from "vitest";
import { mkdtemp, readFile, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { linkTei } from "../src/iiif/tei.js";
import { validateWorkspace } from "../src/iiif/schemas.js";
import { saveWorkspace } from "../src/iiif/workspace.js";
import { exportEvidence } from "../src/iiif/evidence.js";
// @ts-expect-error Nodeとbrowserで共有するmodule
import { bindTeiLink, recordTeiCollation, formatTei } from "../src/iiif/tei-state.mjs";

const hash = "a".repeat(64), prefix = "/t:TEI[1]/t:text[1]";
const loc = (suffix: string, xml_id: string|null = null) => ({ document_sha256: hash, xpath: prefix + suffix, xml_id });
function input() {
  const w = sampleWorkspace(), canvas = w.windows[0].canvas_id;
  return { api_version:"0.1", operation:"facsimile_links", ok:true, document:{sha256:hash}, result:{total_occurrences:1,next_offset:null,items:[{
    source_locator:loc("/t:body[1]/t:p[1]/t:pb[1]","a"),
    source_content:{kind:"element",name:"{http://www.tei-c.org/ns/1.0}pb",attributes:{facs:canvas},content:[]},
    omission:null,attribute_value:canvas,token_index:0,raw_token:canvas,reference_status:"external_unverified",candidate_count:0,xml_base_chain:[],
    target:null,surface:null,graphics:[],diagnostics:[],
    facs_origin:{kind:"explicit",locator:loc("/t:body[1]/t:p[1]/t:pb[1]","a"),attribute_value:canvas},
    page_range:{start_locator:loc("/t:body[1]/t:p[1]/t:pb[1]","a"),end_locator:loc("/t:body[1]/t:p[1]/t:pb[2]","b"),container_locator:loc(""),boundary:"next_pb",edition:{ed:null,ed_ref:null},omission:null,
      content:{kind:"fragment",content:[{kind:"element",name:"{http://www.tei-c.org/ns/1.0}p",attributes:{},locator:loc("/t:body[1]/t:p[1]"),partial:true,content:[{kind:"text",value:"甲<script>"}]}]}}
  }]}};
}
const options = {file_path:"J:/research/source.xml",expected_sha256:hash,document_id:"d1",surface_bindings:[]};

describe("TEI page range preservation", () => {
  it.each(["origin","start","end","container","content"])("rejects a substituted %s locator hash", key => {
    const response = input(), ref = response.result.items[0];
    const target = key === "origin" ? ref.facs_origin.locator : key === "content" ? ref.page_range.content.content[0].locator : ref.page_range[`${key}_locator` as "start_locator"];
    target.document_sha256 = "b".repeat(64);
    expect(() => linkTei(sampleWorkspace(), response, options)).toThrow();
  });
  it("rejects a range whose start differs from the source and an unrelated inherited owner", () => {
    const response = input(); response.result.items[0].page_range.start_locator.xpath = prefix + "/t:pb[99]";
    expect(() => linkTei(sampleWorkspace(), response, options)).toThrow();
    const ancestor = input(); ancestor.result.items[0].facs_origin.kind = "ancestor";
    ancestor.result.items[0].facs_origin.locator.xpath = prefix + "/t:div[99]";
    expect(() => linkTei(sampleWorkspace(), ancestor, options)).toThrow();
  });
  it("renders a fragment without choosing a text branch or executing markup", () => {
    expect(formatTei(input().result.items[0].page_range.content)).toBe("<tei:p>甲&lt;script&gt;</tei:p>");
  });
  it("keeps old collation snapshots when reimporting the same ID with a page range", () => {
    const response = input(), legacy = structuredClone(response) as any;
    delete legacy.result.items[0].page_range; delete legacy.result.items[0].facs_origin;
    const w = linkTei(sampleWorkspace(), legacy, options), link = w.tei_links![0];
    bindTeiLink(w, link.link_id, "r1", "reader", "旧対応を確認");
    recordTeiCollation(w, link.link_id, "reader", "uncertain", "旧snapshotの確認");
    const snapshot = structuredClone(link);
    expect(linkTei(w, response, options).tei_links![0]).toEqual(snapshot);
  });
  it("saves and exports the range and origin as overlap context", async () => {
    const w = linkTei(sampleWorkspace(), input(), options);
    const dir = await mkdtemp(path.join(tmpdir(),"tei-page-export-"));
    try {
      const file = path.join(dir,"workspace.json"); await saveWorkspace(file,w,false);
      const saved = validateWorkspace(JSON.parse(await readFile(file,"utf8")));
      expect(saved.tei_links![0].reference.page_range!.end_locator!.xml_id).toBe("b");
      const result = await exportEvidence({api_version:"0.1",operation:"export_evidence",workspace_path:file,region_ids:["r1"],output_dir:path.join(dir,"export"),overwrite:false,image_permission_confirmed:false});
      const refs = JSON.parse(await readFile(result.tei_paths[0],"utf8"));
      expect(refs[0].reference.page_range.content.content[0].content[0].value).toBe("甲<script>");
      expect(refs[0].reference.facs_origin.locator.xml_id).toBe("a");
      const evidence = JSON.parse(await readFile(result.evidence_json_path,"utf8"));
      expect(evidence.items[0].tei_scope).toBe("overlap_context");
      expect(await readFile(result.text_paths[0],"utf8")).toBe("");
    } finally { await rm(dir,{recursive:true,force:true}); }
  });
  it("shows the page text and boundary in the actual panel", async () => {
    class Element {
      children:Element[]=[];textContent="";value="";dataset:Record<string,string>={};className="";
      constructor(public tag:string) {} append(...v:Element[]){this.children.push(...v);}replaceChildren(...v:Element[]){this.children=v;}setAttribute(){}scrollIntoView(){}
    }
    const dir = await mkdtemp(path.join(tmpdir(),"tei-page-panel-"));
    try {
      await copyFile(new URL("../packages/iiif-workbench/web/tei-panel.mjs",import.meta.url),path.join(dir,"tei-panel.mjs"));
      await copyFile(new URL("../src/iiif/tei-state.mjs",import.meta.url),path.join(dir,"tei-state.mjs"));
      const {createTeiPanel}=await import(/* @vite-ignore */ pathToFileURL(path.join(dir,"tei-panel.mjs")).href);
      vi.stubGlobal("document",{createElement:(tag:string)=>new Element(tag)});
      const w=linkTei(sampleWorkspace(),input(),options),root=new Element("div");
      createTeiPanel({element:root,workspace:()=>w,current:()=>({}),openImage:()=>{},selectedRegions:()=>[],status:()=>{}}).render();
      const texts=(e:Element):string[]=>[e.textContent,...e.children.flatMap(texts)];
      expect(texts(root)).toContain("<tei:p>甲&lt;script&gt;</tei:p>");
      expect(texts(root).some(t=>t.includes("改頁後")&&t.includes("次の改頁"))).toBe(true);
    } finally { vi.unstubAllGlobals(); await rm(dir,{recursive:true,force:true}); }
  });
});
