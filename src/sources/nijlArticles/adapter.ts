import { fetchText, UpstreamHttpError } from "../../lib/http.js";
import { networkRestrictionError } from "../archiveShared.js";
import type { NijlArticlesAdapterOptions, SourceAdapter } from "../types.js";
import { mapNijlArticlesRecordResponse } from "./mapRecord.js";
import { mapNijlArticlesSearchResponse } from "./mapSearch.js";

const DEFAULT_BASE_URL = "https://ronbun.nijl.ac.jp";

function withBase(baseUrl: string, path: string) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relativePath = path.replace(/^\/+/, "");
  return new URL(relativePath, base).toString();
}

export function createNijlArticlesAdapter(
  options: NijlArticlesAdapterOptions = {}
): SourceAdapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  return {
    source: "nijl_articles",
    async search({ query, limit, page }) {
      try {
        const url = new URL(withBase(baseUrl, "/search/books"));
        url.searchParams.set("q", query);
        url.searchParams.set("page", String(page));

        const payload = await fetchText(url.toString());
        const result = mapNijlArticlesSearchResponse(payload.text);
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
        const payload = await fetchText(withBase(baseUrl, `/kokubun/${sourceId}`));
        return mapNijlArticlesRecordResponse(sourceId, payload.text);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }
        throw networkRestrictionError(error);
      }
    }
  };
}
