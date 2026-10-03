import { describeSearchParameters, ignoredSearchFields, type SafeSearchRequest } from "../../lib/searchContext.js";
import type { SourceName } from "../../lib/types.js";
import type { NdlSearchFilters, SearchParams } from "../types.js";

function normalizeSruSearchBaseUrl(baseUrl: string): string {
  return baseUrl
    .replace(/\/api\/opensearch\/?$/i, "/api/sru")
    .replace(/\/opensearch\/?$/i, "/sru");
}

function escapeCqlKeyword(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildIssuedClause(issuedFrom?: string, issuedTo?: string): string[] {
  const clauses: string[] = [];
  if (issuedFrom) {
    clauses.push(`dcterms.issued >= "${escapeCqlKeyword(issuedFrom)}"`);
  }
  if (issuedTo) {
    clauses.push(`dcterms.issued <= "${escapeCqlKeyword(issuedTo)}"`);
  }
  return clauses;
}

function normalizeNdlcFilter(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `http://id.ndl.go.jp/class/ndlc/${trimmed}`;
}

function buildNdlFilterClauses(filters?: NdlSearchFilters): string[] {
  const clauses: string[] = [];
  if (filters?.subject) {
    clauses.push(`dcterms.subject="${escapeCqlKeyword(filters.subject)}"`);
  }
  if (filters?.ndc) {
    clauses.push(`dc.subject="${escapeCqlKeyword(filters.ndc)}"`);
  }
  if (filters?.ndlc) {
    clauses.push(`dcterms.subject="${escapeCqlKeyword(normalizeNdlcFilter(filters.ndlc))}"`);
  }
  return clauses;
}

function buildCqlQuery(keyword: string, dpid?: string, issuedFrom?: string, issuedTo?: string, filters?: NdlSearchFilters): string {
  const keywordClause = `anywhere="${escapeCqlKeyword(keyword)}"`;
  const clauses = [
    ...buildIssuedClause(issuedFrom, issuedTo),
    ...buildNdlFilterClauses(filters),
    keywordClause
  ];
  if (dpid) {
    clauses.unshift(`dpid=${dpid}`);
  }
  return clauses.join(" AND ");
}

function buildSortBy(sortBy?: "title" | "creator" | "issued_date" | "created_date" | "modified_date", sortOrder?: "asc" | "desc") {
  if (!sortBy) {
    return null;
  }
  const direction = sortOrder === "desc" ? "descending" : "ascending";
  return `${sortBy}/sort.${direction}`;
}

export function buildNdlSruSearchRequest(params: SearchParams, options: {
  source: SourceName;
  searchBaseUrl: string;
  providerId?: string;
}): {
  url: URL;
  description: SafeSearchRequest;
} {
  const url = new URL(normalizeSruSearchBaseUrl(options.searchBaseUrl));
  const parameters: Record<string, string> = {
    operation: "searchRetrieve",
    version: "1.2",
    recordSchema: "dcndl",
    recordPacking: "xml",
    maximumRecords: String(params.limit),
    startRecord: String((params.page - 1) * params.limit + 1),
    query: buildCqlQuery(params.query, options.providerId, params.issued_from, params.issued_to, params.filters?.ndl)
  };
  const sort = buildSortBy(params.sort_by, params.sort_order);
  if (sort)
    parameters.sortBy = sort;
  for (const [key, value] of Object.entries(parameters))
    url.searchParams.set(key, value);
  const applied = new Set(["issued_from", "issued_to", "filters.ndl.subject", "filters.ndl.ndc", "filters.ndl.ndlc"]);
  if (sort) {
    applied.add("sort_by");
    applied.add("sort_order");
  }
  return {
    url,
    description: {
      api_kind: "ndl_sru",
      parameters: describeSearchParameters(url, "ndl_sru"),
      ignored_input_fields: ignoredSearchFields(params, applied),
      matching_mode: "metadata_conjunction",
      coverage_note: options.source === "ndl_digital" ? "NDL Searchのndl-dl提供元に限定した書誌検索。デジコレ本体全文検索とは検索範囲が異なる。" : `NDL Search SRUの書誌検索。提供元制限: ${options.providerId ?? "指定なし"}。`,
      attribution: null
    }
  };
}

export function buildNdlReferenceBooksSearchRequest(params: SearchParams, recordBaseUrl: string): {
  url: URL;
  description: SafeSearchRequest;
} {
  const url = new URL(recordBaseUrl);
  const parameters = {
    cs: "sanko",
    keyword: params.query,
    size: String(params.limit),
    from: String((params.page - 1) * params.limit)
  };
  for (const [key, value] of Object.entries(parameters))
    url.searchParams.set(key, value);
  return {
    url,
    description: {
      api_kind: "ndl_reference_books",
      parameters: describeSearchParameters(url, "ndl_reference_books"),
      ignored_input_fields: ignoredSearchFields(params, new Set()),
      matching_mode: "unknown",
      coverage_note: "NDL Searchの参考図書(cs=sanko)を対象とする検索。年代・sort・分類filterは送信しない。",
      attribution: null
    }
  };
}
