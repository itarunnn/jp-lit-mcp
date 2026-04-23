import {
  UnsupportedPayloadError,
  UpstreamHttpError,
  fetchJson
} from "../../lib/http.js";
import type { SourceAdapter } from "../types.js";
import { mapNdlSearchRecordResponse } from "./mapRecord.js";
import { mapNdlSearchSearchResponse } from "./mapSearch.js";

const DEFAULT_SEARCH_BASE_URL = "https://ndlsearch.ndl.go.jp/api/opensearch";
const DEFAULT_RECORD_BASE_URL =
  "https://ndlsearch.ndl.go.jp/api/bib/external/search";

interface NdlSearchAdapterOptions {
  searchBaseUrl?: string;
  recordBaseUrl?: string;
}

export function createNdlSearchAdapter(
  options: NdlSearchAdapterOptions = {}
): SourceAdapter {
  const searchBaseUrl = options.searchBaseUrl ?? DEFAULT_SEARCH_BASE_URL;
  const recordBaseUrl = options.recordBaseUrl ?? DEFAULT_RECORD_BASE_URL;

  return {
    source: "ndl_search",
    async search({ query, limit, page }) {
      const url = new URL(searchBaseUrl);
      url.searchParams.set("any", query);
      url.searchParams.set("cnt", String(limit));
      url.searchParams.set("idx", String((page - 1) * limit + 1));

      let payload: unknown;
      try {
        payload = await fetchJson<unknown>(url.toString());
      } catch (error) {
        if (error instanceof UnsupportedPayloadError) {
          throw new UnsupportedPayloadError(
            "NDL Search OpenSearch XML parsing is not implemented in Task 5. search() currently expects a JSON-compatible OpenSearch representation."
          );
        }

        throw error;
      }

      return mapNdlSearchSearchResponse(payload);
    },
    async getRecord(sourceId) {
      const url = new URL(recordBaseUrl);
      url.searchParams.set("cs", "bib");
      url.searchParams.set("f-token", sourceId);

      try {
        const payload = await fetchJson<unknown>(url.toString());

        return mapNdlSearchRecordResponse(payload);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    }
  };
}
