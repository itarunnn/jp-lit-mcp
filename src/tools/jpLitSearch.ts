import { detectQueryScript } from "../lib/searchContext.js";
import { readPackageVersion } from "../lib/packageInfo.js";
import { buildSearchMethodSnapshot } from "../lib/persistence/searchMethodSnapshot.js";
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

interface JpLitSearchToolOptions {
  ciniiAppIdPresent: boolean;
}

export function createJpLitSearchTool(
  searchService: SearchService,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore(),
  options: JpLitSearchToolOptions = { ciniiAppIdPresent: true }
) {
  return async (input: unknown) => {
    const parsed = searchInputSchema.parse(input);
    const { session_id, force_refresh, ...cacheableInput } = parsed;
    const { structuredContent, cacheHit, cacheKey, savedAt } = await runCachedTool<SearchOutput>({
      tool: "jp_lit_search",
      input: cacheableInput as unknown as Record<string, unknown>,
      sessionId: session_id,
      cache,
      sessions,
      bypassCache: force_refresh,
      createSessionEntry: ({input, cacheKey, structuredContent, cacheHit, savedAt}) => ({
        tool: "jp_lit_search", input, cache_key: cacheKey, result_ref: {tool: "jp_lit_search", cache_key: cacheKey}, selected_items: [], notes: [],
        method_snapshot: buildSearchMethodSnapshot({result: structuredContent, cacheHit, savedAt, observedAt: new Date().toISOString()})
      }),
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
          search_context: {
            schema_version: 1, producer_version: readPackageVersion(), requested_query: parsed.query, query_script: detectQueryScript(parsed.query),
            aggregation: searchResult.aggregation, fetch_limit_per_source: searchResult.fetch_limit_per_source, total_semantics: searchResult.total_semantics, sources: searchResult.sources
          },
          query: parsed.query,
          source: parsed.source ?? null,
          page: parsed.page,
          limit: parsed.limit ?? (parsed.source ? 50 : 48),
          total: searchResult.total,
          items: searchResult.items,
          facets: searchResult.facets,
          ...("source_errors" in searchResult && searchResult.source_errors
            ? { source_errors: searchResult.source_errors }
            : {})
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
      total: structuredContent.total,
      ciniiAppIdPresent: options.ciniiAppIdPresent
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
