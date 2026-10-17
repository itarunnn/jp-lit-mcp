import path from "node:path";
import { z } from "zod";
import { bookActorSchema,bookAspectSchema } from "./bookStructureSchemas.js";
const id=z.string().min(1).max(4096),absolute=id.refine(s=>path.isAbsolute(s),"絶対pathを指定してください"),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const buildBookRequestSchema=z.object({workspace_path:absolute,text_ids:z.array(id).min(1).max(4),output_dir:absolute,
  profile:z.enum(["general","dictionary","illustrated"]).default("general"),
  layout_sources:z.array(z.object({text_id:id,path:absolute,expected_sha256:hash,input_image_sha256:hash}).strict()).max(4).default([]),
  pages:z.array(z.object({text_id:id.nullable(),page_id:id,sequence_index:z.number().int().nonnegative(),printed_label:z.string().max(4096),
    coverage:z.enum(["ready","ocr_failed","not_processed"]),canvas_id:id.optional()}).strict()).max(10000).optional(),
}).strict();
export const reviewBookRequestSchema=z.object({structure_path:absolute,expected_sha256:hash,output_dir:absolute,
  decisions:z.array(z.object({subject_id:id,subject_sha256:hash,aspect:bookAspectSchema,result:z.enum(["accepted","rejected","needs_review"]),
    note:z.string().min(1).max(20000),actor:bookActorSchema,replacement_text:z.string().max(2*1024*1024).optional()}).strict()).min(1).max(1000),
}).strict();
export const exportBookRequestSchema=z.object({structure_path:absolute,expected_sha256:hash,format:z.enum(["tei","sqlite"]),output_dir:absolute}).strict();
