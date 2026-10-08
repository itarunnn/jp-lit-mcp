import { z } from "zod";
import { ocrAbsoluteSchema, ocrHashSchema, ocrSourceSchema, ocrReviewSchema } from "./ocrSchemas.js";
const id=z.string().trim().min(1).max(4096);
export const readingKindSchema=z.enum(["image_reading","image_assisted_correction"]);
export const readingTaskSchema=z.object({
  schema_version:z.literal("0.1"), task_id:id, created_at:z.string().datetime(), kind:readingKindSchema,
  delivery:z.literal("current_app_file_handoff"), automatic_transmission:z.literal("none"),
  base_text_id:id, base_text_sha256:ocrHashSchema, base_run_path:ocrAbsoluteSchema, base_run_sha256:ocrHashSchema,
  source:ocrSourceSchema, image:z.object({path:z.enum(["image.png","image.jpg"]),sha256:ocrHashSchema}),
  prompt_sha256:ocrHashSchema,
}).strict();
export const readingResponseSchema=z.object({
  schema_version:z.literal("0.1"),task_id:id,kind:readingKindSchema,image_sha256:ocrHashSchema,
  generator:id,model_version:id.nullable(),executed_at:z.string().datetime({offset:true}),image_opened:z.literal(true),
  scope:z.enum(["full_region","partial_region"]),text:z.string().min(1).max(20000),
  doubts:z.array(z.object({quote:z.string().min(1).max(2000),alternatives:z.array(z.string().min(1).max(2000)).max(20),note:z.string().trim().min(1).max(2000)}).strict()).max(100),
  duration_ms:z.number().finite().nonnegative().nullable(),monetary_cost:z.null(),
}).strict().refine(r=>r.doubts.every(d=>r.text.includes(d.quote)),"疑義の引用を候補本文へ対応させてください");
export const readingReviewSchema=ocrReviewSchema.extend({reviewer_type:z.enum(["human","ai"])});
export const readingProvenanceSchema=z.object({
  kind:readingKindSchema,source:ocrSourceSchema,task:readingTaskSchema,task_path:ocrAbsoluteSchema,task_sha256:ocrHashSchema,
  response_path:ocrAbsoluteSchema,response_sha256:ocrHashSchema,image_path:ocrAbsoluteSchema,
  response:readingResponseSchema,reviews:z.array(readingReviewSchema).max(100),
});
export type ReadingTask=z.infer<typeof readingTaskSchema>;
export type ReadingResponse=z.infer<typeof readingResponseSchema>;
