import { afterEach, expect, it } from "vitest";
import { mkdtemp,readFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildBookStructure } from "../src/iiif/bookStructure.js";
import { reviewBookStructure } from "../src/iiif/bookStructureReview.js";
import { structureFingerprint } from "../src/iiif/bookStructureSchemas.js";
import { currentBookReviews } from "../src/iiif/bookStructureState.js";
import { makeBookRun } from "./fixtures/iiif/bookRun.js";
const dirs:string[]=[];afterEach(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
it("keeps OCR immutable, records actor and invalidates prior acceptance after a correction",async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),"book-review-"));dirs.push(dir);const f=await makeBookRun(dir);
  const built=await buildBookStructure({workspace_path:f.workspacePath,text_ids:[f.textId],profile:"general",output_dir:path.join(dir,"built")});
  const original=await readFile(built.structure_path,"utf8"),b=JSON.parse(original),field=b.units[0].fields[0];
  const decision={subject_id:field.field_id,subject_sha256:structureFingerprint(field),aspect:"transcription" as const,result:"accepted" as const,
    actor:{kind:"human" as const,name:"test reader"},note:"原画像と照合"};
  const accepted=await reviewBookStructure({structure_path:built.structure_path,expected_sha256:built.structure_sha256,decisions:[decision],output_dir:path.join(dir,"accepted")});
  const rechecked=await reviewBookStructure({structure_path:accepted.structure_path,expected_sha256:accepted.structure_sha256,decisions:[{...decision,result:"rejected"}],output_dir:path.join(dir,"rechecked")});
  const corrected=await reviewBookStructure({structure_path:rechecked.structure_path,expected_sha256:rechecked.structure_sha256,
    decisions:[{...decision,actor:{kind:"agent",name:"test reviewer"},result:"needs_review",replacement_text:"図一　花の図"}],output_dir:path.join(dir,"corrected")});
  const result=JSON.parse(await readFile(corrected.structure_path,"utf8"));
  expect(result.lines[0].raw_text).toBe("圖一　花の圖");
  expect(result.units[0].fields[0]).toMatchObject({raw_text:"圖一　花の圖",text:"図一　花の図"});
  expect(result.reviews.at(-1)).toMatchObject({result:"needs_review",actor:{kind:"agent",name:"test reviewer"}});
  expect(result.revisions[0].operation).toBe("replace_text");
  expect(result.revisions[0].payload.invalidated_review_ids).toContain(JSON.parse(await readFile(accepted.structure_path,"utf8")).reviews[0].review_id);
  expect(currentBookReviews(result).some(r=>r.actor.kind==="human")).toBe(false);
  expect(await readFile(built.structure_path,"utf8")).toBe(original);
  await expect(reviewBookStructure({structure_path:corrected.structure_path,expected_sha256:corrected.structure_sha256,decisions:[decision],output_dir:path.join(dir,"stale")})).rejects.toThrow();
  await expect(reviewBookStructure({structure_path:built.structure_path,expected_sha256:"0".repeat(64),decisions:[decision],output_dir:path.join(dir,"bad")})).rejects.toThrow();
});
