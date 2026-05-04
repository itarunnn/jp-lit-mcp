import { z } from "zod";

export const sourceSchema = z.enum([
  "ndl_search",
  "ndl_catalog",
  "ndl_digital",
  "ndl_articles",
  "ndl_articles_online",
  "irdb",
  "jdcat",
  "jstage_articles",
  "japan_search",
  "cinii_articles",
  "cinii_books",
  "kokkai_minutes",
  "teikoku_minutes",
  "nihu_bridge"
]);
export const issuedAtPrecisionSchema = z.enum(["day", "month", "year", "unknown"]);

const personRoleSchema = z.object({
  name: z.string(),
  role: z.string().nullable()
});

const availabilitySchema = z.object({
  online: z.boolean(),
  digital_collection: z.boolean()
});

const contentAccessSchema = z.object({
  has_page_images: z.boolean(),
  has_text_coordinates: z.boolean(),
  viewer_url: z.string().nullable(),
  access_note: z.string().nullable()
});

const relatedSearchRecordSchema = z.object({
  source: sourceSchema,
  source_id: z.string(),
  title: z.string(),
  url: z.string().nullable()
});

const facetsSchema = z.object({
  providers: z.record(z.string(), z.number()),
  ndc: z.record(z.string(), z.number()),
  issued_years: z.record(z.string(), z.number())
});

export const searchItemSchema = z.object({
  source: sourceSchema,
  source_id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  title_reading: z.string().nullable(),
  authors: z.array(personRoleSchema),
  publisher: z.string().nullable(),
  journal_title: z.string().nullable(),
  issued_at: z.string().nullable(),
  issued_at_label: z.string().nullable(),
  issued_at_precision: issuedAtPrecisionSchema,
  summary: z.string().nullable(),
  url: z.string().nullable(),
  availability: availabilitySchema,
  material_type: z.string().nullable(),
  subjects: z.array(z.string()),
  table_of_contents: z.array(z.string()),
  source_metadata: z.record(z.unknown()).optional(),
  duplicate_key: z.string().nullable(),
  duplicate_count: z.number().int().positive(),
  related_records: z.array(relatedSearchRecordSchema)
});

export const recordItemSchema = z.object({
  source: sourceSchema,
  source_id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  title_reading: z.string().nullable(),
  authors: z.array(personRoleSchema),
  publisher: z.string().nullable(),
  journal_title: z.string().nullable(),
  issued_at: z.string().nullable(),
  issued_at_label: z.string().nullable(),
  issued_at_precision: issuedAtPrecisionSchema,
  summary: z.string().nullable(),
  url: z.string().nullable(),
  availability: availabilitySchema,
  alternative_titles: z.array(z.string()),
  publication_place: z.string().nullable(),
  language: z.string().nullable(),
  material_type: z.string().nullable(),
  extent: z.string().nullable(),
  subjects: z.array(z.string()),
  identifiers: z.record(z.unknown()),
  table_of_contents: z.array(z.string()),
  content_access: contentAccessSchema,
  source_metadata: z.record(z.unknown()),
  raw: z.record(z.unknown())
});

export const irdbFiltersSchema = z.object({
  fulltext: z.boolean().optional(),
  title: z.string().optional(),
  author: z.string().optional(),
  keyword: z.string().optional(),
  journal: z.string().optional(),
  publisher: z.string().optional()
});

export const nihuBridgeInstituteSchema = z.enum([
  "nijl", "nmjh", "ninjal", "ircjs", "rihn", "nme", "nihu"
]);

export const nihuBridgeBboxSchema = z.object({
  lat1: z.number(),
  lon1: z.number(),
  lat2: z.number(),
  lon2: z.number()
});

export const nihuBridgeFiltersSchema = z.object({
  institute: z.array(nihuBridgeInstituteSchema).optional(),
  database: z.array(z.string()).optional(),
  normalize: z.boolean().optional(),
  period_from: z.string().optional(),
  period_to: z.string().optional(),
  bbox: nihuBridgeBboxSchema.optional()
});

export const jdcatFiltersSchema = z.object({
  subject: z.string().optional(),
  geographic: z.string().optional(),
  contributor: z.string().optional(),
  title: z.string().optional(),
  temporal: z.string().optional(),
  creator: z.string().optional()
});

export const ndlFiltersSchema = z.object({
  subject: z.string().optional(),
  ndc: z.string().optional(),
  ndlc: z.string().optional()
});

