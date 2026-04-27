import type { createSearchService } from "../services/searchService.js";
import { searchInputSchema } from "../lib/schemas.js";
import type { SearchOutput } from "../lib/schemas.js";

type SearchService = ReturnType<typeof createSearchService>;

export function createJpLitSearchTool(searchService: SearchService) {
  return async (input: unknown) => {
    const parsed = searchInputSchema.parse(input);
    const searchResult = await searchService.search({
      query: parsed.query,
      source: parsed.source,
      limit: parsed.limit,
      page: parsed.page,
      sort_by: parsed.sort_by,
      sort_order: parsed.sort_order,
      filters: parsed.filters
    });
    const structuredContent: SearchOutput = {
      query: parsed.query,
      source: parsed.source ?? null,
      page: parsed.page,
      limit: parsed.limit,
      total: searchResult.total,
      items: searchResult.items,
      facets: searchResult.facets
    };

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
