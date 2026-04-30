import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
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
    const { structuredContent } = await runCachedTool<SearchOutput>({
      tool: "jp_lit_search",
      input: parsed as unknown as Record<string, unknown>,
      cache,
      sessions,
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

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(structuredContent, null, 2)
        }
      ],
      structuredContent
    };
  };
}
