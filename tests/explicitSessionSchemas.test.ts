import { describe, expect, it } from "vitest";
import type { ZodTypeAny } from "zod";

import { createCacheKey } from "../src/lib/persistence/cacheKeys.js";
import {
  annotateSessionInputSchema,
  authorityTermsByClassificationInputSchema,
  enrichRecordInputSchema,
  exportSessionInputSchema,
  fulltextInputSchema,
  guidesCasesInputSchema,
  guidesManualsInputSchema,
  recordInputSchema,
  recordsInputSchema,
  resolveAuthorityInputSchema,
  searchFulltextInputSchema,
  searchIllustrationsInputSchema,
  searchInputSchema,
  searchKakenProjectsInputSchema,
  searchKokushoFulltextInputSchema,
  searchKokushoImageTagsInputSchema,
  searchPagesInputSchema,
  suggestClassificationCodesInputSchema,
  textCoordinatesInputSchema,
  updateSessionTraceInputSchema
} from "../src/lib/schemas.js";

const SESSION_ID = "2026-08-08-120000-a1b2c3d4";
const CACHE_KEY = createCacheKey("jp_lit_search", { query: "遊び" });

const cases: Array<{
  name: string;
  schema: ZodTypeAny;
  input: Record<string, unknown>;
}> = [
  { name: "jp_lit_search", schema: searchInputSchema, input: { query: "遊び" } },
  {
    name: "jp_lit_get_record",
    schema: recordInputSchema,
    input: { source: "ndl_search", source_id: "R1" }
  },
  {
    name: "jp_lit_get_records",
    schema: recordsInputSchema,
    input: { source: "ndl_search", source_ids: ["R1"] }
  },
  {
    name: "jp_lit_enrich_record",
    schema: enrichRecordInputSchema,
    input: { title: "遊び" }
  },
  {
    name: "jp_lit_get_text_coordinates",
    schema: textCoordinatesInputSchema,
    input: { source: "ndl_digital", pid: "123", page: 1 }
  },
  {
    name: "jp_lit_get_fulltext",
    schema: fulltextInputSchema,
    input: { source: "ndl_digital", pid: "123" }
  },
  {
    name: "jp_lit_search_pages",
    schema: searchPagesInputSchema,
    input: { source: "ndl_digital", pid: "123", keyword: "遊び" }
  },
  {
    name: "jp_lit_search_fulltext",
    schema: searchFulltextInputSchema,
    input: { keyword: "遊び" }
  },
  {
    name: "jp_lit_search_illustrations",
    schema: searchIllustrationsInputSchema,
    input: { keyword: "遊び" }
  },
  {
    name: "jp_lit_search_kokusho_fulltext",
    schema: searchKokushoFulltextInputSchema,
    input: { keyword: "遊び" }
  },
  {
    name: "jp_lit_search_kokusho_image_tags",
    schema: searchKokushoImageTagsInputSchema,
    input: { keyword: "遊び" }
  },
  {
    name: "jp_lit_search_guides_manuals",
    schema: guidesManualsInputSchema,
    input: { query: "遊び" }
  },
  {
    name: "jp_lit_search_guides_cases",
    schema: guidesCasesInputSchema,
    input: { query: "遊び" }
  },
  {
    name: "jp_lit_resolve_authority",
    schema: resolveAuthorityInputSchema,
    input: { query: "遊び" }
  },
  {
    name: "jp_lit_find_authority_terms_by_classification",
    schema: authorityTermsByClassificationInputSchema,
    input: { classification: "910.26" }
  },
  {
    name: "jp_lit_suggest_classification_codes",
    schema: suggestClassificationCodesInputSchema,
    input: { term: "近代日本文学" }
  },
  {
    name: "jp_lit_search_kaken_projects",
    schema: searchKakenProjectsInputSchema,
    input: { query: "遊び" }
  },
  {
    name: "jp_lit_annotate_session",
    schema: annotateSessionInputSchema,
    input: { tool: "jp_lit_search", cache_key: CACHE_KEY, selected_items: [] }
  },
  {
    name: "jp_lit_update_session_trace",
    schema: updateSessionTraceInputSchema,
    input: { research_goal: "遊び概念を調べる" }
  },
  {
    name: "jp_lit_export_session",
    schema: exportSessionInputSchema,
    input: {}
  }
];

describe("explicit research session schemas", () => {
  it.each(cases)("requires session_id for $name", ({ schema, input }) => {
    expect(schema.safeParse(input).success).toBe(false);
    expect(schema.safeParse({ ...input, session_id: SESSION_ID }).success).toBe(true);
  });
});