export const searchInputSchema = z
  .object({
    query: z.string().trim().min(1),
    source: sourceSchema.optional(),
    limit: z.number().int().positive().max(100).optional(),
    page: z.number().int().positive().default(1),
    sort_by: z
      .enum(["title", "creator", "issued_date", "created_date", "modified_date"])
      .optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
    force_refresh: z.boolean().default(false),
    issued_from: z.string().optional(),
    issued_to: z.string().optional(),
    filters: z.object({
      irdb: irdbFiltersSchema.optional(),
      nihu_bridge: nihuBridgeFiltersSchema.optional(),
      jdcat: jdcatFiltersSchema.optional(),
      ndl: ndlFiltersSchema.optional()
    }).optional()
  })
  .superRefine((data, ctx) => {
    if (data.filters?.irdb !== undefined && data.source !== "irdb") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "filters.irdb は source=irdb のときのみ有効です",
        path: ["filters", "irdb"]
      });
    }
    if (data.filters?.nihu_bridge !== undefined && data.source !== "nihu_bridge") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "filters.nihu_bridge は source=nihu_bridge のときのみ有効です",
        path: ["filters", "nihu_bridge"]
      });
    }
    if (data.filters?.jdcat !== undefined && data.source !== "jdcat") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "filters.jdcat は source=jdcat のときのみ有効です",
        path: ["filters", "jdcat"]
      });
    }
    if (
      data.filters?.ndl !== undefined &&
      data.source !== "ndl_search" &&
      data.source !== "ndl_catalog" &&
      data.source !== "ndl_digital" &&
      data.source !== "ndl_articles" &&
      data.source !== "ndl_articles_online"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "filters.ndl は NDL 系 source のときのみ有効です",
        path: ["filters", "ndl"]
      });
    }
  });

export const recordInputSchema = z.object({
  source: sourceSchema,
  source_id: z.string().trim().min(1)
});

export const searchOutputSchema = z.object({
  query: z.string(),
  source: sourceSchema.nullable(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(searchItemSchema),
  facets: facetsSchema.optional(),
  cache: z.object({
    hit: z.boolean(),
    cache_key: z.string(),
    saved_at: z.string(),
    refresh_hint: z.string().nullable()
  }).optional()
});

export const recordOutputSchema = recordItemSchema;

export const textCoordinatesInputSchema = z.object({
  source: sourceSchema,
  source_id: z.string().trim().min(1).optional(),
  pid: z.string().trim().min(1).optional(),
  page: z.number().int().positive()
}).refine(d => d.source_id !== undefined || d.pid !== undefined, {
  message: "source_id または pid のいずれかは必須です"
});

export const textCoordinatesOutputSchema = z.object({
  pid: z.string(),
  page: z.number().int().positive(),
  page_image_url: z.string(),
  contents: z.unknown(),
  coordjson: z.unknown(),
  raw: z.record(z.unknown())
});

export const fulltextInputSchema = z.object({
  source: sourceSchema,
  source_id: z.string().trim().min(1).optional(),
  pid: z.string().trim().min(1).optional()
}).refine(d => d.source_id !== undefined || d.pid !== undefined, {
  message: "source_id または pid のいずれかは必須です"
});

export const fulltextOutputSchema = z.object({
  pid: z.string(),
  pages: z.unknown(),
  raw: z.record(z.unknown())
});

export const searchPagesInputSchema = z.object({
  source: sourceSchema,
  source_id: z.string().trim().min(1).optional(),
  pid: z.string().trim().min(1).optional(),
  keyword: z.string().trim().min(1),
  size: z.number().int().positive().max(100).default(20),
  from: z.number().int().nonnegative().default(0)
}).refine(d => d.source_id !== undefined || d.pid !== undefined, {
  message: "source_id または pid のいずれかは必須です"
});

export const searchPagesOutputSchema = z.object({
  pid: z.string(),
  keyword: z.string(),
  total: z.number().int().nonnegative(),
  from: z.number().int().nonnegative(),
  items: z.unknown(),
  raw: z.record(z.unknown())
});

export type IrdbFilters = z.infer<typeof irdbFiltersSchema>;
export type NihuBridgeFilters = z.infer<typeof nihuBridgeFiltersSchema>;
export type NihuBridgeInstitute = z.infer<typeof nihuBridgeInstituteSchema>;
export type JdcatFilters = z.infer<typeof jdcatFiltersSchema>;
export type NihuBridgeBbox = z.infer<typeof nihuBridgeBboxSchema>;
export type SearchInput = z.infer<typeof searchInputSchema>;
export type RecordInput = z.infer<typeof recordInputSchema>;
export type SearchOutput = z.infer<typeof searchOutputSchema>;
export type RecordOutput = z.infer<typeof recordOutputSchema>;
export type TextCoordinatesInput = z.infer<typeof textCoordinatesInputSchema>;
export type TextCoordinatesOutput = z.infer<typeof textCoordinatesOutputSchema>;
export type FulltextInput = z.infer<typeof fulltextInputSchema>;
export type FulltextOutput = z.infer<typeof fulltextOutputSchema>;
export type SearchPagesInput = z.infer<typeof searchPagesInputSchema>;
export type SearchPagesOutput = z.infer<typeof searchPagesOutputSchema>;

export const sessionItemLabelSchema = z.enum([
  "confirmed",
  "strong_candidate",
  "weak_candidate"
]);

export const annotateSessionInputSchema = z.object({
  tool: z.string().trim().min(1),
  cache_key: z.string().trim().min(1),
  selected_items: z.array(
    z.object({
      source: sourceSchema,
      source_id: z.string().trim().min(1),
      title: z.string().trim().min(1),
      label: sessionItemLabelSchema,
      note: z.string().trim().min(1).nullable()
    })
  ),
  notes: z.array(z.string().trim().min(1)).optional()
});

export const annotateSessionOutputSchema = z.object({
  session_id: z.string(),
  updated_at: z.string(),
  annotated_count: z.number().int().nonnegative()
});

export const exportSessionInputSchema = z.object({
  session_id: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}-\d{6}$/).optional(),
  format: z.enum(["markdown", "json", "csl-json"]).default("markdown"),
  profile: z
    .enum(["full_log", "selected", "unselected"])
    .default("full_log"),
  output_path: z.string().trim().min(1).optional(),
  include_unselected: z.boolean().default(true)
});

