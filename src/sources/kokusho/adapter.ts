import { fetchJson, UpstreamHttpError } from "../../lib/http.js";
import { networkRestrictionError } from "../archiveShared.js";
import type { KokushoAdapterOptions, SourceAdapter } from "../types.js";
import { mapKokushoRecordResponse } from "./mapRecord.js";
import { mapKokushoSearchResponse } from "./mapSearch.js";

const DEFAULT_BASE_URL = "https://kokusho.nijl.ac.jp";

function withBase(baseUrl: string, path: string) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relativePath = path.replace(/^\/+/, "");
  return new URL(relativePath, base).toString();
}

export function createKokushoAdapter(options: KokushoAdapterOptions = {}): SourceAdapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  return {
    source: "kokusho",
    async search({ query, limit }) {
      try {
        const url = new URL(withBase(baseUrl, "/api/biblioSimpleSearch"));
        url.searchParams.set("searchkbn", "simple");
        url.searchParams.set("keyword", query);

        const payload = await fetchJson<unknown>(url.toString());
        const result = mapKokushoSearchResponse(payload);
        return {
          total: result.total,
          items: result.items.slice(0, limit),
          facets: result.facets
        };
      } catch (error) {
        throw networkRestrictionError(error);
      }
    },
    async getRecord(sourceId) {
      try {
        const payload = await fetchJson<unknown>(
          withBase(baseUrl, `/api/biblioDetail/${sourceId}`)
        );
        return mapKokushoRecordResponse(payload);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }
        throw networkRestrictionError(error);
      }
    }
  };
}
