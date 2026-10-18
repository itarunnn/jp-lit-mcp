import { createHash } from "node:crypto";
import { z } from "zod";

const id=z.string().min(1).max(4096), hash=z.string().regex(/^[a-f0-9]{64}$/);
export const kotenSourceCommit="939cbfaf617eb8fd7e54cf1daeb66fb5a92749ec";
export const modalMetadataSchema=z.object({python_version:id,torch_version:id,cuda_version:id,gpu:id,
  files:z.array(z.object({path:id,sha256:hash})).min(1).max(1000)});
export function modalEngineHash(image_id:string,metadata:unknown){
  const {gpu:_gpu,...modelMetadata}=modalMetadataSchema.parse(metadata);
  return createHash("sha256").update(JSON.stringify({source_commit:kotenSourceCommit,image_id,metadata:modelMetadata})).digest("hex");
}
export const modalOcrEngineSchema=z.object({
  provider:z.literal("ndlkotenocr-modal"),runtime:z.literal("modal"),model_version:z.literal("3"),
  source_commit:z.literal(kotenSourceCommit),image_id:id,engine_sha256:hash,adapter_sha256:hash,
  ...modalMetadataSchema.shape,
});
export const modalInspectionSchema=z.object({provider:z.literal("ndlkotenocr-modal"),
  approved_image_sha256:z.array(hash).min(1).max(4).refine(v=>new Set(v).size===v.length,"画像hashが重複しています"),
  timeout_ms:z.number().int().min(1000).max(600000).default(600000)});
export const modalOcrConfigSchema=modalInspectionSchema.extend({
  expected_engine_sha256:hash,expected_adapter_sha256:hash,engine:modalOcrEngineSchema,
}).strict();
export type ModalOcrEngine=z.infer<typeof modalOcrEngineSchema>;
