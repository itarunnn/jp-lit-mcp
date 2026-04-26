import type { SourceName } from "../lib/types.js";
import { InvalidRequestError } from "../lib/errors.js";
import type { SourceAdapter } from "../sources/types.js";
import { createSourceRegistry } from "./sourceRegistry.js";
import type { RelatedSearchRecord, SearchItem } from "../lib/types.js";

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

function normalizeText(value: string | null) {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[‐-―ー]/g, "-");
}

function normalizeAuthorNames(item: SearchItem) {
  return item.authors
    .map((author) => normalizeText(author.name))
    .filter(Boolean)
    .sort()
    .join("|");
}

function buildDuplicateKey(item: SearchItem) {
  const title = normalizeText(item.title);
  if (!title) {
    return null;
  }

  const authors = normalizeAuthorNames(item);
  const issuedAt = item.issued_at ?? item.issued_at_label ?? "";
  const publisher = normalizeText(item.publisher);

  return [title, authors, issuedAt, publisher].join("::");
}

function annotateDuplicateCandidates(items: SearchItem[]) {
  const groups = new Map<
    string,
    {
      items: SearchItem[];
      sources: Set<SourceName>;
    }
  >();

  for (const item of items) {
    const key = buildDuplicateKey(item);
    if (!key) {
      continue;
    }

    const entry = groups.get(key) ?? {
      items: [],
      sources: new Set<SourceName>()
    };

    entry.items.push(item);
    entry.sources.add(item.source);
    groups.set(key, entry);
  }

  return items.map((item) => {
    const key = buildDuplicateKey(item);
    const group = key ? groups.get(key) : null;

    if (!key || !group || group.items.length < 2 || group.sources.size < 2) {
      return {
        ...item,
        duplicate_key: null,
        duplicate_count: 1,
        related_records: []
      };
    }

    const relatedRecords: RelatedSearchRecord[] = group.items
      .filter(
        (candidate) =>
          !(
            candidate.source === item.source &&
            candidate.source_id === item.source_id
          )
      )
      .map((candidate) => ({
        source: candidate.source,
        source_id: candidate.source_id,
        title: candidate.title,
        url: candidate.url
      }));

    return {
      ...item,
      duplicate_key: key,
      duplicate_count: group.items.length,
      related_records: relatedRecords
    };
  });
}

function withDefaultDuplicateInfo(items: SearchItem[]) {
  return items.map((item) => ({
    ...item,
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  }));
}

export function createSearchService(adapters: SourceAdapter[]) {
  const registry = createSourceRegistry(adapters);

  return {
    async search(input: SearchInput) {
      if (input.source) {
        const result = await registry.get(input.source).search(input);

        return {
          total: result.total,
          items: withDefaultDuplicateInfo(result.items)
        };
      }

      if (input.page > 1) {
        throw new InvalidRequestError(
          "Cross-source search supports only page=1 in v1"
        );
      }

      const results = await Promise.all(
        listCrossSources(registry).map((source) => registry.get(source).search(input))
      );

      const mergedItems = roundRobinMerge(
        results.map((result) => result.items),
        input.limit
      );

      return {
        total: results.reduce((sum, result) => sum + result.total, 0),
        items: annotateDuplicateCandidates(mergedItems)
      };
    }
  };
}
