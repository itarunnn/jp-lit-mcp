import { describeSearchParameters, ignoredSearchFields, type SafeSearchRequest } from "../../lib/searchContext.js";
import type { SearchParams } from "../types.js";

export function buildCiniiSearchRequest(params: SearchParams, options: {
  source: "cinii_articles" | "cinii_books" | "cinii_dissertations";
  searchType: "articles" | "books" | "dissertations";
  searchBaseUrl: string;
  appId?: string;
}): {
  url: URL;
  description: SafeSearchRequest;
} {
  const url = new URL(options.searchBaseUrl);
  const parameters: Record<string, string> = {
    q: params.query,
    count: String(params.limit),
    start: String((params.page - 1) * params.limit + 1),
    format: "json"
  };
  const applied = new Set<string>();
  if (params.issued_from) {
    parameters.from = params.issued_from;
    applied.add("issued_from");
  }
  if (params.issued_to) {
    parameters.until = params.issued_to;
    applied.add("issued_to");
  }
  if (options.searchType === "books" && params.filters?.cinii?.category) {
    parameters.category = params.filters.cinii.category;
    applied.add("filters.cinii.category");
  }
  if (params.sort_by === "issued_date") {
    parameters.sortorder = options.searchType === "books" ? (params.sort_order === "asc" ? "2" : "3") : (params.sort_order === "asc" ? "1" : "0");
    applied.add("sort_by");
    applied.add("sort_order");
  }
  for (const [key, value] of Object.entries(parameters))
    url.searchParams.set(key, value);
  if (options.appId)
    url.searchParams.set("appid", options.appId);
  return {
    url,
    description: {
      api_kind: "cinii_opensearch",
      parameters: describeSearchParameters(url, "cinii_opensearch"),
      ignored_input_fields: ignoredSearchFields(params, applied),
      matching_mode: "unknown",
      coverage_note: `CiNii Research ${options.searchType}のOpenSearch検索。収録範囲と照合方式は提供元に依存する。`,
      attribution: null
    }
  };
}
