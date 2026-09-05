import { z } from "zod";

import { cacheKeySchema } from "./persistence/cacheIdentity.js";

export const CANDIDATE_RESULT_TOOLS = [
  "jp_lit_search",
  "jp_lit_search_fulltext",
  "jp_lit_record_ndl_browser_search"
] as const;

export const candidateResultToolSchema = z.enum(CANDIDATE_RESULT_TOOLS);
export const candidateResultRefSchema = z.object({
  tool: candidateResultToolSchema,
  cache_key: cacheKeySchema
}).strict();

export type CandidateResultTool = typeof CANDIDATE_RESULT_TOOLS[number];
export type CandidateResultRef = z.infer<typeof candidateResultRefSchema>;

export function isCandidateResultTool(value: string): value is CandidateResultTool {
  return candidateResultToolSchema.safeParse(value).success;
}
