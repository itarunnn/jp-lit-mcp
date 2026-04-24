import type { createSearchService } from "../services/searchService.js";
import { searchInputSchema } from "../lib/schemas.js";

type SearchService = ReturnType<typeof createSearchService>;

export function createJpLitSearchTool(searchService: SearchService) {
  return async (input: unknown) => {
    const parsed = searchInputSchema.parse(input);
    const result = await searchService.search({
      query: parsed.query,
      source: parsed.source,
      limit: parsed.limit,
      page: parsed.page
    });
    const structuredContent = result as unknown as Record<string, unknown>;

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
