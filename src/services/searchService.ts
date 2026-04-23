import type { SourceName } from "../lib/types.js";
import { InvalidRequestError } from "../lib/errors.js";
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

      if (input.page > 1) {
        throw new InvalidRequestError(
          "Cross-source search supports only page=1 in v1"
        );
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
