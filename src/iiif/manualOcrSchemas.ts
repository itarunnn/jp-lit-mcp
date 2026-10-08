import { z } from "zod";
import { ocrHashSchema, ocrSourceSchema } from "./ocrSchemas.js";

const id = z.string().min(1).max(4096);
const resultUrl = z.string().trim().max(4096).url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
}, "結果URLには認証情報を含まないHTTP(S) URLを指定してください");
const source = z.object({
  workspace_id: id, document_id: id, manifest_sha256: ocrHashSchema,
  selection: ocrSourceSchema.shape.selection,
});
export const manualOcrInputSchema = z.object({
  provider: z.literal("kuronet"), source,
  text: z.string().max(2 * 1024 * 1024).refine((value) => !!value.trim(), "OCR本文を貼り付けてください"),
  author: z.string().trim().min(1).max(1024), result_url: resultUrl.nullable().default(null),
  scope_confirmed: z.literal(true),
}).strict();
export const manualOcrProvenanceSchema = z.object({
  provider: z.literal("kuronet"), acquisition: z.literal("manual_copy"),
  recorded_at: z.string().datetime(), author: z.string().trim().min(1).max(1024),
  result_url: resultUrl.nullable(), scope_verification: z.literal("user_declared"),
  model_version: z.null(), source_image_sha256: z.null(),
  source: source.extend({ canvas_width: z.number().finite().positive(), canvas_height: z.number().finite().positive() }),
}).strict();
