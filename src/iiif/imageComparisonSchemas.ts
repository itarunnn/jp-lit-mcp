import { z } from "zod";
import { ocrAbsoluteSchema as absolute,ocrHashSchema as hash,ocrSourceSchema } from "./ocrSchemas.js";
const id=z.string().min(1).max(4096),n=z.number().finite(),ratio=n.min(0).max(1),size=z.tuple([n.int().positive(),n.int().positive()]);
export const imageReferenceSchema=z.object({evidence_path:absolute,evidence_id:id}).strict();
export const comparisonArtifactSchema=z.object({path:z.string().regex(/^analysis\/[a-zA-Z0-9_-]+\.png$/),sha256:hash}).strict();
const inputSchema=z.object({evidence_path:absolute,evidence_sha256:hash,image_path:absolute,source:ocrSourceSchema,
 attribution:z.object({manifest_url:z.string().url(),record_url:z.string().nullable(),label:z.string().max(16000),rights:z.array(z.unknown()).max(100)})}).strict();
const artifacts=z.object({aligned:comparisonArtifactSchema.optional(),overlay:comparisonArtifactSchema.optional(),raw_difference:comparisonArtifactSchema.optional(),difference:comparisonArtifactSchema.optional()}).strict();
const matrix=z.tuple([z.tuple([n,n,n]),z.tuple([n,n,n])]);
const metrics=z.object({id,rank:n.int().min(1).max(20),status:z.enum(["aligned","held"]),method:z.enum(["orb_affine_ransac","encoded_identity"]),
 image_size:size,analysis_size:size,matrix:matrix.nullable(),candidate_image_to_query_image:z.tuple([z.tuple([n,n,n]),z.tuple([n,n,n]),z.tuple([z.literal(0),z.literal(0),z.literal(1)])]).nullable(),
 inliers:n.int().min(0).max(2000),matches:n.int().min(0).max(2000),inlier_ratio:ratio,query_coverage:ratio,candidate_coverage:ratio,overlap:ratio,
 median_reprojection_error:n.nonnegative().nullable(),dhash_distance:n.int().min(0).max(64),raw_mean_difference:n.min(0).max(255).nullable(),
 normalized_mean_difference:n.min(0).max(255).nullable(),changed_fraction:ratio.nullable(),photometric_gain:n.nullable(),photometric_offset:n.nullable(),
 diagnostics:z.array(z.string().max(1024)).max(50),artifacts,input:inputSchema});
export const imageComparisonReportSchema=z.object({schema_version:z.literal("0.1"),report_id:id,created_at:z.string().datetime(),
 image_transmission:z.literal("none"),algorithm:z.literal("orb_affine_v1"),transform_direction:z.literal("candidate_to_query"),
 engine:z.object({python:id,opencv:id,numpy:id,engine_sha256:hash}),settings:z.object({max_edge:z.literal(1024),nfeatures:z.literal(2000),ratio_test:z.literal(.75),
  ransac_threshold:z.literal(3),min_inliers:z.literal(12),min_inlier_ratio:z.literal(.4),min_coverage:z.literal(.08),min_overlap:z.literal(.5),min_scale:z.literal(.25),max_scale:z.literal(4),
  difference_threshold:z.literal(25),percentiles:z.tuple([z.literal(2),z.literal(98)]),seed:z.literal(0),threads:z.literal(1)}),
 query:z.object({image_size:size,analysis_size:size,artifact:comparisonArtifactSchema,input:inputSchema}),candidates:z.array(metrics).min(1).max(20),duration_ms:n.nonnegative()
}).superRefine((r,ctx)=>{
 const ids=[r.query.input.source.selection.region_id,...r.candidates.map(c=>c.id)];
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(new Set(ids).size!==ids.length)bad("比較領域IDが重複しています");
 for(const [i,c] of r.candidates.entries()){
  if(c.rank!==i+1||c.id!==c.input.source.selection.region_id||c.id!==c.input.source.evidence_id)bad("比較順位・出典IDが一致しません");
  if(c.image_size[0]!==c.input.source.image_width||c.image_size[1]!==c.input.source.image_height)bad("比較画像寸法が一致しません");
  if(c.status==="aligned"?(c.matrix===null||c.candidate_image_to_query_image===null||Object.keys(c.artifacts).length!==4||c.raw_mean_difference===null||c.changed_fraction===null):
    (c.matrix!==null||c.candidate_image_to_query_image!==null||Object.keys(c.artifacts).length!==0||c.raw_mean_difference!==null))bad("整列状態と差分が一致しません");
 }
 if(r.query.image_size[0]!==r.query.input.source.image_width||r.query.image_size[1]!==r.query.input.source.image_height||r.query.input.source.selection.region_id!==r.query.input.source.evidence_id)bad("queryの出典寸法・IDが一致しません");
});
const review=z.object({candidate_id:id,recorded_at:z.string().datetime(),author:z.string().trim().min(1).max(1024),result:z.enum(["match","mismatch","uncertain"]),
 note:z.string().trim().min(1).max(20000),query_image_sha256:hash,candidate_image_sha256:hash});
export const imageComparisonRecordSchema=z.object({report_path:absolute,report_sha256:hash,report:imageComparisonReportSchema,reviews:z.array(review).max(100)}).superRefine((r,ctx)=>{
 for(const v of r.reviews){const c=r.report.candidates.find(c=>c.id===v.candidate_id);if(!c||v.query_image_sha256!==r.report.query.input.source.image_sha256||v.candidate_image_sha256!==c.input.source.image_sha256)
  ctx.addIssue({code:z.ZodIssueCode.custom,message:"図版確認の対象画像が一致しません"});}
});
export type ImageComparisonRecord=z.infer<typeof imageComparisonRecordSchema>;
export type ImageComparisonInput=z.infer<typeof inputSchema>;
export type ImageReference=z.infer<typeof imageReferenceSchema>;
