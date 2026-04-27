import { fetchText, UpstreamHttpError } from "../../lib/http.js";
import type { SourceAdapter } from "../types.js";
import { mapIrdbRecordResponse } from "./mapRecord.js";
import { mapIrdbSearchResponse } from "./mapSearch.js";

const DEFAULT_SEARCH_BASE_URL = "https://irdb.nii.ac.jp/opensearch/search";
const DEFAULT_DETAIL_BASE_URL = "https://irdb.nii.ac.jp";

interface IrdbAdapterOptions {
  searchBaseUrl?: string;
  detailBaseUrl?: string;
}

function normalizeSourceUrl(baseUrl: string, sourceId: string) {
  try {
    return new URL(sourceId, baseUrl).toString();
  } catch {
    return sourceId;
  }
}

function resolveCount(limit: number) {
  if (limit <= 20) {
    return 20;
  }

  if (limit <= 50) {
    return 50;
  }

  return 100;
}

export function createIrdbAdapter(
  options: IrdbAdapterOptions = {}
): SourceAdapter {
  const searchBaseUrl = options.searchBaseUrl ?? DEFAULT_SEARCH_BASE_URL;
  const detailBaseUrl = options.detailBaseUrl ?? DEFAULT_DETAIL_BASE_URL;

  return {
    source: "irdb",
    async search({ query, limit, page, filters }) {
      const url = new URL(searchBaseUrl);
      const upstreamCount = resolveCount(limit);
      const irdb = filters?.irdb;

      url.searchParams.set("q", query);
      url.searchParams.set("count", String(upstreamCount));
      url.searchParams.set("start", String((page - 1) * limit + 1));
      url.searchParams.set("format", "atom");

      if (irdb?.fulltext) {
        url.searchParams.set("fulltext", "1");
      }
      if (irdb?.title) {
        url.searchParams.set("title", irdb.title);
      }
      if (irdb?.author) {
        url.searchParams.set("author", irdb.author);
      }
      if (irdb?.keyword) {
        url.searchParams.set("keyword", irdb.keyword);
      }
      if (irdb?.journal) {
        url.searchParams.set("journal", irdb.journal);
      }
      if (irdb?.publisher) {
        url.searchParams.set("publisher", irdb.publisher);
      }

      const payload = await fetchText(url.toString());
      const result = mapIrdbSearchResponse(payload.text);

      return {
        total: result.total,
        items: result.items.slice(0, limit)
      };
    },
    async getRecord(sourceId) {
      try {
        const payload = await fetchText(
          normalizeSourceUrl(detailBaseUrl, sourceId)
        );

        return mapIrdbRecordResponse(sourceId, payload.text);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    }
  };
}
