import type { SourceName, SourceSearchError } from "./types.js";

export type QueryScript = "latin" | "kana" | "han" | "han_kana" | "mixed" | "other";

export type TotalBasis = "source_reported" | "returned_count" | "unknown";

export interface SafeSearchRequest {
  api_kind: "cinii_opensearch" | "ndl_sru" | "ndl_reference_books" | "jstage_webapi";
  parameters: Record<string, string | number | boolean | string[]>;
  ignored_input_fields: string[];
  matching_mode: "metadata_conjunction" | "unknown";
  coverage_note: string;
  attribution: string | null;
}

export interface SearchResultSummary {
  outcome: "completed" | "failed";
  reported_total: number | null;
  total_basis: TotalBasis;
}

export interface SearchSourceContext {
  source: SourceName;
  outcome: "completed" | "failed" | "unknown";
  request: SafeSearchRequest | null;
  reported_total: number | null;
  total_basis: TotalBasis;
  fetched_count: number | null;
  included_count: number;
  error_category: SourceSearchError["category"] | null;
}

export interface SearchContext {
  schema_version: 1;
  producer_version: string;
  requested_query: string;
  query_script: QueryScript;
  aggregation: "single" | "round_robin";
  fetch_limit_per_source: number | null;
  total_semantics: "source_reported" | "returned_count" | "sum_of_source_totals" | "unknown";
  sources: SearchSourceContext[];
}

export function detectQueryScript(query: string): QueryScript {
  let latin = false, kana = false, han = false;
  for (const character of query) {
    latin ||= /[a-z]/i.test(character);
    kana ||= /[\u3040-\u30ff\uff66-\uff9d]/u.test(character);
    han ||= /\p{Script=Han}/u.test(character);
  }
  if (latin && (kana || han))
    return "mixed";
  if (latin)
    return "latin";
  if (han && kana)
    return "han_kana";
  if (han)
    return "han";
  if (kana)
    return "kana";
  return "other";
}

export function summarizeSearchTotal(raw: unknown, outcome: "completed" | "failed" = "completed"): SearchResultSummary {
  const value = typeof raw === "number" || (typeof raw === "string" && /^\d+$/.test(raw.trim())) ? Number(raw) : null;
  const total = outcome === "completed" && value !== null && Number.isSafeInteger(value) && value >= 0 ? value : null;
  return {
    outcome,
    reported_total: total,
    total_basis: total !== null ? "source_reported" : outcome === "failed" ? "unknown" : "returned_count"
  };
}
/** 指定されたfilterのうち適用しないfield名だけを列挙する。値は記録しない。 */

export function ignoredSearchFields(params: import("../sources/types.js").SearchParams, applied: ReadonlySet<string>): string[] {
  const fields = ["sort_by", "sort_order", "issued_from", "issued_to"].filter(key => (params as unknown as Record<string, unknown>)[key] !== undefined);
  for (const [group, values] of Object.entries(params.filters ?? {})) {
    for (const key of Object.keys(values ?? {}))
      fields.push(`filters.${group}.${key}`);
  }
  return fields.filter(key => !applied.has(key));
}

export const SEARCH_PARAMETER_KEYS = {
  cinii_opensearch: ["q", "count", "start", "format", "sortorder", "from", "until", "category"],
  jstage_webapi: ["service", "article", "count", "start", "pubyearfrom", "pubyearto"],
  ndl_sru: ["operation", "version", "recordSchema", "recordPacking", "maximumRecords", "startRecord", "query", "sortBy"],
  ndl_reference_books: ["cs", "keyword", "size", "from"]
} as const;

export function describeSearchParameters(url: URL, apiKind: SafeSearchRequest["api_kind"]): SafeSearchRequest["parameters"] {
  const parameters: SafeSearchRequest["parameters"] = {};
  for (const key of SEARCH_PARAMETER_KEYS[apiKind]) {
    const values = url.searchParams.getAll(key);
    if (values.length)
      parameters[key] = values.length === 1 ? values[0]! : values;
  }
  return parameters;
}
