import type { SearchFacets, SourceName } from "../lib/types.js";
import { InvalidRequestError } from "../lib/errors.js";
import type {
  IrdbSearchFilters,
  JdcatSearchFilters,
  NihuBridgeSearchFilters,
  SourceAdapter
} from "../sources/types.js";
import { createSourceRegistry } from "./sourceRegistry.js";
import type { RelatedSearchRecord, SearchItem } from "../lib/types.js";

const DEFAULT_LIMIT_CROSS = 48;
const DEFAULT_LIMIT_SINGLE = 50;

interface SearchInput {
  query: string;
  source?: SourceName;
  limit?: number;
  page: number;
  sort_by?: "title" | "creator" | "issued_date" | "created_date" | "modified_date";
  sort_order?: "asc" | "desc";
  issued_from?: string;
  issued_to?: string;
  filters?: {
    irdb?: IrdbSearchFilters;
    nihu_bridge?: NihuBridgeSearchFilters;
    jdcat?: JdcatSearchFilters;
  };
}

const CROSS_SOURCE_FETCH_SIZE = 30;

const CROSS_SOURCE_ORDER: SourceName[] = [
  "ndl_catalog",
  "ndl_digital",
  "ndl_articles",
  "ndl_articles_online",
  "cinii_articles",
  "jstage_articles",
  "cinii_books",
  "nihu_bridge"
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

function mergeFacetGroup(
  target: Record<string, number>,
  source: Record<string, number> | undefined
) {
  if (!source) {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function mergeFacets(results: Array<{ facets?: SearchFacets }>): SearchFacets | undefined {
  const merged: SearchFacets = {
    providers: {},
    ndc: {},
    issued_years: {}
  };

  let hasAnyFacet = false;

  for (const result of results) {
    if (!result.facets) {
      continue;
    }

    hasAnyFacet = true;
    mergeFacetGroup(merged.providers, result.facets.providers);
    mergeFacetGroup(merged.ndc, result.facets.ndc);
    mergeFacetGroup(merged.issued_years, result.facets.issued_years);
  }

  return hasAnyFacet ? merged : undefined;
}

export function createSearchService(adapters: SourceAdapter[]) {
  const registry = createSourceRegistry(adapters);

  return {
    async search(input: SearchInput) {
      const effectiveLimit = input.limit ?? (input.source ? DEFAULT_LIMIT_SINGLE : DEFAULT_LIMIT_CROSS);

      if (input.source) {
        const result = await registry.get(input.source).search({ ...input, limit: effectiveLimit });

        return {
          total: result.total,
          items: withDefaultDuplicateInfo(result.items),
          facets: result.facets
        };
      }

      if (input.page > 1) {
        throw new InvalidRequestError(
          "Cross-source search supports only page=1 in v1"
        );
      }

      const results = await Promise.all(
        listCrossSources(registry).map((source) =>
          registry.get(source).search({ ...input, limit: CROSS_SOURCE_FETCH_SIZE })
        )
      );

      const mergedItems = roundRobinMerge(
        results.map((result) => result.items),
        effectiveLimit
      );

      return {
        total: results.reduce((sum, result) => sum + result.total, 0),
        items: annotateDuplicateCandidates(mergedItems),
        facets: mergeFacets(results)
      };
    }
  };
}
