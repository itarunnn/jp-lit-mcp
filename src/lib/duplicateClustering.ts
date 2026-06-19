import type { SearchOutput } from "./schemas.js";

type ClusterItem = SearchOutput["items"][number];

export type DuplicateClusterReason =
  | "shared_duplicate_key"
  | "title_author_year_match"
  | "title_author_match"
  | "year_match"
  | "publisher_match"
  | "multi_source"
  | "same_source_variant";

export interface DuplicateClusterOptions {
  clusterLimit: number;
  clusterOffset: number;
  memberLimit: number;
}

export interface SearchResultReadiness {
  level: "strong" | "medium" | "weak";
  reasons: string[];
  missing: string[];
}

export type ExternalBibliographicProvider = "crossref" | "openalex";
export type ExternalBibliographicProviderStatus = "ok" | "not_found" | "skipped" | "error";
export type ExternalBibliographicMatchConfidence = "high" | "medium" | "low" | "none";

export interface DuplicateClusterEnrichment {
  matched_cache_keys: string[];
  matched_records: Array<{
    provider: ExternalBibliographicProvider;
    id: string;
    doi: string | null;
    title: string;
    match_confidence: ExternalBibliographicMatchConfidence;
    reasons: string[];
    missing: string[];
    url: string | null;
    cited_by_count: number | null;
  }>;
  identifiers: {
    doi: string | null;
  };
  match_confidence: ExternalBibliographicMatchConfidence;
  evidence_level: {
    bibliographic: "confirmed" | "partial" | "not_found" | "not_checked";
    abstract: "confirmed" | "not_checked";
    fulltext: "not_checked";
  };
  providers: Partial<Record<ExternalBibliographicProvider, {
    status: ExternalBibliographicProviderStatus;
    item_count: number;
    note: string | null;
  }>>;
  caution: string;
}

export interface DuplicateCluster {
  cluster_id: string;
  duplicate_confidence: "strong" | "medium" | "weak";
  member_count: number;
  representative: ClusterItem;
  all_members: ClusterItem[];
  members_preview: ClusterItem[];
  omitted_member_count: number;
  reasons: DuplicateClusterReason[];
  search_result_readiness: SearchResultReadiness;
  enrichment?: DuplicateClusterEnrichment;
  caution: string;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/\s+/g, "")
    .replace(/[‐-―ー]/g, "-")
    .trim();
}

function authorKey(item: ClusterItem) {
  return item.authors
    .map((author) => normalizeText(author.name))
    .filter(Boolean)
    .sort()
    .join("|");
}

function yearKey(item: ClusterItem) {
  const value = item.issued_at ?? item.issued_at_label ?? "";
  const match = value.match(/\d{4}/);
  return match?.[0] ?? "";
}

function titleAuthorYearKey(item: ClusterItem) {
  const title = normalizeText(item.title);
  const authors = authorKey(item);
  const year = yearKey(item);
  if (!title || !authors || !year) return null;
  return `${title}::${authors}::${year}`;
}

function candidateKeys(item: ClusterItem) {
  const keys: string[] = [];
  if (item.duplicate_key) keys.push(`duplicate:${item.duplicate_key}`);
  const key = titleAuthorYearKey(item);
  if (key) keys.push(`title-author-year:${key}`);
  return keys;
}

function readiness(item: ClusterItem): SearchResultReadiness {
  const reasons: string[] = [];
  const missing: string[] = [];
  if (item.title) reasons.push("title_present");
  else missing.push("title");
  if (item.authors.length > 0) reasons.push("authors_present");
  else missing.push("authors");
  if (item.issued_at || item.issued_at_label) reasons.push("issued_year_present");
  else missing.push("issued_year");
  if (item.publisher || item.journal_title) reasons.push("container_or_publisher_present");
  else missing.push("publisher_or_journal");
  if (item.url) reasons.push("url_present");
  else missing.push("url");

  const score = reasons.length;
  return {
    level: score >= 4 ? "strong" : score >= 3 ? "medium" : "weak",
    reasons,
    missing
  };
}

function sourceRank(source: ClusterItem["source"]) {
  const ranks: Record<ClusterItem["source"], number> = {
    ndl_catalog: 1,
    cinii_books: 2,
    jstage_articles: 3,
    cinii_articles: 4,
    ndl_articles: 5,
    ndl_digital: 6,
    irdb: 7,
    ndl_search: 8,
    ndl_articles_online: 9,
    nihu_bridge: 10,
    japan_search: 11,
    jdcat: 12,
    national_archives: 13,
    jacar: 14,
    kokkai_minutes: 15,
    teikoku_minutes: 16,
    nijl_articles: 17,
    kokusho: 18,
    ninjal_bibliography: 19
  };
  return ranks[source];
}

