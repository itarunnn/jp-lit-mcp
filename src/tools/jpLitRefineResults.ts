import type { FileCache } from "../lib/persistence/fileCache.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { buildDuplicateClusters } from "../lib/duplicateClustering.js";
import { refineResultsInputSchema, refineResultsOutputSchema } from "../lib/schemas.js";
import type { RefineResultsOutput, SearchOutput } from "../lib/schemas.js";

type RefineItem = SearchOutput["items"][number];
type RefineInput = ReturnType<typeof refineResultsInputSchema.parse>;

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveLatestCacheKey(
  entries: Awaited<ReturnType<SessionStore["readCurrent"]>>["entries"],
) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.tool === "jp_lit_search") {
      return entry.cache_key;
    }
  }

  throw new Error("現在セッションに jp_lit_search の結果がありません");
}

function findCacheKeyInEntries(
  entries: Awaited<ReturnType<SessionStore["readCurrent"]>>["entries"],
  cacheKey: string
) {
  return entries.some(
    (entry) => entry.tool === "jp_lit_search" && entry.cache_key === cacheKey
  );
}

async function resolveBaseCacheKeys(input: RefineInput, sessions: SessionStore) {
  if (input.cache_keys && input.cache_keys.length > 0) {
    return Array.from(new Set(input.cache_keys));
  }

  if (input.session_id) {
    const session = await sessions.readById(input.session_id);
    const keys = Array.from(
      new Set(
        session.entries
          .filter((entry) => entry.tool === "jp_lit_search")
          .map((entry) => entry.cache_key)
      )
    );
    if (keys.length === 0) {
      throw new Error(`session_id=${input.session_id} に jp_lit_search の結果がありません`);
    }
    return keys;
  }

  if (input.cache_key) {
    return [input.cache_key];
  }

  const current = await sessions.readCurrent();
  return [resolveLatestCacheKey(current.entries)];
}

function buildItemKey(item: RefineItem, keyBy: RefineInput["key_by"]) {
  if (keyBy === "source_record") {
    return `${item.source}::${item.source_id}`;
  }
  if (keyBy === "duplicate_key") {
    return item.duplicate_key ?? `${item.source}::${item.source_id}`;
  }

  const title = normalizeText(item.title);
  const authors = item.authors
    .map((author) => normalizeText(author.name))
    .filter(Boolean)
    .sort()
    .join("|");
  const issued = item.issued_at ?? item.issued_at_label ?? "";
  return `${title}::${authors}::${issued}`;
}

function combineItems(
  groups: RefineItem[][],
  input: RefineInput
) {
  if (groups.length === 0) {
    return [] as RefineItem[];
  }

  const keyBy = input.key_by;
  if (input.combine === "union") {
    const merged: RefineItem[] = [];
    const seen = new Set<string>();
    for (const group of groups) {
      for (const item of group) {
        const key = buildItemKey(item, keyBy);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        merged.push(item);
      }
    }
    return merged;
  }

  if (input.combine === "intersection") {
    const first = groups[0] ?? [];
    const restSets = groups.slice(1).map((group) =>
      new Set(group.map((item) => buildItemKey(item, keyBy)))
    );
    const used = new Set<string>();
    return first.filter((item) => {
      const key = buildItemKey(item, keyBy);
      if (used.has(key)) {
        return false;
      }
      const included = restSets.every((set) => set.has(key));
      if (included) {
        used.add(key);
      }
      return included;
    });
  }

  const first = groups[0] ?? [];
  const minusSet = new Set(
    groups
      .slice(1)
      .flatMap((group) => group.map((item) => buildItemKey(item, keyBy)))
  );
  const used = new Set<string>();
  return first.filter((item) => {
    const key = buildItemKey(item, keyBy);
    if (used.has(key)) {
      return false;
    }
    used.add(key);
    return !minusSet.has(key);
  });
}

