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

const CROSS_SOURCE_ORDER: SourceName[] = [
  "ndl_search",
  "ndl_digital",
  "cinii_articles",
  "cinii_books"
];

function listCrossSources(registry: ReturnType<typeof createSourceRegistry>) {
  const available = new Set(registry.list());

  return CROSS_SOURCE_ORDER.filter((source) => available.has(source));
}

function roundRobinMerge<T>(groups: T[][], limit: number) {
  const queues = groups.map((items) => [...items]);
  const merged: T[] = [];

  while (merged.length < limit) {
    let progressed = false;

    for (const queue of queues) {
      const item = queue.shift();
      if (!item) {
        continue;
      }

      merged.push(item);
      progressed = true;

      if (merged.length >= limit) {
        break;
      }
    }

    if (!progressed) {
      break;
    }
  }

  return merged;
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
        listCrossSources(registry).map((source) => registry.get(source).search(input))
      );

      return {
        total: results.reduce((sum, result) => sum + result.total, 0),
        items: roundRobinMerge(
          results.map((result) => result.items),
          input.limit
        )
      };
    }
  };
}