export const exportSessionOutputSchema = z.object({
  session_id: z.string(),
  format: z.enum(["markdown", "json", "csl-json"]),
  profile: z.enum(["full_log", "selected", "unselected"]),
  path: z.string(),
  exported_at: z.string(),
  item_count: z.number().int().nonnegative()
});

export const findSessionsInputSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().positive().max(50).default(10)
});

export const findSessionsMatchedFieldSchema = z.enum([
  "query",
  "selected_title",
  "notes"
]);

export const findSessionsOutputSchema = z.object({
  query: z.string(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      session_id: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
      matched_fields: z.array(findSessionsMatchedFieldSchema),
      query_preview: z.string().nullable(),
      selected_count: z.number().int().nonnegative(),
      note_preview: z.string().nullable()
    })
  )
});

export const searchCacheIndexInputSchema = z.object({
  query: z.string().trim().min(1),
  session_id: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}-\d{6}$/).optional(),
  source: sourceSchema.optional(),
  issued_from: z.string().optional(),
  issued_to: z.string().optional(),
  saved_on: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|today|yesterday|last_7_days)$/)
    .optional(),
  saved_from: z.string().optional(),
  saved_to: z.string().optional(),
  limit: z.number().int().positive().max(200).default(50)
});

export const searchCacheIndexOutputSchema = z.object({
  query: z.string(),
  session_id: z.string().nullable(),
  source: sourceSchema.nullable(),
  issued_from: z.string().nullable(),
  issued_to: z.string().nullable(),
  saved_on: z.string().nullable(),
  saved_on_resolved: z.string().nullable(),
  saved_from: z.string().nullable(),
  saved_to: z.string().nullable(),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  cache_keys: z.array(z.string()),
  items: z.array(
    z.object({
      cache_key: z.string(),
      session_ids: z.array(z.string()),
      saved_at: z.string(),
      source: sourceSchema.nullable(),
      query_preview: z.string().nullable(),
      total: z.number().int().nonnegative(),
      item_count: z.number().int().nonnegative(),
      matched_fields: z.array(
        z.enum(["query", "title", "author", "subject", "source_id"])
      )
    })
  )
});

export const deleteCacheInputSchema = z
  .object({
    tool: z.string().trim().min(1).default("jp_lit_search"),
    cache_key: z.string().trim().min(1).optional(),
    clear_all: z.boolean().default(false)
  })
  .superRefine((data, ctx) => {
    if (!data.clear_all && !data.cache_key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cache_key を指定するか clear_all=true を指定してください",
        path: ["cache_key"]
      });
    }
  });

export const deleteCacheOutputSchema = z.object({
  tool: z.string(),
  cache_key: z.string().nullable(),
  clear_all: z.boolean(),
  deleted_count: z.number().int().nonnegative(),
  deleted: z.boolean(),
  message: z.string()
});

export const listCacheInputSchema = z.object({
  tool: z.string().trim().min(1).optional(),
  session_id: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}-\d{6}$/).optional(),
  saved_on: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|today|yesterday|last_7_days)$/)
    .optional(),
  saved_from: z.string().optional(),
  saved_to: z.string().optional(),
  source: sourceSchema.optional(),
  limit: z.number().int().positive().max(500).default(100)
});

