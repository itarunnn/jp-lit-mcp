import { z } from "zod";

export const sourceSchema = z.enum([
  "ndl_search",
  "ndl_digital",
  "cinii_research"
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

export const searchItemSchema = z.object({
  source: sourceSchema,
  source_id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  authors: z.array(personRoleSchema),
  publisher: z.string().nullable(),
  issued_at: z.string().nullable(),
  issued_at_label: z.string().nullable(),
  issued_at_precision: issuedAtPrecisionSchema,
  summary: z.string().nullable(),
  url: z.string().nullable(),
  availability: availabilitySchema
});

export const recordItemSchema = searchItemSchema.extend({
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

export const searchInputSchema = z.object({
  query: z.string().trim().min(1),
  source: sourceSchema.optional(),
  limit: z.number().int().positive().max(50).default(10),
  page: z.number().int().positive().default(1)
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
  items: z.array(searchItemSchema)
});

export const recordOutputSchema = recordItemSchema;

export type SearchInput = z.infer<typeof searchInputSchema>;
export type RecordInput = z.infer<typeof recordInputSchema>;
export type SearchOutput = z.infer<typeof searchOutputSchema>;
export type RecordOutput = z.infer<typeof recordOutputSchema>;
