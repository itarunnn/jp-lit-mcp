import { fetchJson, UpstreamHttpError } from "../../lib/http.js";
import type { SourceAdapter } from "../types.js";
import { mapJapanSearchRecordResponse } from "./mapRecord.js";
import { mapJapanSearchSearchResponse } from "./mapSearch.js";

const DEFAULT_SEARCH_BASE_URL = "https://jpsearch.go.jp/api/item/search/jps-cross";
const DEFAULT_ITEM_BASE_URL = "https://jpsearch.go.jp/api/item";

interface JapanSearchAdapterOptions {
  searchBaseUrl?: string;
  itemBaseUrl?: string;
}

export function createJapanSearchAdapter(
  options: JapanSearchAdapterOptions = {}
): SourceAdapter {
  const searchBaseUrl = options.searchBaseUrl ?? DEFAULT_SEARCH_BASE_URL;
  const itemBaseUrl = options.itemBaseUrl ?? DEFAULT_ITEM_BASE_URL;

  return {
    source: "japan_search",
    async search({ query, limit, page }) {
      const url = new URL(searchBaseUrl);

      url.searchParams.set("keyword", query);
      url.searchParams.set("size", String(limit));
      url.searchParams.set("from", String((page - 1) * limit));

      return mapJapanSearchSearchResponse(await fetchJson(url.toString()));
    },
    async getRecord(sourceId) {
      const url = new URL(`${itemBaseUrl.replace(/\/+$/, "")}/${encodeURIComponent(sourceId)}`);

      try {
        return mapJapanSearchRecordResponse(await fetchJson(url.toString()));
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    }
  };
}

