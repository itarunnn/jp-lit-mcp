import type { SourceName } from "../lib/types.js";
import type { SourceAdapter } from "../sources/types.js";
import { createSourceRegistry } from "./sourceRegistry.js";

interface SearchInput {
  query: string;
  source?: SourceName;
  limit: number;
  page: number;
}

export function createSearchService(adapters: SourceAdapter[]) {
  const registry = createSourceRegistry(adapters);

  return {
    async search(input: SearchInput) {
      if (input.source) {
        return registry.get(input.source).search(input);
      }

      const results = await Promise.all(
        registry.list().map((source) => registry.get(source).search(input))
      );

      return {
        total: results.reduce((sum, result) => sum + result.total, 0),
        items: results.flatMap((result) => result.items).slice(0, input.limit)
      };
    }
  };
}
