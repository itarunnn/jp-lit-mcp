import { z } from "zod";

export const sourceSchema = z.enum([
  "ndl_search",
  "ndl_reference_books",
  "ndl_catalog",
  "ndl_digital",
  "ndl_articles",
  "ndl_articles_online",
  "irdb",
  "jdcat",
  "jstage_articles",
  "japan_search",
  "cinii_articles",
  "cinii_dissertations",
  "cinii_books",
  "kokkai_minutes",
  "teikoku_minutes",
  "nihu_bridge",
  "national_archives",
  "jacar",
  "nijl_articles",
  "kokusho",
  "ninjal_bibliography"
]);

const nonnegative = z.number().int().nonnegative();

export const safeSearchRequestSchema = z.object({
  api_kind: z.enum(["cinii_opensearch", "ndl_sru", "ndl_reference_books", "jstage_webapi"]),
  parameters: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
  ignored_input_fields: z.array(z.string()),
  matching_mode: z.enum(["metadata_conjunction", "unknown"]),
  coverage_note: z.string(),
  attribution: z.string().nullable()
});

export const searchContextSchema = z.object({
  schema_version: z.literal(1),
  producer_version: z.string(),
  requested_query: z.string(),
  query_script: z.enum(["latin", "kana", "han", "han_kana", "mixed", "other"]),
  aggregation: z.enum(["single", "round_robin"]),
  fetch_limit_per_source: nonnegative.nullable(),
  total_semantics: z.enum(["source_reported", "returned_count", "sum_of_source_totals", "unknown"]),
  sources: z.array(z.object({
    source: sourceSchema,
    outcome: z.enum(["completed", "failed", "unknown"]),
    request: safeSearchRequestSchema.nullable(),
    reported_total: nonnegative.nullable(),
    total_basis: z.enum(["source_reported", "returned_count", "unknown"]),
    fetched_count: nonnegative.nullable(),
    included_count: nonnegative,
    error_category: z.enum(["timeout", "http", "invalid_payload", "unknown"]).nullable()
  }))
});
