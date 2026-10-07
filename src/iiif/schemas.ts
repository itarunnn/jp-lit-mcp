import { z } from "zod";
import path from "node:path";
import { createHash } from "node:crypto";
import { teiLinkSchema, teiHashSchema, surfaceBindingSchema } from "./teiSchemas.js";
import { ocrProvenanceSchema } from "./ocrSchemas.js";
import { manualOcrProvenanceSchema } from "./manualOcrSchemas.js";
import { readingProvenanceSchema, readingKindSchema } from "./readingSchemas.js";
import { validateOcrSource, normalizeKotenOutput } from "./ocr.js";

const id = z.string().min(1).max(4096);
const num = z.number().finite();
const positive = num.positive();
export const xywhSchema = z.tuple([
  num.nonnegative(),
  num.nonnegative(),
  positive,
  positive,
]);
export const languageSchema = z.array(
  z.object({ language: z.string().nullable(), values: z.array(z.string()) }),
);
export const candidateSchema = z.object({
  source: id,
  source_id: id,
  record_url: z.string().nullable(),
  manifest_url: z.string().url(),
  acquisition: z.enum(["provider_metadata", "derived_from_pid", "manual_url"]),
  verification_state: z.literal("candidate"),
});
export const receiptSchema = z.object({
  requested_url: z.string().url(),
  final_url: z.string().url(),
  retrieved_at: z.string().datetime(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative(),
});
export const imageSchema = z.object({
  image_id: id,
  width: positive.nullable(),
  height: positive.nullable(),
  target: z.unknown(),
  rights: z.array(z.unknown()).default([]),
  service: z
    .object({
      service_id: id,
      version: z.enum(["1", "2", "3"]),
      profile: z.unknown(),
    })
    .nullable(),
});
export const canvasSchema = z.object({
  canvas_id: id,
  label: languageSchema,
  canvas_index_1based: z.number().int().positive(),
  width: positive,
  height: positive,
  images: z.array(imageSchema),
  text_refs: z.array(z.unknown()),
  rights: z.array(z.unknown()).default([]),
});
export const documentSchema = z.object({
  document_id: id,
  candidate: candidateSchema,
  receipt: receiptSchema,
  declared_id: id,
  presentation_version: z.enum(["2", "3"]),
  label: languageSchema,
  sequences: z.array(z.object({ sequence_id: id, label: languageSchema })),
  selected_sequence_id: id,
  canvases: z.array(canvasSchema).min(1).max(2000),
  rights: z.array(z.unknown()),
  diagnostics: z.array(z.string()),
});
export const windowSchema = z.object({
  window_id: id,
  document_id: id,
  canvas_id: id,
});
export const selectionSchema = z.object({
  region_id: id,
  window_id: id,
  canvas_id: id,
  xywh: xywhSchema,
  coordinate_space: z.literal("canvas"),
  rotation_degrees: num,
});
export const regionSchema = z.object({
  selection: selectionSchema,
  mapping_state: z.enum([
    "manifest_declared",
    "image_observed",
    "human_verified",
    "unsupported",
  ]),
  tags: z.array(z.string()).max(30),
  selection_reason: z.string(),
  note: z.string(),
  text_evidence_ids: z.array(id),
});
export const textSchema = z.object({
  text_id: id,
  canvas_id: id,
  target_xywh: xywhSchema.nullable(),
  source_ref: id,
  source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  text: z.string().max(2 * 1024 * 1024),
  origin: z.enum([
    "provider_annotation",
    "manual_transcription",
    "ocr_candidate",
    "ai_candidate",
  ]),
  verification_state: z.enum(["provider_text", "unverified", "human_verified"]),
  ocr_provenance: ocrProvenanceSchema.optional(),
  manual_ocr_provenance: manualOcrProvenanceSchema.optional(),
  reading_provenance: readingProvenanceSchema.optional(),
});
export const viewerSchema = z.object({
  adapter_version: id,
  windows: z.array(windowSchema).max(4),
  native_state: z.unknown(),
});
export const workspaceSchema = z.object({
  schema_version: z.literal("0.1"),
  workspace_id: id,
  created_at: z.string().datetime(),
  documents: z.array(documentSchema).min(1).max(4),
  windows: z.array(windowSchema).min(1).max(4),
  regions: z.array(regionSchema).max(1000),
  texts: z.array(textSchema).max(2000),
  viewer_state: viewerSchema,
  tei_links: z.array(teiLinkSchema).max(2000).optional(),
});
const absolute = z
  .string()
  .refine((v) => path.isAbsolute(v), "絶対pathを指定してください");
export const requestSchema = z.discriminatedUnion("operation", [
  z.object({api_version:z.literal("0.1"),operation:z.literal("prepare_reading"),workspace_path:absolute,
    text_id:id,kind:readingKindSchema,output_dir:absolute}),
  z.object({api_version:z.literal("0.1"),operation:z.literal("import_reading"),workspace_path:absolute,
    task_path:absolute,response_path:absolute,output_path:absolute,overwrite:z.boolean().default(false)}),
  z.object({
    api_version: z.literal("0.1"), operation: z.literal("evaluate_ocr"),
    workspace_path: absolute, evaluation_path: absolute, output_path: absolute, overwrite: z.boolean().default(false),
  }),
  z.object({
    api_version: z.literal("0.1"), operation: z.literal("import_ocr"),
    workspace_path: absolute, run_path: absolute, output_path: absolute, overwrite: z.boolean().default(false),
  }),
  z.object({
    api_version: z.literal("0.1"), operation: z.literal("inspect_ocr_provider"),
    provider: z.enum(["ndlkotenocr-lite", "ndlkotenocr-ver3"]).default("ndlkotenocr-lite"),
    engine_dir: absolute.optional(), python_path: absolute.optional(), docker_path: absolute.optional(),
    image_id: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  }),
  z.object({
    api_version: z.literal("0.1"), operation: z.literal("run_ocr"),
    evidence_path: absolute, evidence_ids: z.array(id).min(1).max(4), provider_config_path: absolute,
    output_dir: absolute, allow_existing_text: z.boolean().default(false),
  }),
  z.object({
    api_version: z.literal("0.1"), operation: z.literal("link_tei"),
    workspace_path: absolute, output_path: absolute, file_path: absolute,
    expected_sha256: teiHashSchema, document_id: id,
    surface_bindings: z.array(surfaceBindingSchema).max(2000).default([]),
    limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().nonnegative().default(0),
    overwrite: z.boolean().default(false),
  }),
  z.object({
    api_version: z.literal("0.1"),
    operation: z.literal("inspect_manifest"),
    manifest_url: z.string().url(),
    source: id.optional(),
    source_id: id.optional(),
    record_url: z.string().nullable().optional(),
    sequence_id: id.optional(),
  }),
  z.object({
    api_version: z.literal("0.1"),
    operation: z.literal("prepare_workspace"),
    candidates: z.array(candidateSchema).min(1).max(4),
    output_dir: absolute,
    overwrite: z.boolean().default(false),
    sequence_ids: z.record(z.string()).optional(),
  }),
  z.object({
    api_version: z.literal("0.1"),
    operation: z.literal("export_evidence"),
    workspace_path: absolute,
    region_ids: z.array(id).min(1).max(4),
    output_dir: absolute,
    overwrite: z.boolean().default(false),
    image_permission_confirmed: z.boolean().default(false),
  }),
]);
export function parseIiifRequest(input: unknown) {
  return requestSchema.parse(input);
}
export function validateWorkspace(input: unknown) {
  const w = workspaceSchema.parse(input);
  const unique = (values: string[]) => {
    if (new Set(values).size !== values.length)
      throw new Error("IDの重複があります");
  };
  unique(w.documents.map((d) => d.document_id));
  unique(w.windows.map((v) => v.window_id));
  unique(w.regions.map((r) => r.selection.region_id));
  unique(w.texts.map((t) => t.text_id));
  unique((w.tei_links ?? []).map((l) => l.link_id));
  for (const d of w.documents) {
    unique(d.canvases.map((c) => c.canvas_id));
    if (!d.sequences.some((s) => s.sequence_id === d.selected_sequence_id))
      throw new Error("sequence参照が未解決です");
  }
  for (const v of w.windows)
    if (
      !w.documents
        .find((d) => d.document_id === v.document_id)
        ?.canvases.some((c) => c.canvas_id === v.canvas_id)
    )
      throw new Error("window参照が未解決です");
  const canvases = w.documents.flatMap((d) => d.canvases);
  for (const t of w.texts) {
    if (t.reading_provenance) {
      const p=t.reading_provenance,s=validateOcrSource(p.source),d=w.documents.find(d=>d.document_id===s.document_id),c=d?.canvases.find(c=>c.canvas_id===s.selection.canvas_id);
      if(t.origin!=="ai_candidate"||t.verification_state!=="unverified"||t.ocr_provenance||t.manual_ocr_provenance||
          s.workspace_id!==w.workspace_id||d?.receipt.sha256!==s.manifest_sha256||!c||c.canvas_id!==t.canvas_id||c.width!==s.canvas_width||c.height!==s.canvas_height||
          JSON.stringify(t.target_xywh)!==JSON.stringify(s.selection.xywh)||JSON.stringify(s)!==JSON.stringify(p.task.source)||
          p.kind!==p.task.kind||p.kind!==p.response.kind||p.task.task_id!==p.response.task_id||p.response.image_sha256!==s.image_sha256||
          p.task.image.sha256!==s.image_sha256||t.text!==p.response.text||createHash("sha256").update(t.text).digest("hex")!==t.source_sha256||
          t.source_ref!==`${p.response_path}#${p.task.task_id}`||p.reviews.some(r=>r.image_sha256!==s.image_sha256))
        throw new Error("AI候補の本文・出典・対象・確認画像が一致しません");
    } else if(t.origin==="ai_candidate")throw new Error("AI候補には読解出典が必要です");
    if (t.manual_ocr_provenance) {
      const p = t.manual_ocr_provenance, s = p.source, d = w.documents.find((d) => d.document_id === s.document_id);
      const c = d?.canvases.find((c) => c.canvas_id === s.selection.canvas_id);
      if (t.ocr_provenance || t.origin !== "ocr_candidate" || t.verification_state !== "unverified" ||
          s.workspace_id !== w.workspace_id || d?.receipt.sha256 !== s.manifest_sha256 || !c ||
          c.canvas_id !== t.canvas_id || c.width !== s.canvas_width || c.height !== s.canvas_height ||
          JSON.stringify(t.target_xywh) !== JSON.stringify(s.selection.xywh) ||
          createHash("sha256").update(t.text).digest("hex") !== t.source_sha256 ||
          t.source_ref !== (p.result_url ?? "https://mp.ex.nii.ac.jp/kuronet/"))
        throw new Error("手動OCR候補の本文・出典・対象が一致しません");
    }
    if (t.ocr_provenance && (t.origin !== "ocr_candidate" || t.verification_state !== "unverified"))
      throw new Error("OCR候補と校合記録を分離してください");
    const scoped = t.manual_ocr_provenance?.source ?? t.reading_provenance?.source;
    const c = scoped
      ? w.documents.find((d) => d.document_id === scoped.document_id)?.canvases.find((c) => c.canvas_id === t.canvas_id)
      : canvases.find((c) => c.canvas_id === t.canvas_id);
    if (!c) throw new Error("text参照が未解決です");
    if (t.ocr_provenance) {
      const p=t.ocr_provenance,s=validateOcrSource(p.source),doc=w.documents.find((d)=>d.document_id===s.document_id);
      if(s.workspace_id!==w.workspace_id || doc?.receipt.sha256!==s.manifest_sha256 || !doc.canvases.some((x)=>x.canvas_id===t.canvas_id) ||
          s.selection.canvas_id!==t.canvas_id || s.canvas_width!==c.width || s.canvas_height!==c.height ||
          JSON.stringify(t.target_xywh)!==JSON.stringify(s.selection.xywh) || p.reviews.some((r)=>r.image_sha256!==s.image_sha256))
        throw new Error("OCR出典・校合画像の参照が一致しません");
      const lines=normalizeKotenOutput({imginfo:{img_width:s.image_width,img_height:s.image_height},contents:[p.lines.map((l)=>({id:l.line_id,text:l.text,boundingBox:l.bounding_box,...(l.detection_confidence===null?{}:{confidence:l.detection_confidence})}))]},s);
      if(JSON.stringify(lines)!==JSON.stringify(p.lines))throw new Error("OCR行座標の記録が一致しません");
    }
    if (
      t.target_xywh &&
      (t.target_xywh[0] + t.target_xywh[2] > c.width ||
        t.target_xywh[1] + t.target_xywh[3] > c.height)
    )
      throw new Error("text領域がCanvasの外にあります");
  }
  for (const r of w.regions) {
    const v = w.windows.find((v) => v.window_id === r.selection.window_id);
    const c = w.documents
      .find((d) => d.document_id === v?.document_id)
      ?.canvases.find((c) => c.canvas_id === r.selection.canvas_id);
    if (!c) throw new Error("region参照が未解決です");
    const [x, y, width, height] = r.selection.xywh;
    if (x + width > c.width || y + height > c.height)
      throw new Error("領域がCanvasの外にあります");
    for (const tid of r.text_evidence_ids)
      if (
        !w.texts.some((t) => t.text_id === tid && t.canvas_id === c.canvas_id)
      )
        throw new Error("領域のtext参照が未解決です");
  }
  for (const v of w.viewer_state.windows)
    if (
      !w.windows.some(
        (x) =>
          x.window_id === v.window_id &&
          x.document_id === v.document_id &&
          x.canvas_id === v.canvas_id,
      )
    )
      throw new Error("viewer参照が未解決です");
  for (const link of w.tei_links ?? []) {
    const doc = w.documents.find((d) => d.document_id === link.document_id);
    if (!doc) throw new Error("TEI document参照が未解決です");
    if ((link.state === "resolved") !== (link.target !== null)) throw new Error("TEI対応状態が一致しません");
    if (link.target) {
      const t = link.target, c = doc.canvases.find((c) => c.canvas_id === t.canvas_id);
      if (!c || (t.xywh && (t.xywh[0] + t.xywh[2] > c.width || t.xywh[1] + t.xywh[3] > c.height))) throw new Error("TEI対応先のCanvas/矩形が不正です");
      if (t.region_id && !w.regions.some((r) => r.selection.region_id === t.region_id && r.selection.canvas_id === t.canvas_id && w.windows.find((v) => v.window_id === r.selection.window_id)?.document_id === doc.document_id && JSON.stringify(r.selection.xywh) === JSON.stringify(t.xywh))) throw new Error("TEI領域参照が不正です");
    }
    if (link.candidates.some((t) => !doc.canvases.some((c) => c.canvas_id === t.canvas_id))) throw new Error("TEI候補Canvas参照が未解決です");
    const hash = link.reference.source_locator.document_sha256;
    for (const n of [link.reference.target, link.reference.surface, ...link.reference.graphics])
      if (n && n.locator.document_sha256 !== hash) throw new Error("TEI locatorのhashが一致しません");
  }
  return w;
}
