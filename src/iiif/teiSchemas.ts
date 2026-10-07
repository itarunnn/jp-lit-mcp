import { z } from "zod";

const id = z.string().min(1).max(4096);
export const teiHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const xywh = z.tuple([z.number().finite().nonnegative(), z.number().finite().nonnegative(), z.number().finite().positive(), z.number().finite().positive()]);
export const teiLocatorSchema = z.object({ document_sha256: teiHashSchema, xpath: id, xml_id: z.string().nullable() });
const base = z.array(z.object({ locator: teiLocatorSchema, value: z.string() })).max(256);
const node = z.object({ locator: teiLocatorSchema, name: id, attributes: z.record(z.string()), xml_base_chain: base });
const omission = z.object({ code: z.literal("unit_too_large"), locator: teiLocatorSchema });
const pageRange = z.object({
  start_locator: teiLocatorSchema, end_locator: teiLocatorSchema.nullable(), container_locator: teiLocatorSchema,
  boundary: z.enum(["next_pb", "container_end"]), edition: z.object({ ed: z.string().nullable(), ed_ref: z.string().nullable() }),
  content: z.object({ kind: z.literal("fragment"), content: z.array(z.record(z.unknown())).max(4000) }).nullable(),
  omission: omission.nullable(),
}).refine(p => (p.boundary === "next_pb") === (p.end_locator !== null) && (p.content === null) === (p.omission !== null), "ページ範囲の境界・省略状態が一致しません");
export const facsimileItemSchema = z.object({
  source_locator: teiLocatorSchema,
  source_content: z.record(z.unknown()).nullable(),
  omission: omission.nullable(),
  attribute_value: z.string(), token_index: z.number().int().nonnegative(), raw_token: id,
  reference_status: z.enum(["resolved_local", "unresolved_local", "ambiguous_local", "empty_fragment_unverified", "base_context_unverified", "external_unverified", "relative_or_bare_unverified"]),
  candidate_count: z.number().int().nonnegative(), xml_base_chain: base,
  target: node.nullable(), surface: node.nullable(), graphics: z.array(node).max(10), diagnostics: z.array(z.string()),
  facs_origin: z.object({ kind: z.enum(["explicit", "ancestor"]), locator: teiLocatorSchema, attribute_value: z.string() }).optional(),
  page_range: pageRange.nullable().optional(),
});

// 原snapshotの位置を、XML取得版と参照の宣言元へ結び付ける。
export function validateTeiReference(ref: z.infer<typeof facsimileItemSchema>) {
  const source = ref.source_locator;
  const sameHash = (locator: z.infer<typeof teiLocatorSchema>) => {
    if (locator.document_sha256 !== source.document_sha256) throw new Error("TEI locatorのhashが一致しません");
  };
  const origin = ref.facs_origin;
  if (origin) {
    sameHash(origin.locator);
    const path = origin.locator.xpath;
    if (origin.attribute_value !== ref.attribute_value || (origin.kind === "explicit" ? path !== source.xpath : !source.xpath.startsWith(path + "/"))) throw new Error("TEI facs参照元が一致しません");
  }
  const page = ref.page_range;
  if (!page) return;
  for (const locator of [page.start_locator, page.end_locator, page.container_locator, page.omission?.locator]) if (locator) sameHash(locator);
  const container = page.container_locator.xpath + "/";
  if (page.start_locator.xpath !== source.xpath || !source.xpath.startsWith(container) || (page.end_locator && !page.end_locator.xpath.startsWith(container)) || ref.source_content?.name !== "{http://www.tei-c.org/ns/1.0}pb") throw new Error("TEIページ範囲の位置が一致しません");
  const stack = (page.content?.content ?? []).map(n => ({ n, depth: 1 }));
  let elements = 0, nodes = 0, payload = 0;
  while (stack.length) {
    const { n, depth } = stack.pop()!;
    if (++nodes > 4000 || depth > 256) throw new Error("TEIページ構造の上限です");
    if (n.kind === "element") {
      const locator = teiLocatorSchema.parse(n.locator); sameHash(locator);
      if (!locator.xpath.startsWith(container) || typeof n.name !== "string" || !Array.isArray(n.content) || ++elements > 2000) throw new Error("TEIページ構造が不正です");
      stack.push(...n.content.map(child => ({ n: z.record(z.unknown()).parse(child), depth: depth + 1 })));
    } else if (["text", "comment", "pi"].includes(String(n.kind)) && typeof n.value === "string") {
      payload += Array.from(n.value).length;
      if (payload > 20000) throw new Error("TEIページ本文の上限です");
    } else throw new Error("TEIページ構造が不正です");
  }
}
export const teiTargetSchema = z.object({
  canvas_id: id, xywh: xywh.nullable(), region_id: id.nullable(),
  basis: z.enum(["direct_canvas", "surface_binding", "surface_same_as", "manual_region"]),
});
const record = z.object({ recorded_at: z.string().datetime(), recorded_by: z.string().trim().min(1).max(1024), note: z.string().trim().min(1).max(20000), target: teiTargetSchema });
export const teiLinkSchema = z.object({
  link_id: id, document_id: id, file_path: id, imported_at: z.string().datetime(),
  reference: facsimileItemSchema,
  state: z.enum(["resolved", "candidate", "unresolved"]), target: teiTargetSchema.nullable(),
  candidates: z.array(z.object({ canvas_id: id, basis: z.literal("image_url_match") })).max(2000),
  diagnostics: z.array(z.string()),
  assignments: z.array(record).max(100),
  collations: z.array(record.extend({ result: z.enum(["match", "mismatch", "uncertain"]) })).max(100),
});
export type TeiLink = z.infer<typeof teiLinkSchema>;
export const surfaceBindingSchema = z.object({ surface_xpath: id, canvas_id: id });
export const facsimileResponseSchema = z.object({
  api_version: z.literal("0.1"), operation: z.literal("facsimile_links"), ok: z.literal(true),
  document: z.object({ sha256: teiHashSchema }),
  result: z.object({ total_occurrences: z.number().int().nonnegative(), next_offset: z.number().int().nonnegative().nullable(),
    items: z.array(facsimileItemSchema).max(100) }),
});