export const listCacheOutputSchema = z.object({
  tool: z.string().nullable(),
  session_id: z.string().nullable(),
  saved_on: z.string().nullable(),
  saved_on_resolved: z.string().nullable(),
  saved_from: z.string().nullable(),
  saved_to: z.string().nullable(),
  source: sourceSchema.nullable(),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  cache_keys: z.array(z.string()),
  summary: z.object({
    by_tool: z.record(z.string(), z.number()),
    by_source: z.record(z.string(), z.number()),
    newest_saved_at: z.string().nullable(),
    oldest_saved_at: z.string().nullable()
  }),
  items: z.array(
    z.object({
      tool: z.string(),
      cache_key: z.string(),
      saved_at: z.string(),
      source: sourceSchema.nullable(),
      session_ids: z.array(z.string()),
      query_preview: z.string().nullable(),
      total: z.number().int().nonnegative(),
      item_count: z.number().int().nonnegative()
    })
  )
});

const refineResultsFiltersSchema = z.object({
  source: sourceSchema.optional(),
  issued_from: z.string().optional(),
  issued_to: z.string().optional(),
  online: z.boolean().optional(),
  digital_collection: z.boolean().optional(),
  title_contains: z.string().trim().min(1).optional(),
  author_contains: z.string().trim().min(1).optional()
});

export const refineResultsInputSchema = z.object({
  cache_key: z.string().trim().min(1).optional(),
  cache_keys: z.array(z.string().trim().min(1)).min(1).optional(),
  session_id: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}-\d{6}$/).optional(),
  combine: z.enum(["union", "intersection", "minus"]).default("union"),
  key_by: z
    .enum(["source_record", "duplicate_key", "title_author_year"])
    .default("source_record"),
  sort_by: z.enum(["issued_at", "title"]).optional(),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
  limit: z.number().int().positive().max(200).default(30),
  offset: z.number().int().nonnegative().default(0),
  filters: refineResultsFiltersSchema.optional()
});

export const refineResultsOutputSchema = z.object({
  base_cache_key: z.string(),
  base_cache_keys: z.array(z.string()),
  combine: z.enum(["union", "intersection", "minus"]),
  key_by: z.enum(["source_record", "duplicate_key", "title_author_year"]),
  totals_by_base: z.array(
    z.object({
      cache_key: z.string(),
      total: z.number().int().nonnegative()
    })
  ),
  total_before: z.number().int().nonnegative(),
  total_after: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  items: z.array(searchItemSchema)
});

export const exportViewInputSchema = z.discriminatedUnion("view", [
  z.object({
    view: z.literal("cache_list"),
    params: listCacheInputSchema.default({}),
    format: z.enum(["markdown", "json"]).default("markdown"),
    output_path: z.string().trim().min(1).optional()
  }),
  z.object({
    view: z.literal("cache_query"),
    params: searchCacheIndexInputSchema,
    format: z.enum(["markdown", "json"]).default("markdown"),
    output_path: z.string().trim().min(1).optional()
  }),
  z.object({
    view: z.literal("refined_results"),
    params: refineResultsInputSchema.default({}),
    format: z.enum(["markdown", "json"]).default("markdown"),
    output_path: z.string().trim().min(1).optional()
  })
]);

export const exportViewOutputSchema = z.object({
  view: z.enum(["cache_list", "cache_query", "refined_results"]),
  format: z.enum(["markdown", "json"]),
  path: z.string(),
  exported_at: z.string(),
  item_count: z.number().int().nonnegative()
});

const fulltextBookItemSchema = z.object({
  pid: z.string(),
  viewer_url: z.string(),
  title: z.string().nullable(),
  volume: z.string().nullable(),
  responsibility: z.string().nullable(),
  publisher: z.string().nullable(),
  published: z.string().nullable(),
  publishyear: z.number().int().nullable(),
  ndc: z.string().nullable(),
  bib_id: z.string().nullable(),
  call_no: z.string().nullable(),
  page_count: z.number().int().nullable(),
  is_classic: z.boolean().nullable(),
  highlights: z.unknown()
});

export const searchFulltextInputSchema = z.object({
  keyword: z.string().trim().min(1),
  searchfield: z.enum(["contentonly", "metaonly", "all"]).default("contentonly"),
  size: z.number().int().positive().max(100).default(20),
  from: z.number().int().nonnegative().default(0),
  f_ndc: z.string().optional(),
  fc_is_classic: z.boolean().optional()
});

