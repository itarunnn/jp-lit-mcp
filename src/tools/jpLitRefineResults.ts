import type { FileCache } from "../lib/persistence/fileCache.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { buildDuplicateClusters } from "../lib/duplicateClustering.js";
import type {
  DuplicateCluster,
  DuplicateClusterEnrichment,
  ExternalBibliographicMatchConfidence
} from "../lib/duplicateClustering.js";
import {
  enrichRecordOutputSchema,
  refineResultsInputSchema,
  refineResultsOutputSchema
} from "../lib/schemas.js";
import type { EnrichRecordOutput, RefineResultsOutput, SearchOutput } from "../lib/schemas.js";
import { normalizeDoi, normalizeTitleForMatch } from "../sources/externalWork/matching.js";

type RefineItem = SearchOutput["items"][number];
type RefineInput = ReturnType<typeof refineResultsInputSchema.parse>;
type SessionDocument = Awaited<ReturnType<SessionStore["readCurrent"]>>;
type EnrichRecordMatch = EnrichRecordOutput["matches"][number];

const CONFIDENCE_WEIGHT: Record<ExternalBibliographicMatchConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0
};

const PROVIDER_WEIGHT: Record<EnrichRecordMatch["provider"], number> = {
  crossref: 0,
  openalex: 1
};

interface EnrichmentCacheEntry {
  cacheKey: string;
  output: EnrichRecordOutput;
}

