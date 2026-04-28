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
    filters: z.object({
      irdb: irdbFiltersSchema.optional(),
      nihu_bridge: nihuBridgeFiltersSchema.optional()
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
  facets: facetsSchema.optional()
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

const fulltextBookItemSchema = z.object({
  pid: z.string(),
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

export type SearchIllustrationsInput = z.infer<typeof searchIllustrationsInputSchema>;
export type SearchIllustrationsOutput = z.infer<typeof searchIllustrationsOutputSchema>;
