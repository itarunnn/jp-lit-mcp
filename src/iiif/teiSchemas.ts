import { z } from "zod";

const id = z.string().min(1).max(4096);
export const teiHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const xywh = z.tuple([z.number().finite().nonnegative(), z.number().finite().nonnegative(), z.number().finite().positive(), z.number().finite().positive()]);
export const teiLocatorSchema = z.object({ document_sha256: teiHashSchema, xpath: id, xml_id: z.string().nullable() });
const base = z.array(z.object({ locator: teiLocatorSchema, value: z.string() })).max(256);
const node = z.object({ locator: teiLocatorSchema, name: id, attributes: z.record(z.string()), xml_base_chain: base });
export const facsimileItemSchema = z.object({
  source_locator: teiLocatorSchema,
  source_content: z.record(z.unknown()).nullable(),
  omission: z.object({ code: z.literal("unit_too_large"), locator: teiLocatorSchema }).nullable(),
  attribute_value: z.string(), token_index: z.number().int().nonnegative(), raw_token: id,
  reference_status: z.enum(["resolved_local", "unresolved_local", "ambiguous_local", "empty_fragment_unverified", "base_context_unverified", "external_unverified", "relative_or_bare_unverified"]),
  candidate_count: z.number().int().nonnegative(), xml_base_chain: base,
  target: node.nullable(), surface: node.nullable(), graphics: z.array(node).max(10), diagnostics: z.array(z.string()),
});
export const teiTargetSchema = z.object({
  canvas_id: id, xywh: xywh.nullable(), region_id: id.nullable(),
  basis: z.enum(["direct_canvas", "surface_binding", "manual_region"]),
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
