import { mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { readBookStructure,protectBookOutput,writeBookSnapshot,type StructureResult } from "./bookStructure.js";
import { structureFingerprint,structureId,type BookStructure } from "./bookStructureSchemas.js";
import { reviewBookRequestSchema } from "./bookStructureRequests.js";
import { currentBookReviews } from "./bookStructureState.js";
export { reviewBookRequestSchema } from "./bookStructureRequests.js";

export function bookSubjects(b:BookStructure):Map<string,any> {
  return new Map([...b.lines.map(x=>[x.line_ref,x]),...b.regions.map(x=>[x.region_id,x]),...b.spans.map(x=>[x.span_id,x]),
    ...b.units.flatMap(x=>[[x.unit_id,x],...x.fields.map(f=>[f.field_id,f])]),...b.relations.map(x=>[x.relation_id,x])].map(([key,value])=>[key as string,value]));
}
export async function reviewBookStructure(input:z.input<typeof reviewBookRequestSchema>):Promise<StructureResult> {
  const r=reviewBookRequestSchema.parse(input),b=await readBookStructure(r.structure_path,r.expected_sha256);
  await protectBookOutput(r.output_dir,b,[r.structure_path]);
  const subjects=bookSubjects(b);
  for(const d of r.decisions) {
    const subject=subjects.get(d.subject_id);
    if(!subject||structureFingerprint(subject)!==d.subject_sha256)throw Error("確認対象が更新されています。最新の内容で再確認してください");
    const at=new Date().toISOString();
    if(d.replacement_text!==undefined) {
      if(!("field_id" in subject)||d.result!=="needs_review")throw Error("文字訂正はfieldを指定し、確認状態をneeds_reviewにしてください");
      const before=structureFingerprint(subject),oldText=subject.text;
      subject.text=d.replacement_text;subject.normalized_text=subject.text.normalize("NFC");
      const spanLines=new Map(b.spans.map(s=>[s.span_id,s.line_ref]));
      const lineRefs=new Set(subject.span_ids.map((key:string)=>spanLines.get(key)));
      const affected=new Set<string>([d.subject_id]);
      for(const u of b.units)if([...u.span_ids,...u.fields.flatMap(f=>f.span_ids)].some(key=>lineRefs.has(spanLines.get(key)))) {
        affected.add(u.unit_id);for(const f of u.fields)affected.add(f.field_id);
      }
      const captionTargets=new Set(b.relations.filter(rel=>rel.kind==="caption_of"&&affected.has(rel.from_id)).map(rel=>rel.to_id));
      for(const rel of b.relations)if(affected.has(rel.from_id)||affected.has(rel.to_id))affected.add(rel.relation_id);
      for(const rel of b.relations)if(rel.kind==="refers_to"&&captionTargets.has(rel.to_id))affected.add(rel.relation_id);
      const prior=currentBookReviews(b).filter(old=>affected.has(old.subject_id));
      b.revisions.push({revision_id:structureId("revision",b.revisions.length,at,before,subject.text),operation:"replace_text",subject_id:d.subject_id,
        before_sha256:before,payload:{before_text:oldText,replacement_text:subject.text,invalidated_review_ids:b.reviews.filter(old=>affected.has(old.subject_id)).map(old=>old.review_id)},actor:d.actor,recorded_at:at});
      const aspects=new Set<string>();
      for(const old of prior)if(!aspects.has(`${old.subject_id}:${old.aspect}`)) {
        aspects.add(`${old.subject_id}:${old.aspect}`);const current=subjects.get(old.subject_id);if(!current)continue;
        b.reviews.push({...old,review_id:structureId("review",b.reviews.length,at,old.subject_id),subject_sha256:structureFingerprint(current),
          result:"needs_review",actor:{kind:"agent",name:"book-structure"},recorded_at:at,note:"文字訂正に伴う再確認"});
      }
    }
    b.reviews.push({review_id:structureId("review",b.reviews.length,at,d.subject_id),subject_id:d.subject_id,subject_sha256:structureFingerprint(subject),
      aspect:d.aspect,result:d.result,actor:d.actor,note:d.note,recorded_at:at});
  }
  await mkdir(r.output_dir);return writeBookSnapshot(b,r.output_dir);
}
