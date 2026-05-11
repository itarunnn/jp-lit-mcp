import { fetchText, UpstreamHttpError } from "../../lib/http.js";
import { networkRestrictionError } from "../archiveShared.js";
import type { NinjalBibliographyAdapterOptions, SourceAdapter } from "../types.js";
import { mapNinjalBibliographyRecordResponse } from "./mapRecord.js";
import { mapNinjalBibliographySearchResponse } from "./mapSearch.js";

const DEFAULT_BASE_URL = "https://bibdb.ninjal.ac.jp";

function withBase(baseUrl: string, path: string) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relativePath = path.replace(/^\/+/, "");
  return new URL(relativePath, base).toString();
}

function perPage(limit: number) {
  if (limit <= 20) return 20;
  if (limit <= 50) return 50;
  return 100;
}

export function createNinjalBibliographyAdapter(
  options: NinjalBibliographyAdapterOptions = {}
): SourceAdapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  return {
    source: "ninjal_bibliography",
    async search({ query, limit, page }) {
      try {
        const per = perPage(limit);
        const url = new URL(withBase(baseUrl, "/bunken/ja/result"));
        url.searchParams.set("r_freeWord_search", query);
        url.searchParams.set("lop", "and");
        url.searchParams.set("per", String(per));
        url.searchParams.set("disp", "snipet");
        if (page > 1) {
          url.searchParams.set("skip", String((page - 1) * per));
        }

        const payload = await fetchText(url.toString());
        const result = mapNinjalBibliographySearchResponse(payload.text);
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
        const payload = await fetchText(withBase(baseUrl, `/bunken/ja/article/${sourceId}`));
        return mapNinjalBibliographyRecordResponse(sourceId, payload.text);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }
        throw networkRestrictionError(error);
      }
    }
  };
}
