import { createHash } from "node:crypto";
import { z } from "zod";

const id = z.string().min(1).max(4096);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const localOcrEndpointSchema = z.string().refine(value => {
  const match = /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.exec(value);
  return !!match && Number(match[1]) <= 65535;
}, "Local OCRの接続先はhttp://127.0.0.1:portで指定してください");
export const localOcrModeSchema = z.enum(["layout", "line"]);
export const localOcrEngineIdSchema = z.enum(["ndl-lite", "ndl-koten-lite"]);
export const localOcrMetadataSchema = z.object({
  id: localOcrEngineIdSchema, label: id, ready: z.boolean(), lines: z.boolean(),
  modes: z.array(id).max(16),
});
export function localOcrMetadataHash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(localOcrMetadataSchema.parse(input))).digest("hex");
}
export const localOcrInspectionSchema = z.object({
  provider: z.literal("local-ocr"), base_url: localOcrEndpointSchema,
  engine_id: localOcrEngineIdSchema.default("ndl-lite"), mode: localOcrModeSchema.default("layout"),
  timeout_ms: z.number().int().min(1000).max(600000).default(180000),
});
export const localOcrConfigSchema = localOcrInspectionSchema.extend({ expected_metadata_sha256: hash }).strict();
export const localOcrEngineSchema = z.object({
  provider: z.literal("local-ocr"), runtime: z.literal("http"), base_url: localOcrEndpointSchema,
  engine_id: localOcrEngineIdSchema, mode: localOcrModeSchema,
  metadata: localOcrMetadataSchema, metadata_sha256: hash,
  identity_verification: z.literal("service_metadata_only"),
  engine_sha256: z.null(), service_version: z.null(), model_version: z.null(),
});
export type LocalOcrEngine = z.infer<typeof localOcrEngineSchema>;
