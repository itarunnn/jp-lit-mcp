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
  "nihu_bridge",
  "national_archives",
  "jacar"
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

const sourcePlanInputSchema = z.object({
  source: sourceSchema,
  status: z.enum(["planned", "used", "deferred", "skipped"]),
  reason: z.string().trim().min(1),
  expected_contribution: z.string().trim().min(1).optional()
}).strict();

const searchAttemptSchema = z.object({
  source: sourceSchema.nullable(),
  query: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  total: z.number().int().nonnegative().nullable(),
  returned_count: z.number().int().nonnegative(),
  extracted_count: z.number().int().nonnegative(),
  outcome: z.enum(["useful", "partial", "empty", "noisy", "failed"]),
  next_step: z.string().trim().min(1).optional()
}).strict();

function createEvidenceRefSchema() {
  return z.object({
    tool: z.string().trim().min(1).optional(),
    cache_key: z.string().trim().min(1).optional(),
    source: sourceSchema.optional(),
    source_id: z.string().trim().min(1).optional(),
    url: z.string().trim().min(1).optional(),
    quote_or_summary: z.string().trim().min(1).optional()
  }).strict();
}

const traceTargetSchema = z.object({
  source: sourceSchema.optional(),
  source_id: z.string().trim().min(1).optional(),
  cache_key: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional()
}).strict();

const evidenceTargetSchema = traceTargetSchema.omit({ cache_key: true }).strict();

const decisionInputSchema = z.object({
  kind: z.enum(["adopt", "hold", "reject", "deduplicate", "needs_followup"]),
  target: traceTargetSchema,
  reason: z.string().trim().min(1),
  evidence_refs: z.array(createEvidenceRefSchema())
}).strict();

const evidenceScopeInputSchema = z.object({
  target: evidenceTargetSchema,
  checked: z.enum([
    "metadata",
    "abstract",
    "toc",
    "fulltext_snippet",
    "fulltext",
    "external_review"
  ]),
  body_status: z.enum([
    "not_checked",
    "online_entry_unread",
    "no_online_entry",
    "restricted",
    "confirmed"
  ]),
  note: z.string().trim().min(1).optional(),
  evidence_refs: z.array(createEvidenceRefSchema())
}).strict();

const entryTraceInputSchema = z.object({
  intent: z.string().trim().min(1).optional(),
  search_attempt: searchAttemptSchema.optional(),
  decisions: z.array(decisionInputSchema).optional(),
  evidence_scope: z.array(evidenceScopeInputSchema).optional()
}).strict();

const openQuestionInputSchema = z.object({
  question: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  related_sources: z.array(sourceSchema).optional()
}).strict();

const nextActionInputSchema = z.object({
  action: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  priority: z.enum(["high", "medium", "low"]),
  source: sourceSchema.optional()
}).strict();

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
  notes: z.array(z.string().trim().min(1)).optional(),
  trace: entryTraceInputSchema.optional()
});

export const annotateSessionOutputSchema = z.object({
  session_id: z.string(),
  updated_at: z.string(),
  annotated_count: z.number().int().nonnegative()
});

export const updateSessionTraceInputSchema = z.object({
  research_goal: z.string().trim().min(1).optional(),
  scope_note: z.string().trim().min(1).optional(),
  source_plans: z.array(sourcePlanInputSchema).optional(),
  open_questions: z.array(openQuestionInputSchema).optional(),
  next_actions: z.array(nextActionInputSchema).optional()
}).strict();

