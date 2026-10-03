import { describeSearchParameters, ignoredSearchFields, type SafeSearchRequest } from "../../lib/searchContext.js";
import type { SearchParams } from "../types.js";

export function buildJstageSearchRequest(params: SearchParams, searchBaseUrl: string): {
  url: URL;
  description: SafeSearchRequest;
} {
  const url = new URL(searchBaseUrl);
  const parameters: Record<string, string> = {
    service: "3",
    article: params.query,
    count: String(params.limit),
    start: String((params.page - 1) * params.limit + 1)
  };
  const applied = new Set<string>();
  if (params.issued_from) {
    parameters.pubyearfrom = params.issued_from;
    applied.add("issued_from");
  }
  if (params.issued_to) {
    parameters.pubyearto = params.issued_to;
    applied.add("issued_to");
  }
  for (const [key, value] of Object.entries(parameters))
    url.searchParams.set(key, value);
  return {
    url,
    description: {
      api_kind: "jstage_webapi",
      parameters: describeSearchParameters(url, "jstage_webapi"),
      ignored_input_fields: ignoredSearchFields(params, applied),
      matching_mode: "unknown",
      coverage_note: "J-STAGE WebAPI service=3のarticle検索。照合範囲は提供元に依存する。",
      attribution: null
    }
  };
}