export const searchFulltextOutputSchema = z.object({
  keyword: z.string(),
  searchfield: z.enum(["contentonly", "metaonly", "all"]),
  total: z.number().int().nonnegative(),
  from: z.number().int().nonnegative(),
  items: z.array(fulltextBookItemSchema),
  raw: z.record(z.unknown())
});

export type SearchFulltextInput = z.infer<typeof searchFulltextInputSchema>;
export type SearchFulltextOutput = z.infer<typeof searchFulltextOutputSchema>;

const illustrationItemSchema = z.object({
  id: z.string(),
  pid: z.string(),
  viewer_url: z.string(),
  page: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  graphictags: z.array(z.object({
    tagname: z.string(),
    confidence: z.number()
  })),
  page_image_url: z.string(),
  illustration_image_url: z.string()
});

export const searchIllustrationsInputSchema = z.object({
  keyword: z.string().trim().min(1),
  size: z.number().int().positive().max(100).default(20),
  from: z.number().int().nonnegative().default(0)
});

export const searchIllustrationsOutputSchema = z.object({
  keyword: z.string(),
  total: z.number().int().nonnegative(),
  from: z.number().int().nonnegative(),
  items: z.array(illustrationItemSchema),
  raw: z.record(z.unknown())
});

const crdLibGroupSchema = z.enum([
  "public",
  "univ",
  "special",
  "school",
  "archive",
  "ndl",
  "other"
]);

const guidesSearchInputBaseSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().positive().max(20).default(10),
  page: z.number().int().positive().default(1),
  lib_id: z.string().trim().min(1).optional(),
  lib_group: crdLibGroupSchema.optional()
});

const guidesBaseItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  provider: z.string().nullable(),
  url: z.string(),
  published_at: z.string().nullable(),
  categories: z.array(z.string()),
  summary: z.string().nullable(),
  description: z.string()
});

export const guidesManualsInputSchema = guidesSearchInputBaseSchema;
export const guidesCasesInputSchema = guidesSearchInputBaseSchema;

export const guidesManualItemSchema = guidesBaseItemSchema.extend({
  search_keywords: z.array(z.string()),
  guide_headings: z.array(z.string())
});

export const guidesCaseItemSchema = guidesBaseItemSchema.extend({
  question: z.string().nullable(),
  answer_process: z.string().nullable(),
  preliminary_research: z.string().nullable(),
  reference_sources: z.array(z.string())
});

export const guidesManualsOutputSchema = z.object({
  query: z.string(),
  type: z.literal("manual"),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(guidesManualItemSchema),
  raw: z.record(z.unknown())
});

export const guidesCasesOutputSchema = z.object({
  query: z.string(),
  type: z.literal("reference"),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(guidesCaseItemSchema),
  raw: z.record(z.unknown())
});

export type SearchIllustrationsInput = z.infer<typeof searchIllustrationsInputSchema>;
export type SearchIllustrationsOutput = z.infer<typeof searchIllustrationsOutputSchema>;
export type GuidesManualsInput = z.infer<typeof guidesManualsInputSchema>;
export type GuidesManualsOutput = z.infer<typeof guidesManualsOutputSchema>;
export type GuidesCasesInput = z.infer<typeof guidesCasesInputSchema>;
export type GuidesCasesOutput = z.infer<typeof guidesCasesOutputSchema>;
export type AnnotateSessionInput = z.infer<typeof annotateSessionInputSchema>;
export type AnnotateSessionOutput = z.infer<typeof annotateSessionOutputSchema>;
export type ExportSessionInput = z.infer<typeof exportSessionInputSchema>;
export type ExportSessionOutput = z.infer<typeof exportSessionOutputSchema>;
export type ExportViewInput = z.infer<typeof exportViewInputSchema>;
export type ExportViewOutput = z.infer<typeof exportViewOutputSchema>;
export type FindSessionsInput = z.infer<typeof findSessionsInputSchema>;
export type FindSessionsOutput = z.infer<typeof findSessionsOutputSchema>;
export type SearchCacheIndexInput = z.infer<typeof searchCacheIndexInputSchema>;
export type SearchCacheIndexOutput = z.infer<typeof searchCacheIndexOutputSchema>;
export type DeleteCacheInput = z.infer<typeof deleteCacheInputSchema>;
export type DeleteCacheOutput = z.infer<typeof deleteCacheOutputSchema>;
export type ListCacheInput = z.infer<typeof listCacheInputSchema>;
export type ListCacheOutput = z.infer<typeof listCacheOutputSchema>;
export type RefineResultsInput = z.infer<typeof refineResultsInputSchema>;
export type RefineResultsOutput = z.infer<typeof refineResultsOutputSchema>;