export const updateSessionTraceOutputSchema = z.object({
  session_id: z.string(),
  updated_at: z.string(),
  source_plan_count: z.number().int().nonnegative(),
  open_question_count: z.number().int().nonnegative(),
  next_action_count: z.number().int().nonnegative()
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

export const pruneCacheInputSchema = z.object({
  older_than_days: z.number().int().positive().default(30),
  tool: z.string().trim().min(1).optional(),
  dry_run: z.boolean().default(true),
  limit: z.number().int().positive().max(1000).default(100)
});

export const pruneCacheOutputSchema = z.object({
  dry_run: z.boolean(),
  older_than_days: z.number().int().positive(),
  cutoff_saved_at: z.string(),
  tool: z.string().nullable(),
  limit: z.number().int().positive(),
  matched_count: z.number().int().nonnegative(),
  pruned_count: z.number().int().nonnegative(),
  total_bytes: z.number().int().nonnegative(),
  candidates: z.array(z.object({
    tool: z.string(),
    cache_key: z.string(),
    saved_at: z.string(),
    bytes: z.number().int().nonnegative(),
    root: z.enum(["current", "legacy"])
  })),
  skipped_count: z.number().int().nonnegative(),
  skipped: z.array(z.object({
    path: z.string(),
    reason: z.string()
  })),
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

const duplicateClusterReasonSchema = z.enum([
  "shared_duplicate_key",
  "title_author_year_match",
  "title_author_match",
  "year_match",
  "publisher_match",
  "multi_source",
  "same_source_variant"
]);

const searchResultReadinessSchema = z.object({
  level: z.enum(["strong", "medium", "weak"]),
  reasons: z.array(z.string()),
  missing: z.array(z.string())
});

const duplicateClusterSchema = z.object({
  cluster_id: z.string(),
  duplicate_confidence: z.enum(["strong", "medium", "weak"]),
  member_count: z.number().int().positive(),
  representative: searchItemSchema,
  members_preview: z.array(searchItemSchema),
  omitted_member_count: z.number().int().nonnegative(),
  reasons: z.array(duplicateClusterReasonSchema),
  search_result_readiness: searchResultReadinessSchema,
  caution: z.string()
});

const duplicateClusterSummarySchema = z.object({
  total_items_considered: z.number().int().nonnegative(),
  cluster_count: z.number().int().nonnegative(),
  singleton_count: z.number().int().nonnegative(),
  strong_cluster_count: z.number().int().nonnegative(),
  medium_cluster_count: z.number().int().nonnegative(),
  weak_cluster_count: z.number().int().nonnegative(),
  returned_cluster_count: z.number().int().nonnegative(),
  cluster_limit: z.number().int().positive(),
  cluster_offset: z.number().int().nonnegative()
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
  include_duplicate_clusters: z.boolean().default(false),
  cluster_limit: z.number().int().positive().default(20),
  cluster_offset: z.number().int().nonnegative().default(0),
  cluster_member_limit: z.number().int().positive().default(5),
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
  items: z.array(searchItemSchema),
  cluster_summary: duplicateClusterSummarySchema.optional(),
  clusters: z.array(duplicateClusterSchema).optional()
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
    export_all: z.boolean().default(false),
    duplicate_notes: z.boolean().default(false),
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

const authorityTypeSchema = z.enum([
  "person",
  "corporate",
  "subject",
  "uniform_title",
  "genre",
  "unknown"
]);

const resolveAuthorityTypeSchema = z.enum([
  "person",
  "corporate",
  "subject",
  "uniform_title",
  "genre",
  "all"
]);

const authorityRelationSchema = z.enum([
  "pseudonym",
  "former_name",
  "real_name",
  "related_name",
  "unknown"
]);

export const resolveAuthorityInputSchema = z.object({
  query: z.string().trim().min(1),
  type: resolveAuthorityTypeSchema.default("all"),
  limit: z.number().int().positive().max(20).default(5)
});

const authorityLinkedNameSchema = z.object({
  label: z.string(),
  authority_uri: z.string().nullable(),
  relation: authorityRelationSchema,
  relation_label: z.string().nullable()
});

const authorityLinkedTermSchema = z.object({
  label: z.string(),
  authority_uri: z.string().nullable()
});

const authorityItemSchema = z.object({
  authority_uri: z.string(),
  id: z.string().nullable(),
  type: authorityTypeSchema,
  label: z.string(),
  label_reading: z.string().nullable(),
  label_romanized: z.string().nullable(),
  variant_labels: z.array(z.string()),
  same_identity_names: z.array(authorityLinkedNameSchema),
  broader_terms: z.array(authorityLinkedTermSchema),
  narrower_terms: z.array(authorityLinkedTermSchema),
  related_terms: z.array(authorityLinkedTermSchema),
  source_metadata: z.record(z.unknown())
});

export const resolveAuthorityOutputSchema = z.object({
  query: z.string(),
  type: resolveAuthorityTypeSchema,
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  items: z.array(authorityItemSchema),
  search_hints: z.object({
    preferred_terms: z.array(z.string()),
    variant_terms: z.array(z.string()),
    same_identity_terms: z.array(z.string()),
    reference_terms: z.array(z.string()),
    caution: z.string()
  })
});

export const authorityClassificationSchemeSchema = z.enum(["NDC10", "NDC9", "NDC8", "NDC6"]);

export const authorityTermsByClassificationInputSchema = z.object({
  classification: z.string().trim().min(1),
  scheme: authorityClassificationSchemeSchema.default("NDC10"),
  limit: z.number().int().positive().max(50).default(20)
});

export const authorityTermsByClassificationOutputSchema = z.object({
  classification: z.object({
    scheme: authorityClassificationSchemeSchema,
    notation: z.string()
  }),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  items: z.array(authorityItemSchema),
  search_hints: z.object({
    preferred_terms: z.array(z.string()),
    reference_terms: z.array(z.string()),
    caution: z.string()
  })
});

export const searchKakenProjectsInputSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().positive().max(20).default(10),
  page: z.number().int().positive().default(1),
  detail_limit: z.number().int().nonnegative().max(10).default(5),
  researcher_name: z.string().trim().min(1).optional(),
  from_fiscal_year: z.number().int().optional(),
  to_fiscal_year: z.number().int().optional(),
  include_outputs: z.boolean().default(true)
});

const kakenOutputTypeSchema = z.enum([
  "journal_article",
  "book",
  "conference_presentation",
  "report",
  "other"
]);

const kakenProjectSchema = z.object({
  project_id: z.string(),
  title: z.string(),
  url: z.string(),
  principal_investigator: z.object({
    name: z.string(),
    affiliation: z.string().nullable(),
    researcher_number: z.string().nullable()
  }).nullable(),
  fiscal_years: z.string().nullable(),
  project_type: z.string().nullable(),
  fields: z.array(z.string()),
  keywords: z.array(z.string()),
  summary: z.string().nullable(),
  detail_fetched: z.boolean(),
  detail_omitted_reason: z.enum([
    "detail_limit_exceeded",
    "include_outputs_false",
    "fetch_failed"
  ]).nullable(),
  report_pdf_status: z.enum(["found", "none_found", "not_checked", "fetch_failed"]),
  report_pdfs: z.array(z.object({
    label: z.string(),
    fiscal_year: z.string().nullable(),
    url: z.string()
  })),
  outputs_preview: z.array(z.object({
    type: kakenOutputTypeSchema,
    raw_type: z.string().nullable(),
    title: z.string(),
    authors: z.array(z.string()),
    year: z.string().nullable(),
    doi: z.string().nullable(),
    url: z.string().nullable(),
    note: z.string().nullable()
  })),
  search_hints: z.object({
    project_terms: z.array(z.string()),
    researcher_terms: z.array(z.string()),
    keyword_terms: z.array(z.string()),
    caution: z.string()
  })
});

export const searchKakenProjectsOutputSchema = z.object({
  query: z.string(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(kakenProjectSchema),
  cache: z.object({
    hit: z.boolean(),
    cache_key: z.string(),
    saved_at: z.string(),
    refresh_hint: z.string().nullable()
  }).optional()
});

export type SearchIllustrationsInput = z.infer<typeof searchIllustrationsInputSchema>;
export type SearchIllustrationsOutput = z.infer<typeof searchIllustrationsOutputSchema>;
export type GuidesManualsInput = z.infer<typeof guidesManualsInputSchema>;
export type GuidesManualsOutput = z.infer<typeof guidesManualsOutputSchema>;
export type GuidesCasesInput = z.infer<typeof guidesCasesInputSchema>;
export type GuidesCasesOutput = z.infer<typeof guidesCasesOutputSchema>;
export type ResolveAuthorityInput = z.infer<typeof resolveAuthorityInputSchema>;
export type ResolveAuthorityOutput = z.infer<typeof resolveAuthorityOutputSchema>;
export type AuthorityTermsByClassificationInput = z.infer<typeof authorityTermsByClassificationInputSchema>;
export type AuthorityTermsByClassificationOutput = z.infer<typeof authorityTermsByClassificationOutputSchema>;
export type AnnotateSessionInput = z.infer<typeof annotateSessionInputSchema>;
export type AnnotateSessionOutput = z.infer<typeof annotateSessionOutputSchema>;
export type UpdateSessionTraceInput = z.infer<typeof updateSessionTraceInputSchema>;
export type UpdateSessionTraceOutput = z.infer<typeof updateSessionTraceOutputSchema>;
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
export type PruneCacheInput = z.infer<typeof pruneCacheInputSchema>;
export type PruneCacheOutput = z.infer<typeof pruneCacheOutputSchema>;
export type ListCacheInput = z.infer<typeof listCacheInputSchema>;
export type ListCacheOutput = z.infer<typeof listCacheOutputSchema>;
export type RefineResultsInput = z.infer<typeof refineResultsInputSchema>;
export type RefineResultsOutput = z.infer<typeof refineResultsOutputSchema>;
export type SearchKakenProjectsInput = z.infer<typeof searchKakenProjectsInputSchema>;
export type SearchKakenProjectsOutput = z.infer<typeof searchKakenProjectsOutputSchema>;
