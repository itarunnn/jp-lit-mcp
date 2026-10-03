import type { SearchSourceContext } from "../lib/searchContext.js";
import type { SearchParams } from "../sources/types.js";
import type {
  CiniiSearchFilters,
  SearchFacets,
  SourceName,
  SourceSearchError
} from "../lib/types.js";
import { CrossSourceSearchError, InvalidRequestError } from "../lib/errors.js";
import {
  UnsupportedPayloadError,
  UpstreamHttpError,
  UpstreamTimeoutError
} from "../lib/http.js";
import type {
  IrdbSearchFilters,
  JdcatSearchFilters,
  NdlSearchFilters,
  NihuBridgeSearchFilters,
  SourceAdapter,
  SearchResult
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
    ndl?: NdlSearchFilters;
    cinii?: CiniiSearchFilters;
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

function classifySourceError(error: unknown): SourceSearchError["category"] {
  if (error instanceof UpstreamTimeoutError) {
    return "timeout";
  }
  if (error instanceof UpstreamHttpError) {
    return "http";
  }
  if (error instanceof UnsupportedPayloadError) {
    return "invalid_payload";
  }
  return "unknown";
}

function sourceErrorMessage(category: SourceSearchError["category"]) {
  switch (category) {
    case "timeout":
      return "上流 source の応答がタイムアウトしました。";
    case "http":
      return "上流 source へのリクエストに失敗しました。";
    case "invalid_payload":
      return "上流 source の応答形式を処理できませんでした。";
    case "unknown":
      return "上流 source の検索中に予期しないエラーが発生しました。";
  }
}

function toSourceSearchError(
  source: SourceName,
  error: unknown
): SourceSearchError {
  const category = classifySourceError(error);

  return {
    source,
    category,
    message: sourceErrorMessage(category),
    hint: `source="${source}" を指定して再試行してください。`
  };
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

function describeSource(adapter: SourceAdapter, params: SearchParams, result: SearchResult | null, error?: unknown): SearchSourceContext {
  const failed = result === null || result.summary?.outcome === "failed";
  return {source: adapter.source, outcome: failed ? "failed" : result.summary?.outcome ?? "unknown", request: adapter.describeSearch?.(params) ?? null,
    reported_total: result?.summary?.reported_total ?? null, total_basis: result?.summary?.total_basis ?? "unknown",
    fetched_count: result && !failed ? result.items.length : null, included_count: 0,
    error_category: failed ? (result ? "unknown" : classifySourceError(error)) : null};
}

export function createSearchService(adapters: SourceAdapter[]) {
  const registry = createSourceRegistry(adapters);

  return {
    async search(input: SearchInput) {
      const effectiveLimit = input.limit ?? (input.source ? DEFAULT_LIMIT_SINGLE : DEFAULT_LIMIT_CROSS);

      if (input.source) {
        const adapter = registry.get(input.source);
        const params = {...input, limit: effectiveLimit};
        const result = await adapter.search(params);
        const description = describeSource(adapter, params, result);
        description.included_count = result.items.length;

        return {
          aggregation: "single" as const,
          fetch_limit_per_source: effectiveLimit,
          total_semantics: description.total_basis,
          sources: [description],
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

      const sources = listCrossSources(registry);
      const settledResults = await Promise.allSettled(
        sources.map((source) =>
          registry.get(source).search({ ...input, limit: CROSS_SOURCE_FETCH_SIZE })
        )
      );
      const results: SearchResult[] = [];
      const sourceErrors: SourceSearchError[] = [];

      settledResults.forEach((settledResult, index) => {
        if (settledResult.status === "fulfilled") {
          results.push(settledResult.value);
          return;
        }

        sourceErrors.push(
          toSourceSearchError(sources[index] as SourceName, settledResult.reason)
        );
      });

      if (sources.length > 0 && results.length === 0) {
        throw new CrossSourceSearchError(sourceErrors);
      }

      const mergedItems = roundRobinMerge(
        results.map((result) => result.items),
        effectiveLimit
      );

      const descriptions = settledResults.map((settled, index) => {
        const source = sources[index]!;
        const description = describeSource(registry.get(source), {...input, limit: CROSS_SOURCE_FETCH_SIZE}, settled.status === "fulfilled" ? settled.value : null, settled.status === "rejected" ? settled.reason : undefined);
        description.included_count = mergedItems.filter(item => item.source === source).length;
        return description;
      });
      return {
        aggregation: "round_robin" as const,
        fetch_limit_per_source: CROSS_SOURCE_FETCH_SIZE,
        total_semantics: "sum_of_source_totals" as const,
        sources: descriptions,
        total: results.reduce((sum, result) => sum + result.total, 0),
        items: annotateDuplicateCandidates(mergedItems),
        facets: mergeFacets(results),
        ...(sourceErrors.length > 0 ? { source_errors: sourceErrors } : {})
      };
    }
  };
}
