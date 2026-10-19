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

it("links several entirely headless ready pages while holding a gap",()=>{
  const b=dictionary();b.lines.find(l=>l.line_ref==="e")!.raw_text="更に續く説明";
  b.spans.find(s=>s.line_ref==="e")!.range_cp=[0,Array.from("更に續く説明").length];
  Object.assign(b.units.find(u=>u.unit_id==="ue")!.fields[0],{raw_text:"更に續く説明",text:"更に續く説明",normalized_text:"更に續く説明"});
  b.pages.push({...b.pages[1],page_id:"p3",sequence_index:2});
  b.lines.push({...b.lines.find(l=>l.line_ref==="d")!,line_ref:"f",page_id:"p3"});
  b.regions.push({...b.regions.find(r=>r.region_id==="rd")!,region_id:"rf",page_id:"p3",line_refs:["f"]});
  b.spans.push({span_id:"sf",line_ref:"f",range_cp:[0,Array.from("頁頭の續き").length]});
  b.units.push({unit_id:"uf",kind:"text",region_ids:["rf"],span_ids:["sf"],fields:[{...b.units.find(u=>u.unit_id==="ud")!.fields[0],field_id:"ff",span_ids:["sf"]}]});
  const ready=applyBookProfile(b);expect(ready.relations.filter(r=>r.kind==="continues").map(r=>r.to_id)).toEqual(["ud","uf"]);
  b.pages[1].sequence_index=3;b.pages[2].sequence_index=4;
  const gap=applyBookProfile(b);expect(gap.relations.filter(r=>r.kind==="continues")).toHaveLength(0);
  expect(gap.diagnostics.some(s=>s.startsWith("continuation_gap:"))).toBe(true);
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
  expect(result.relations.filter(r=>r.kind==="caption_of").every(r=>r.reasons.some(s=>s.startsWith("normalized_center_distance:")))).toBe(true);
});

function numberedFigure(caption:string,body:string) {
  const b=bookFixture();
  b.lines[0].raw_text=caption;b.spans[0].range_cp=[0,Array.from(caption).length];
  Object.assign(b.units[0],{kind:"text",region_ids:[]});
  Object.assign(b.units[0].fields[0],{role:"text",raw_text:caption,text:caption,normalized_text:caption.normalize("NFC")});
  b.lines.push({...b.lines[0],line_ref:"body",raw_text:body});
  b.spans.push({span_id:"body-span",line_ref:"body",range_cp:[0,Array.from(body).length]});
  b.units.push({unit_id:"body-unit",kind:"text",region_ids:[],span_ids:["body-span"],fields:[{field_id:"body-field",role:"text",span_ids:["body-span"],raw_text:body,text:body,normalized_text:body.normalize("NFC")}]});
  return b;
}

it.each([
  ["図一〇","本文は図十を參照","figure:10"],
  ["図１０","本文は図一〇を參照","figure:10"],
  ["表二〇二","本文は表202を參照","table:202"],
])("links equivalent figure numbers %s",(caption,body,key)=>{
  const b=numberedFigure(caption,body);if(caption.startsWith("表"))b.regions[0].kind="table";
  const links=applyBookProfile(b).relations.filter(r=>r.kind==="refers_to");
  expect(links).toHaveLength(1);expect(links[0].reasons).toContain(key);
});

it("keeps different long figure numbers distinct",()=>{
  const b=numberedFigure("図12345678901234567890","本文は図12345678901234567891を參照");
  expect(applyBookProfile(b).relations.filter(r=>r.kind==="refers_to")).toHaveLength(0);
});

function illustratedPage(boxes: number[][], captions: {id:string;text:string;box:number[]|null}[]) {
  const b=bookFixture();b.lines=[];b.regions=[];b.spans=[];b.units=[];
  Object.assign(b.pages[0],{canvas_width:1500,canvas_height:2000,canvas_xywh:[0,0,1500,2000],image_width:1500,image_height:2000});
  boxes.forEach((box,i)=>b.regions.push({region_id:`figure-${i}`,page_id:"p1",kind:"figure",image_xywh:box,canvas_xywh:box,line_refs:[],origin:"ocr_layout",source_locator:{}}));
  for(const {id,text,box}of captions){
    b.lines.push({line_ref:id,page_id:"p1",original_line_id:id,raw_text:text,image_xywh:box,canvas_xywh:box,source_locator:{}});
    b.regions.push({region_id:`region-${id}`,page_id:"p1",kind:"text",image_xywh:box,canvas_xywh:box,line_refs:[id],origin:"ocr_line",source_locator:{}});
    b.spans.push({span_id:`span-${id}`,line_ref:id,range_cp:[0,Array.from(text).length]});
    b.units.push({unit_id:`unit-${id}`,kind:"text",region_ids:[`region-${id}`],span_ids:[`span-${id}`],fields:[{field_id:`field-${id}`,role:"text",span_ids:[`span-${id}`],raw_text:text,text,normalized_text:text}]});
  }
  return b;
}

it("groups near-identical figure detections while retaining both source regions",()=>{
  const input=illustratedPage([[300,300,500,700],[305,305,500,700]],[]);
  const result=applyBookProfile(input),figures=result.units.filter(u=>u.kind==="figure");
  expect(figures).toHaveLength(1);
  expect(figures[0].region_ids).toEqual(["figure-0","figure-1"]);
  expect(result.regions).toEqual(input.regions);
  expect(input.units).toHaveLength(0);
});

it("preserves separate part figures and identical rectangles on different pages",()=>{
  const b=illustratedPage([[300,300,700,800],[350,350,250,600]],[]);
  b.pages.push({...b.pages[0],page_id:"p2",sequence_index:1});
  b.regions.push({...b.regions[0],region_id:"other-page",page_id:"p2"});
  expect(applyBookProfile(b).units.filter(u=>u.kind==="figure")).toHaveLength(3);
});

