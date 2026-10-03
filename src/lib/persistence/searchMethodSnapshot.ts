import type { SearchOutput } from "../schemas.js";
import type { SearchContext } from "../searchContext.js";

export interface SearchMethodSnapshot {
  schema_version: 1;
  observed_at: string;
  result_saved_at: string;
  cache_hit: boolean;
  total: number;
  returned_count: number;
  context: SearchContext | null;
}

export function buildSearchMethodSnapshot(input: {
  result: SearchOutput;
  cacheHit: boolean;
  savedAt: string;
  observedAt: string;
}): SearchMethodSnapshot {
  return {
    schema_version: 1,
    observed_at: input.observedAt,
    result_saved_at: input.savedAt,
    cache_hit: input.cacheHit,
    total: input.result.total,
    returned_count: input.result.items.length,
    context: input.result.search_context ?? null
  };
}
