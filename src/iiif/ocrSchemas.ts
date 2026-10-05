import path from "node:path";
import { z } from "zod";
const id = z.string().min(1).max(4096), n = z.number().finite(), positive = n.positive();
export const ocrHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const ocrAbsoluteSchema = z.string().refine((s) => path.isAbsolute(s), "絶対pathを指定してください");
const rect = z.tuple([n.nonnegative(), n.nonnegative(), positive, positive]);
const artifact = z.object({ path: id, sha256: ocrHashSchema });
export const ocrEngineSchema = z.object({
  provider: z.literal("ndlkotenocr-lite"), engine_dir: ocrAbsoluteSchema, python_path: ocrAbsoluteSchema,
  python_version: id, engine_sha256: ocrHashSchema, files: z.array(artifact).min(1).max(1000),
});
export const ocrConfigSchema = z.object({
  provider: z.literal("ndlkotenocr-lite"), engine_dir: ocrAbsoluteSchema, python_path: ocrAbsoluteSchema,
  expected_engine_sha256: ocrHashSchema, timeout_ms: z.number().int().min(1000).max(600000).default(180000),
}).strict();
export const ocrSourceSchema = z.object({
  workspace_id: id, document_id: id, manifest_sha256: ocrHashSchema, evidence_id: id,
  selection: z.object({ region_id: id, window_id: id, canvas_id: id, xywh: rect, coordinate_space: z.literal("canvas"), rotation_degrees: n }),
  canvas_width: positive, canvas_height: positive, image_sha256: ocrHashSchema,
  image_width: positive.int(), image_height: positive.int(), original_image_xywh: rect,
  canvas_to_image: z.object({ scale_x: positive, scale_y: positive }), scale_x: positive, scale_y: positive,
});
export const ocrLineSchema = z.object({
  line_id: id, text: z.string().max(2 * 1024 * 1024),
  bounding_box: z.array(z.tuple([n, n])).length(4), image_xywh: rect, canvas_xywh: rect,
  detection_confidence: n.min(0).max(1).nullable(),
});
export const ocrReviewSchema = z.object({
  recorded_at: z.string().datetime(), author: z.string().trim().min(1).max(1024),
  result: z.enum(["match", "mismatch", "uncertain"]), note: z.string().trim().min(1).max(20000),
  corrected_text: z.string().max(2 * 1024 * 1024).nullable(), image_sha256: ocrHashSchema,
});
export const ocrProvenanceSchema = z.object({
  run_id: id, run_path: ocrAbsoluteSchema, run_sha256: ocrHashSchema,
  evidence_path: ocrAbsoluteSchema, evidence_sha256: ocrHashSchema,
  engine: ocrEngineSchema, source: ocrSourceSchema,
  started_at: z.string().datetime(), finished_at: z.string().datetime(), duration_ms: n.nonnegative(),
  artifacts: z.array(artifact).min(1).max(10), lines: z.array(ocrLineSchema).max(10000),
  diagnostics: z.array(z.string()).max(10000), reviews: z.array(ocrReviewSchema).max(100),
});
export const ocrRunItemSchema = z.object({
  status: z.enum(["completed", "failed"]), source: ocrSourceSchema,
  started_at: z.string().datetime(), finished_at: z.string().datetime(), duration_ms: n.nonnegative(),
  artifacts: z.array(artifact).max(10), text: z.string().max(2 * 1024 * 1024).nullable(),
  lines: z.array(ocrLineSchema).max(10000), diagnostics: z.array(z.string()).max(10000), error: z.string().nullable(),
});
export const ocrRunSchema = z.object({
  schema_version: z.literal("0.1"), run_id: id, status: z.enum(["completed", "partial", "failed"]),
  image_transmission: z.literal("none"), device: z.literal("cpu"), engine: ocrEngineSchema,
  evidence_path: ocrAbsoluteSchema, evidence_sha256: ocrHashSchema,
  items: z.array(ocrRunItemSchema).min(1).max(4),
});
export type OcrSource = z.infer<typeof ocrSourceSchema>;
export type OcrLine = z.infer<typeof ocrLineSchema>;
export type OcrRun = z.infer<typeof ocrRunSchema>;
export type OcrConfig = z.infer<typeof ocrConfigSchema>;