it("treats a long vertical figure reference as body text rather than a caption",()=>{
  const b=illustratedPage([[270,327,277,273]],[
    {id:"caption",text:"第二十五圖",box:[350,246,145,27]},
    {id:"body",text:"第二十五圖ハ葉ノ配置ヲ示ス",box:[1000,220,40,1400]},
  ]);
  const result=applyBookProfile(b);
  expect(result.relations.filter(r=>r.kind==="caption_of").map(r=>r.from_id)).toEqual(["unit-caption"]);
  expect(result.relations.filter(r=>r.kind==="refers_to").map(r=>r.from_id)).toEqual(["unit-body"]);
});

it("associates stacked figure labels with their own nearby aligned figures",()=>{
  const b=illustratedPage([[271,327,277,273],[290,766,254,422],[200,1309,492,402]],[
    {id:"25",text:"第二十五圖",box:[350,246,145,27]},
    {id:"26",text:"第二十六圖",box:[350,698,146,29]},
    {id:"27",text:"第二十七圖",box:[357,1230,148,29]},
  ]);
  const result=applyBookProfile(b),links=result.relations.filter(r=>r.kind==="caption_of");
  expect(links).toHaveLength(3);
  expect(links.map(r=>[r.from_id,result.units.find(u=>u.unit_id===r.to_id)!.region_ids[0]])).toEqual([
    ["unit-25","figure-0"],["unit-26","figure-1"],["unit-27","figure-2"],
  ]);
});

it("holds captions with no aligned nearby figure instead of assigning a distant one",()=>{
  const b=illustratedPage([[1000,400,200,600]],[{id:"caption",text:"第一圖",box:[300,300,160,30]}]);
  const result=applyBookProfile(b);
  expect(result.relations.filter(r=>r.kind==="caption_of")).toHaveLength(0);
  expect(result.diagnostics.some(d=>d.startsWith("unmatched_caption:"))).toBe(true);
});

it("preserves mixed caption placement when a page has labels above and below figures",()=>{
  const b=illustratedPage([[300,300,200,200],[300,800,200,200],[300,1300,200,200]],[
    {id:"a",text:"第一圖",box:[320,240,160,30]},
    {id:"b",text:"第二圖",box:[320,740,160,30]},
    {id:"c",text:"第三圖",box:[320,1520,160,30]},
  ]);
  const result=applyBookProfile(b),links=result.relations.filter(r=>r.kind==="caption_of");
  expect(links.map(r=>[r.from_id,result.units.find(u=>u.unit_id===r.to_id)!.region_ids[0]])).toEqual([
    ["unit-a","figure-0"],["unit-b","figure-1"],["unit-c","figure-2"],
  ]);
});

it("prefers a caption beside its figure over a large enclosing detection",()=>{
  const b=illustratedPage([[300,1200,500,400],[300,300,600,1400]],[{id:"caption",text:"第二十圖",box:[450,1140,200,30]}]);
  const result=applyBookProfile(b),links=result.relations.filter(r=>r.kind==="caption_of");
  expect(links.map(r=>result.units.find(u=>u.unit_id===r.to_id)!.region_ids[0])).toEqual(["figure-0"]);
});

it("keeps an explicit caption with unavailable coordinates as an unscored candidate",()=>{
  const b=illustratedPage([[300,300,500,700]],[{id:"caption",text:"圖版の説明",box:null}]);
  b.regions.push({region_id:"explicit",page_id:"p1",kind:"caption",image_xywh:null,canvas_xywh:null,line_refs:["caption"],origin:"ocr_layout",source_locator:{}});
  const links=applyBookProfile(b).relations.filter(r=>r.kind==="caption_of");
  expect(links).toHaveLength(1);expect(links[0].score).toBeNull();expect(links[0].reasons).toContain("distance_unavailable");
});

it("retains an explicitly classified long vertical caption",()=>{
  const b=illustratedPage([[300,300,400,700]],[{id:"caption",text:"図版の長い説明文",box:[740,350,40,500]}]);
  b.regions.push({...b.regions.at(-1),region_id:"explicit-caption",kind:"caption",origin:"ocr_layout"});
  expect(applyBookProfile(b).relations.filter(r=>r.kind==="caption_of")).toHaveLength(1);
});

it("retains a caption inside its figure when another separate figure is outside",()=>{
  const b=illustratedPage([[300,300,400,400],[300,800,400,400]],[{id:"caption",text:"第一圖",box:[380,650,200,30]}]);
  const result=applyBookProfile(b),links=result.relations.filter(r=>r.kind==="caption_of");
  expect(links.map(r=>result.units.find(u=>u.unit_id===r.to_id)!.region_ids[0])).toEqual(["figure-0"]);
});

it("holds both close candidates for a caption between mixed-position figures",()=>{
  const b=illustratedPage([[300,300,200,200],[300,800,200,200],[300,1300,200,200],[300,1580,200,200]],[
    {id:"a",text:"第一圖",box:[320,240,160,30]},
    {id:"b",text:"第二圖",box:[320,740,160,30]},
    {id:"c",text:"第三圖",box:[320,1520,160,30]},
  ]);
  const result=applyBookProfile(b),links=result.relations.filter(r=>r.kind==="caption_of"&&r.from_id==="unit-c");
  expect(links.map(r=>result.units.find(u=>u.unit_id===r.to_id)!.region_ids[0])).toEqual(["figure-2","figure-3"]);
  expect(result.diagnostics).toContain("ambiguous_caption:c");
});
