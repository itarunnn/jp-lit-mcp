import { fetchText, UpstreamHttpError } from "../../lib/http.js";
import type { SourceAdapter } from "../types.js";
import { networkRestrictionError } from "../archiveShared.js";
import { mapNationalArchivesRecordResponse } from "./mapRecord.js";
import { mapNationalArchivesSearchResponse } from "./mapSearch.js";

const DEFAULT_BASE_URL = "https://www.digital.archives.go.jp";

interface NationalArchivesAdapterOptions {
  baseUrl?: string;
}

function withBase(baseUrl: string, path: string) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relativePath = path.replace(/^\/+/, "");
  return new URL(relativePath, base).toString();
}

async function fetchCsvOrNull(input: string, init: RequestInit) {
  try {
    return (await fetchText(input, init)).text;
  } catch {
    return null;
  }
}

function resolveRows(limit: number) {
  if (limit <= 20) return 20;
  if (limit <= 50) return 50;
  if (limit <= 100) return 100;
  return 200;
}

export function createNationalArchivesAdapter(
  options: NationalArchivesAdapterOptions = {}
): SourceAdapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  return {
    source: "national_archives",
    async search({ query, limit, page }) {
      try {
        const url = new URL(withBase(baseUrl, "/search"));
        url.searchParams.set("kw0", query);
        url.searchParams.set("ks0", "kw_all");
        url.searchParams.set("kl0", "AND");
        url.searchParams.set("rows", String(resolveRows(limit)));
        url.searchParams.set("page", String(page));

        const payload = await fetchText(url.toString());
        const result = mapNationalArchivesSearchResponse(payload.text);
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
        const rdf = await fetchText(withBase(baseUrl, `/file/${sourceId}.rdf`));
        const csv = await fetchCsvOrNull(withBase(baseUrl, "/download"), {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({ ids: `da11/${sourceId}` }).toString()
        });

        return mapNationalArchivesRecordResponse(sourceId, rdf.text, csv);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }
        throw networkRestrictionError(error);
      }
    }
  };
}
