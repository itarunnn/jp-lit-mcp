import { createHash } from "node:crypto";
import { z } from "zod";

const id = z.string().min(1).max(4096), num = z.number().finite();
const rect = z.tuple([num.nonnegative(), num.nonnegative(), num.positive(), num.positive()]);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const refs = z.array(id).max(100000);
const locator = z.record(z.unknown());
export const bookActorSchema = z.object({ kind: z.enum(["human", "agent"]), name: id }).strict();
export const bookAspectSchema = z.enum(["transcription", "layout", "headword", "boundary", "continuation", "sense", "example", "association", "alignment"]);
const pageSchema = z.object({
  page_id: id, sequence_index: z.number().int().nonnegative(), printed_label: z.string().max(4096), canvas_id: id,
  canvas_width: num.positive(), canvas_height: num.positive(), canvas_xywh: rect.nullable(),
  image_path: id.nullable(), image_sha256: hash.nullable(), image_width: num.positive().int().nullable(), image_height: num.positive().int().nullable(),
  text_id: id.nullable(), coverage: z.enum(["ready", "ocr_failed", "not_processed"]),
}).strict();
const lineSchema = z.object({ line_ref: id, page_id: id, original_line_id: id, raw_text: z.string().max(2 * 1024 * 1024),
  image_xywh: rect.nullable(), canvas_xywh: rect.nullable(), source_locator: locator }).strict();
export const bookRegionSchema = z.object({ region_id: id, page_id: id,
  kind: z.enum(["text", "figure", "caption", "table", "heading", "note", "unknown"]),
  image_xywh: rect.nullable(), canvas_xywh: rect.nullable(), line_refs: refs,
  origin: z.enum(["ocr_line", "ocr_layout", "manual_region"]), source_locator: locator }).strict();
const spanSchema = z.object({ span_id: id, line_ref: id, range_cp: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]) }).strict();
const fieldSchema = z.object({ field_id: id, role: id, span_ids: refs,
  raw_text: z.string().max(2 * 1024 * 1024), text: z.string().max(2 * 1024 * 1024), normalized_text: z.string().max(2 * 1024 * 1024) }).strict();
const unitSchema = z.object({ unit_id: id, kind: z.enum(["text", "entry", "sense", "example", "figure", "table", "unknown"]),
  region_ids: refs, span_ids: refs, fields: z.array(fieldSchema).max(10000) }).strict();
const relationSchema = z.object({ relation_id: id, kind: z.enum(["contains", "precedes", "continues", "caption_of", "refers_to"]),
  from_id: id, to_id: id, reasons: z.array(id).max(100), score: num.nullable(), state: z.literal("candidate") }).strict();
const reviewSchema = z.object({ review_id: id, subject_id: id, subject_sha256: hash, aspect: bookAspectSchema,
  result: z.enum(["accepted", "rejected", "needs_review"]), actor: bookActorSchema, note: z.string().max(20000), recorded_at: z.string().datetime() }).strict();
const revisionSchema = z.object({ revision_id: id, operation: z.enum(["replace_text", "review"]), subject_id: id,
  before_sha256: hash, payload: locator, actor: bookActorSchema, recorded_at: z.string().datetime() }).strict();
export const bookStructureSchema = z.object({
  schema_version: z.literal("0.1"), structure_id: id, profile: z.enum(["general", "dictionary", "illustrated"]), workspace_id: id, document_id: id,
  inputs: z.array(z.object({ path: id, sha256: hash, role: id }).strict()).max(10000),
  pages: z.array(pageSchema).min(1).max(10000), lines: z.array(lineSchema).max(100000),
  regions: z.array(bookRegionSchema).max(100000), spans: z.array(spanSchema).max(200000), units: z.array(unitSchema).max(100000),
  relations: z.array(relationSchema).max(200000), reviews: z.array(reviewSchema).max(100000), revisions: z.array(revisionSchema).max(100000),
  diagnostics: z.array(z.string().max(20000)).max(100000),
}).strict();
export type BookStructure = z.infer<typeof bookStructureSchema>;
export type BookPage = BookStructure["pages"][number];
export type BookRegion = BookStructure["regions"][number];
export type BookUnit = BookStructure["units"][number];
export type BookField = BookUnit["fields"][number];

