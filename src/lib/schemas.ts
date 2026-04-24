import { z } from "zod";

export const sourceSchema = z.enum(["ndl_search", "ndl_digital"]);

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

export type SearchInput = z.infer<typeof searchInputSchema>;
export type RecordInput = z.infer<typeof recordInputSchema>;