function applyFilters(items: RefineItem[], input: ReturnType<typeof refineResultsInputSchema.parse>) {
  const filters = input.filters;
  if (!filters) {
    return items;
  }

  const normalizedTitle = filters.title_contains
    ? normalizeText(filters.title_contains)
    : null;
  const normalizedAuthor = filters.author_contains
    ? normalizeText(filters.author_contains)
    : null;

  return items.filter((item) => {
    if (filters.source && item.source !== filters.source) {
      return false;
    }
    if (filters.online !== undefined && item.availability.online !== filters.online) {
      return false;
    }
    if (
      filters.digital_collection !== undefined &&
      item.availability.digital_collection !== filters.digital_collection
    ) {
      return false;
    }
    if (filters.issued_from && (!item.issued_at || item.issued_at < filters.issued_from)) {
      return false;
    }
    if (filters.issued_to && (!item.issued_at || item.issued_at > filters.issued_to)) {
      return false;
    }
    if (normalizedTitle && !normalizeText(item.title).includes(normalizedTitle)) {
      return false;
    }
    if (
      normalizedAuthor &&
      !item.authors.some((author) =>
        normalizeText(author.name).includes(normalizedAuthor)
      )
    ) {
      return false;
    }

    return true;
  });
}

function applySort(items: RefineItem[], input: ReturnType<typeof refineResultsInputSchema.parse>) {
  if (!input.sort_by) {
    return items;
  }

  const direction = input.sort_order === "desc" ? -1 : 1;
  const sorted = [...items];

  sorted.sort((left, right) => {
    if (input.sort_by === "title") {
      return (
        left.title.localeCompare(right.title, "ja-JP", { sensitivity: "base" }) * direction
      );
    }

    const leftIssued = left.issued_at ?? "9999-99-99";
    const rightIssued = right.issued_at ?? "9999-99-99";

    if (leftIssued === rightIssued) {
      return (
        left.title.localeCompare(right.title, "ja-JP", { sensitivity: "base" }) * direction
      );
    }

    return leftIssued.localeCompare(rightIssued) * direction;
  });

  return sorted;
}

export function createJpLitRefineResultsTool(
  cache: FileCache,
  sessions: SessionStore
) {
  return async (input: unknown) => {
    const parsed = refineResultsInputSchema.parse(input);
    const cacheKeys = await resolveBaseCacheKeys(parsed, sessions);
    const cachedResults = await Promise.all(
      cacheKeys.map(async (cacheKey) => {
        const cached = await cache.read<SearchOutput>("jp_lit_search", cacheKey);
        if (!cached) {
          throw new Error(`cache_key=${cacheKey} のキャッシュが見つかりません`);
        }
        return {
          cache_key: cacheKey,
          items: cached.structured_content.items
        };
      })
    );
    const combinedItems = combineItems(
      cachedResults.map((result) => result.items),
      parsed
    );
    const filteredItems = applyFilters(combinedItems, parsed);
    const sortedItems = applySort(filteredItems, parsed);
    const slicedItems = sortedItems.slice(parsed.offset, parsed.offset + parsed.limit);
    const rawUnionClusterCandidates = applySort(
      applyFilters(cachedResults.flatMap((result) => result.items), parsed),
      parsed
    );
    const clusterCandidates =
      parsed.combine === "union" ? rawUnionClusterCandidates : sortedItems;
    const clusterOutput = parsed.include_duplicate_clusters
      ? buildDuplicateClusters(clusterCandidates, {
          clusterLimit: parsed.cluster_limit,
          clusterOffset: parsed.cluster_offset,
          memberLimit: parsed.cluster_member_limit
        })
      : null;

    const structuredContent: RefineResultsOutput = refineResultsOutputSchema.parse({
      base_cache_key: cacheKeys[0],
      base_cache_keys: cacheKeys,
      combine: parsed.combine,
      key_by: parsed.key_by,
      totals_by_base: cachedResults.map((entry) => ({
        cache_key: entry.cache_key,
        total: entry.items.length
      })),
      total_before: combinedItems.length,
      total_after: sortedItems.length,
      limit: parsed.limit,
      offset: parsed.offset,
      items: slicedItems,
      ...(clusterOutput
        ? {
            cluster_summary: clusterOutput.summary,
            clusters: clusterOutput.clusters
          }
        : {})
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
