import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { buildToolCacheInfo } from "../lib/toolCache.js";
import {
  buildSearchDiagnostics,
  buildSearchInterpretation
} from "../lib/searchDiagnostics.js";
import { searchInputSchema } from "../lib/schemas.js";
import type { SearchOutput } from "../lib/schemas.js";
import type { createSearchService } from "../services/searchService.js";

type SearchService = ReturnType<typeof createSearchService>;

export function createJpLitSearchTool(
  searchService: SearchService,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = searchInputSchema.parse(input);
    const { force_refresh, ...cacheableInput } = parsed;
    const { structuredContent, cacheHit, cacheKey, savedAt } = await runCachedTool<SearchOutput>({
      tool: "jp_lit_search",
      input: cacheableInput as unknown as Record<string, unknown>,
      cache,
      sessions,
      bypassCache: force_refresh,
      live: async () => {
        const searchResult = await searchService.search({
          query: parsed.query,
          source: parsed.source,
          limit: parsed.limit,
          page: parsed.page,
          sort_by: parsed.sort_by,
          sort_order: parsed.sort_order,
          issued_from: parsed.issued_from,
          issued_to: parsed.issued_to,
          filters: parsed.filters
        });

        return {
          query: parsed.query,
          source: parsed.source ?? null,
          page: parsed.page,
          limit: parsed.limit ?? (parsed.source ? 50 : 48),
          total: searchResult.total,
          items: searchResult.items,
          facets: searchResult.facets
        };
      }
    });

    const interpretation = buildSearchInterpretation({
      source: structuredContent.source,
      total: structuredContent.total
    });
    const diagnostics = buildSearchDiagnostics({
      query: structuredContent.query,
      source: structuredContent.source,
      total: structuredContent.total
    });

    const response: SearchOutput = {
      ...structuredContent,
      interpretation,
      ...(diagnostics.length > 0 ? { diagnostics } : {}),
      cache: buildToolCacheInfo({ cacheHit, cacheKey, savedAt })
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response, null, 2)
        }
      ],
      structuredContent: response
    };
  };
}