export function structureFingerprint(value: unknown): string {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ?
    Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
export function structureId(kind: string, ...parts: unknown[]): string { return `${kind}-${structureFingerprint(parts)}`; }

export function parseBookStructure(input: unknown): BookStructure {
  const b = bookStructureSchema.parse(input);
  const ids = new Map<string, unknown>();
  const add = (key: string, value: unknown) => { if (ids.has(key)) throw Error("書籍構造のIDが重複しています"); ids.set(key, value); };
  for (const [items, key] of [[b.pages,"page_id"], [b.lines,"line_ref"], [b.regions,"region_id"], [b.spans,"span_id"],
    [b.units,"unit_id"], [b.relations,"relation_id"], [b.reviews,"review_id"], [b.revisions,"revision_id"]] as const)
    for (const item of items) add((item as any)[key], item);
  for (const u of b.units) for (const f of u.fields) add(f.field_id, f);
  const pages = new Map(b.pages.map(p => [p.page_id,p])), lines = new Map(b.lines.map(l => [l.line_ref,l]));
  const spans = new Map(b.spans.map(s => [s.span_id,s])), regions = new Map(b.regions.map(r => [r.region_id,r]));
  const requireRef = (key: string, collection: Map<string, unknown> = ids) => { if (!collection.has(key)) throw Error("書籍構造の参照先がありません"); };
  const checkRect = (r: number[] | null, w: number, h: number) => {
    if (r && (r[0] + r[2] > w + 1e-6 || r[1] + r[3] > h + 1e-6)) throw Error("書籍構造の矩形が画像・Canvas外にあります");
  };
  const sequence = new Set<number>();
  for (const p of b.pages) {
    if (sequence.has(p.sequence_index)) throw Error("印刷頁の順序が重複しています"); sequence.add(p.sequence_index);
    checkRect(p.canvas_xywh, p.canvas_width, p.canvas_height);
    if (p.coverage === "ready" && [p.canvas_xywh,p.image_path,p.image_sha256,p.image_width,p.image_height,p.text_id].some(v => v === null))
      throw Error("処理済み頁の画像出典が不足しています");
  }
  for (const item of [...b.lines,...b.regions]) {
    requireRef(item.page_id, pages); const p = pages.get(item.page_id)!;
    if (p.coverage !== "ready") throw Error("未処理頁への領域・行の割当があります");
    if ((item.image_xywh === null) !== (item.canvas_xywh === null)) throw Error("画像座標とCanvas座標が対応していません");
    checkRect(item.image_xywh,p.image_width!,p.image_height!); checkRect(item.canvas_xywh,p.canvas_width,p.canvas_height);
    if (item.image_xywh && item.canvas_xywh) {
      const [x,y,w,h] = item.image_xywh, [px,py,pw,ph] = p.canvas_xywh!;
      const expected = [px+x*pw/p.image_width!,py+y*ph/p.image_height!,w*pw/p.image_width!,h*ph/p.image_height!];
      if (expected.some((v,i) => Math.abs(v-item.canvas_xywh![i]) > 1e-5)) throw Error("領域の座標変換が一致しません");
    }
  }
  for (const r of b.regions) for (const key of r.line_refs) {
    requireRef(key,lines); if (lines.get(key)!.page_id !== r.page_id) throw Error("領域と行の頁が一致しません");
  }
  for (const s of b.spans) {
    requireRef(s.line_ref,lines); const [start,end] = s.range_cp;
    if (end < start || end > Array.from(lines.get(s.line_ref)!.raw_text).length) throw Error("文字範囲が原行の外にあります");
  }
  for (const u of b.units) {
    for (const key of u.region_ids) requireRef(key,regions);
    for (const key of u.span_ids) requireRef(key,spans);
    for (const f of u.fields) {
      for (const key of f.span_ids) requireRef(key,spans);
      const text = f.span_ids.map(key => { const s = spans.get(key)!; return Array.from(lines.get(s.line_ref)!.raw_text).slice(...s.range_cp).join(""); }).join("\n");
      if (text !== f.raw_text) throw Error("構造化した原文と元の文字範囲が一致しません");
      if (f.normalized_text !== f.text.normalize("NFC")) throw Error("検索用表記が本文と一致しません");
    }
  }
  for (const r of b.relations) { requireRef(r.from_id); requireRef(r.to_id); }
  for (const kind of ["contains","precedes","continues"]) {
    const edges = new Map<string,string[]>();
    for (const r of b.relations.filter(r => r.kind === kind)) edges.set(r.from_id,[...(edges.get(r.from_id) ?? []),r.to_id]);
    const visited = new Set<string>(), active = new Set<string>();
    const visit = (key: string, depth: number) => {
      if (depth > 500 || active.has(key)) throw Error("書籍構造の関係が循環または深すぎます");
      if (visited.has(key)) return; active.add(key);
      for (const next of edges.get(key) ?? []) visit(next,depth+1);
      active.delete(key); visited.add(key);
    };
    for (const key of edges.keys()) visit(key,0);
  }
  for (const item of [...b.reviews,...b.revisions]) requireRef(item.subject_id);
  for (const revision of b.revisions) if (revision.payload.invalidated_review_ids !== undefined) {
    const invalidated = z.array(id).parse(revision.payload.invalidated_review_ids);
    for (const key of invalidated) if (!b.reviews.some(r=>r.review_id===key)) throw Error("失効対象の確認記録がありません");
  }
  return b;
}