function normalizeLikelyDoi(value: string | null | undefined) {
  const doi = normalizeDoi(value);
  return doi && /^10\.\d{4,9}\//.test(doi) ? doi : null;
}

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAuthor(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function yearFromValue(value: string | null | undefined) {
  return value?.match(/\d{4}/)?.[0] ?? null;
}

function itemYear(item: RefineItem) {
  return yearFromValue(item.issued_at) ?? yearFromValue(item.issued_at_label);
}

function clusterItems(cluster: DuplicateCluster) {
  const bySignature = new Map<string, RefineItem>();
  for (const item of [cluster.representative, ...cluster.all_members]) {
    bySignature.set(`${item.source}::${item.source_id}`, item);
  }
  return Array.from(bySignature.values());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (Array.isArray(value)) {
      const nested: string | null = readFirstString(...value);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function itemDoiCandidates(item: RefineItem) {
  const metadata = asRecord(item.source_metadata);
  const identifiers = asRecord(metadata?.identifiers);
  return [
    readFirstString(metadata?.doi, metadata?.DOI),
    readFirstString(identifiers?.doi, identifiers?.DOI),
    normalizeLikelyDoi(item.url)
  ]
    .map((value) => normalizeLikelyDoi(value))
    .filter((value): value is string => Boolean(value));
}

function clusterDoiSet(cluster: DuplicateCluster) {
  return new Set(clusterItems(cluster).flatMap(itemDoiCandidates));
}

function hasAuthorOverlap(left: string[], right: string[]) {
  const rightAuthors = new Set(right.map(normalizeAuthor).filter(Boolean));
  if (rightAuthors.size === 0) {
    return false;
  }
  return left
    .map(normalizeAuthor)
    .filter(Boolean)
    .some((author) => rightAuthors.has(author));
}

function queryMatchesCluster(query: EnrichRecordOutput["query"], cluster: DuplicateCluster) {
  const queryDoi = normalizeLikelyDoi(query.doi);
  if (queryDoi && clusterDoiSet(cluster).has(queryDoi)) {
    return true;
  }

  const queryTitle = normalizeTitleForMatch(query.title);
  if (!queryTitle) {
    return false;
  }

  const items = clusterItems(cluster);
  const clusterTitles = new Set(items.map((item) => normalizeTitleForMatch(item.title)));
  if (!clusterTitles.has(queryTitle)) {
    return false;
  }

  if (query.issued_year) {
    const years = new Set(items.map(itemYear).filter(Boolean));
    if (!years.has(query.issued_year)) {
      return false;
    }
  }

  if (query.authors.length > 0) {
    const authors = items.flatMap((item) => item.authors.map((author) => author.name));
    if (!hasAuthorOverlap(query.authors, authors)) {
      return false;
    }
  }

  // Title-only enrichment is too broad for common Japanese humanities titles.
  return Boolean(query.issued_year || query.authors.length > 0);
}

function sortMatches(left: EnrichRecordMatch, right: EnrichRecordMatch) {
  const confidenceDelta =
    CONFIDENCE_WEIGHT[right.match_confidence] - CONFIDENCE_WEIGHT[left.match_confidence];
  if (confidenceDelta !== 0) return confidenceDelta;
  const providerDelta = PROVIDER_WEIGHT[left.provider] - PROVIDER_WEIGHT[right.provider];
  if (providerDelta !== 0) return providerDelta;
  return (right.cited_by_count ?? -1) - (left.cited_by_count ?? -1);
}

function bestConfidence(matches: EnrichRecordMatch[]): ExternalBibliographicMatchConfidence {
  return matches
    .map((match) => match.match_confidence)
    .sort((left, right) => CONFIDENCE_WEIGHT[right] - CONFIDENCE_WEIGHT[left])[0] ?? "none";
}

function isAcceptedExternalMatch(match: EnrichRecordMatch) {
  return match.match_confidence === "high" || match.match_confidence === "medium";
}

function bibliographicEvidenceLevel(
  confidence: ExternalBibliographicMatchConfidence,
  hasMatchedCache: boolean
): DuplicateClusterEnrichment["evidence_level"]["bibliographic"] {
  if (confidence === "high" || confidence === "medium") return "confirmed";
  if (confidence === "low") return "partial";
  return hasMatchedCache ? "not_found" : "not_checked";
}

function buildClusterEnrichment(
  cluster: DuplicateCluster,
  enrichmentEntries: EnrichmentCacheEntry[]
): DuplicateClusterEnrichment | null {
  const matchedEntries = enrichmentEntries.filter((entry) =>
    queryMatchesCluster(entry.output.query, cluster)
  );
  if (matchedEntries.length === 0) {
    return null;
  }

  const matches = matchedEntries
    .flatMap((entry) => entry.output.matches)
    .filter(isAcceptedExternalMatch)
    .sort(sortMatches);
  const confidence = bestConfidence(matches);
  const doi =
    matches.map((match) => normalizeLikelyDoi(match.doi)).find(Boolean) ?? null;
  const providers: DuplicateClusterEnrichment["providers"] = {};
  for (const entry of matchedEntries) {
    for (const provider of ["crossref", "openalex"] as const) {
      const summary = entry.output.providers[provider];
      if (summary) {
        providers[provider] = summary;
      }
    }
  }

  return {
    matched_cache_keys: matchedEntries.map((entry) => entry.cacheKey),
    matched_records: matches.map((match) => ({
      provider: match.provider,
      id: match.id,
      doi: normalizeLikelyDoi(match.doi),
      title: match.title,
      match_confidence: match.match_confidence,
      reasons: match.reasons,
      missing: match.missing,
      url: match.url,
      cited_by_count: match.cited_by_count
    })),
    identifiers: { doi },
    match_confidence: confidence,
    evidence_level: {
      bibliographic: bibliographicEvidenceLevel(confidence, true),
      abstract: "not_checked",
      fulltext: "not_checked"
    },
    providers,
    caution: matchedEntries[0]?.output.caution ?? "外部書誌照合は本文到達性や重要度を保証しません。"
  };
}

function enrichClusters(
  clusters: DuplicateCluster[],
  enrichmentEntries: EnrichmentCacheEntry[]
) {
  if (enrichmentEntries.length === 0) {
    return clusters;
  }

  return clusters.map((cluster) => {
    const enrichment = buildClusterEnrichment(cluster, enrichmentEntries);
    return enrichment ? { ...cluster, enrichment } : cluster;
  });
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

function collectEnrichmentCacheKeys(session: SessionDocument) {
  return Array.from(
    new Set(
      session.entries
        .filter((entry) => entry.tool === "jp_lit_enrich_record")
        .map((entry) => entry.cache_key)
    )
  );
}

async function resolveEnrichmentCacheKeys(input: RefineInput, sessions: SessionStore) {
  if (input.enrichment_cache_keys && input.enrichment_cache_keys.length > 0) {
    return {
      explicit: true,
      cacheKeys: Array.from(new Set(input.enrichment_cache_keys))
    };
  }

  const session = input.session_id
    ? await sessions.readById(input.session_id)
    : await sessions.readCurrent();

  return {
    explicit: false,
    cacheKeys: collectEnrichmentCacheKeys(session)
  };
}

async function readEnrichmentEntries(
  input: RefineInput,
  cache: FileCache,
  sessions: SessionStore
) {
  if (!input.include_enrichment) {
    return [] as EnrichmentCacheEntry[];
  }

  const { explicit, cacheKeys } = await resolveEnrichmentCacheKeys(input, sessions);
  const entries: EnrichmentCacheEntry[] = [];
  for (const cacheKey of cacheKeys) {
    const cached = await cache.read<EnrichRecordOutput>("jp_lit_enrich_record", cacheKey);
    if (!cached) {
      if (explicit) {
        throw new Error(`enrichment_cache_key=${cacheKey} のキャッシュが見つかりません`);
      }
      continue;
    }
    entries.push({
      cacheKey,
      output: enrichRecordOutputSchema.parse(cached.structured_content)
    });
  }

  return entries;
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
    const enrichmentEntries = await readEnrichmentEntries(parsed, cache, sessions);
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
    const clusters = clusterOutput
      ? enrichClusters(clusterOutput.clusters, enrichmentEntries)
      : undefined;

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
            clusters
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
