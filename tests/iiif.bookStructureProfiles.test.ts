import { expect, it } from "vitest";
import { applyBookProfile } from "../src/iiif/bookStructureProfiles.js";
import { bookFixture } from "./fixtures/iiif/bookStructure.js";

function dictionary() {
  const b=bookFixture();b.profile="dictionary";b.lines=[];b.regions=[];b.spans=[];b.units=[];
  Object.assign(b.pages[0],{canvas_xywh:[0,0,1000,2000],image_width:500,image_height:1000});
  b.pages.push({...b.pages[0],page_id:"p2",sequence_index:1,text_id:"t2",printed_label:"2"});
  function line(id:string,page:string,text:string,x:number,y:number) {
    b.lines.push({line_ref:id,page_id:page,original_line_id:id,raw_text:text,image_xywh:[x,y,20,300],canvas_xywh:[x*2,y*2,40,600],source_locator:{}});
    b.regions.push({region_id:"r"+id,page_id:page,kind:"text",image_xywh:[x,y,20,300],canvas_xywh:[x*2,y*2,40,600],line_refs:[id],origin:"ocr_line",source_locator:{}});
    b.spans.push({span_id:"s"+id,line_ref:id,range_cp:[0,Array.from(text).length]});
    b.units.push({unit_id:"u"+id,kind:"text",region_ids:["r"+id],span_ids:["s"+id],fields:[{field_id:"f"+id,role:"text",span_ids:["s"+id],raw_text:text,text,normalized_text:text}]});
  }
  line("a","p1","あ（名）①語釋。「用例」",450,20);
  line("b","p1","續き",420,20);line("c","p1","あ（感）呼ぶ語",390,20);
  line("d","p2","頁頭の續き",480,51);line("e","p2","い（名）次の語",450,51);
  return b;
}

it("extracts independent repeated headwords and senses/examples despite shifted page rows",()=>{
  const b=applyBookProfile(dictionary()),entries=b.units.filter(u=>u.kind==="entry");
  expect(entries.map(u=>u.fields.find(f=>f.role==="headword")?.text)).toEqual(["あ","あ","い"]);
  expect(b.units.filter(u=>u.kind==="example").map(u=>u.fields.find(f=>f.role==="quote")?.text)).toEqual(["用例"]);
  expect(b.units.some(u=>u.kind==="sense"&&u.fields.some(f=>f.role==="definition"&&f.raw_text.includes("語釋")))).toBe(true);
  expect(b.lines.map(l=>l.raw_text)).toEqual(["あ（名）①語釋。「用例」","續き","あ（感）呼ぶ語","頁頭の續き","い（名）次の語"]);
  expect(b.relations.filter(r=>r.kind==="continues")).toHaveLength(1);
});

it("holds continuation across an explicit missing page",()=>{
  const b=dictionary();b.pages[1].sequence_index=2;
  b.pages.push({...b.pages[0],page_id:"missing",sequence_index:1,coverage:"ocr_failed",text_id:null,image_path:null,image_sha256:null,image_width:null,image_height:null,canvas_xywh:null});
  const parsed=applyBookProfile(b);
  expect(parsed.relations.filter(r=>r.kind==="continues")).toHaveLength(0);
  expect(parsed.diagnostics.some(s=>s.startsWith("continuation_gap:"))).toBe(true);
});

it("keeps competing caption associations and uses figure number for body references",()=>{
  const b=bookFixture();b.spans[0].range_cp=[0,6];
  b.units[0].kind="text";b.units[0].region_ids=[];b.units[0].fields[0].role="text";
  b.regions.push({...b.regions[0],region_id:"r2",image_xywh:[15,15,120,120],canvas_xywh:[130,230,240,240]});
  b.lines.push({...b.lines[0],line_ref:"body",original_line_id:"1",raw_text:"本文は図一を參照",image_xywh:[130,10,15,120],canvas_xywh:[360,220,30,240]});
  b.spans.push({span_id:"body-span",line_ref:"body",range_cp:[0,9]});
  b.units.push({unit_id:"body-unit",kind:"text",region_ids:[],span_ids:["body-span"],fields:[{field_id:"body-field",role:"text",span_ids:["body-span"],raw_text:"本文は図一を參照",text:"本文は図一を參照",normalized_text:"本文は図一を參照"}]});
  b.spans[1].range_cp=[0,8];
  const result=applyBookProfile(b);
  expect(result.units.filter(u=>u.kind==="figure")).toHaveLength(2);
  expect(result.relations.filter(r=>r.kind==="caption_of")).toHaveLength(2);
  expect(result.relations.filter(r=>r.kind==="refers_to")).toHaveLength(2);
  expect(result.diagnostics.some(s=>s.startsWith("ambiguous_caption:"))).toBe(true);
  expect(result.relations.filter(r=>r.kind==="precedes")).toHaveLength(0);
});