function readinessRank(level: SearchResultReadiness["level"]) {
  return { weak: 1, medium: 2, strong: 3 }[level];
}

function chooseRepresentative(items: ClusterItem[]) {
  return [...items].sort((left, right) => {
    const readinessDiff =
      readinessRank(readiness(right).level) - readinessRank(readiness(left).level);
    if (readinessDiff !== 0) return readinessDiff;
    return sourceRank(left.source) - sourceRank(right.source);
  })[0]!;
}

function buildReasons(items: ClusterItem[], key: string): DuplicateClusterReason[] {
  const reasons = new Set<DuplicateClusterReason>();
  if (key.startsWith("duplicate:")) reasons.add("shared_duplicate_key");
  if (key.startsWith("title-author-year:")) reasons.add("title_author_year_match");
  if (new Set(items.map((item) => item.source)).size > 1) reasons.add("multi_source");
  if (new Set(items.map((item) => item.source)).size === 1) reasons.add("same_source_variant");
  if (new Set(items.map((item) => yearKey(item)).filter(Boolean)).size === 1) {
    reasons.add("year_match");
  }
  if (new Set(items.map((item) => normalizeText(item.publisher)).filter(Boolean)).size === 1) {
    reasons.add("publisher_match");
  }
  return Array.from(reasons);
}

function confidence(reasons: DuplicateClusterReason[]): "strong" | "medium" | "weak" {
  if (reasons.includes("shared_duplicate_key")) return "strong";
  if (reasons.includes("title_author_year_match") && reasons.includes("multi_source")) {
    return "medium";
  }
  return "weak";
}

function itemSignature(item: ClusterItem) {
  return `${item.source}::${item.source_id}`;
}

function uniqueItems(items: ClusterItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const signature = itemSignature(item);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function buildDuplicateClusters(items: ClusterItem[], options: DuplicateClusterOptions) {
  const groups = new Map<string, ClusterItem[]>();
  for (const item of items) {
    for (const key of candidateKeys(item)) {
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
  }

  const clusterByMembers = new Map<string, DuplicateCluster>();
  for (const [key, rawGroup] of groups.entries()) {
    const group = uniqueItems(rawGroup);
    if (group.length <= 1) continue;
    const memberSignature = group.map(itemSignature).sort().join("|");
    const representative = chooseRepresentative(group);
    const reasons = buildReasons(group, key);
    const cluster: DuplicateCluster = {
      cluster_id: key,
      duplicate_confidence: confidence(reasons),
      member_count: group.length,
      representative,
      all_members: group,
      members_preview: group.slice(0, options.memberLimit),
      omitted_member_count: Math.max(0, group.length - options.memberLimit),
      reasons,
      search_result_readiness: readiness(representative),
      caution: "重複クラスタは自動削除ではありません。同一性と採否はユーザーが確認してください。"
    };
    const existing = clusterByMembers.get(memberSignature);
    if (
      !existing ||
      cluster.member_count > existing.member_count ||
      cluster.duplicate_confidence === "strong"
    ) {
      clusterByMembers.set(memberSignature, cluster);
    }
  }

  const clusters = Array.from(clusterByMembers.values()).sort((left, right) => {
    const confidenceDiff =
      readinessRank(right.duplicate_confidence) - readinessRank(left.duplicate_confidence);
    if (confidenceDiff !== 0) return confidenceDiff;
    return right.member_count - left.member_count;
  });
  const clusteredItems = new Set(
    Array.from(clusterByMembers.keys()).flatMap((signature) => signature.split("|"))
  );
  const pagedClusters = clusters.slice(options.clusterOffset, options.clusterOffset + options.clusterLimit);

  return {
    summary: {
      total_items_considered: items.length,
      cluster_count: clusters.length,
      singleton_count: items.length - clusteredItems.size,
      strong_cluster_count: clusters.filter((cluster) => cluster.duplicate_confidence === "strong").length,
      medium_cluster_count: clusters.filter((cluster) => cluster.duplicate_confidence === "medium").length,
      weak_cluster_count: clusters.filter((cluster) => cluster.duplicate_confidence === "weak").length,
      returned_cluster_count: pagedClusters.length,
      cluster_limit: options.clusterLimit,
      cluster_offset: options.clusterOffset
    },
    clusters: pagedClusters
  };
}
