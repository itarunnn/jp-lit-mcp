import { fetchText, UpstreamHttpError } from "../../lib/http.js";
import type { SourceAdapter } from "../types.js";
import { mapJstageRecordResponse } from "./mapRecord.js";
import { mapJstageSearchResponse } from "./mapSearch.js";

const DEFAULT_SEARCH_BASE_URL = "https://api.jstage.jst.go.jp/searchapi/do";
const DEFAULT_ARTICLE_BASE_URL = "https://www.jstage.jst.go.jp";

interface JstageAdapterOptions {
  searchBaseUrl?: string;
  articleBaseUrl?: string;
}

function resolveSourceUrl(baseUrl: string, sourceId: string) {
  try {
    return new URL(sourceId, baseUrl).toString();
  } catch {
    return sourceId;
  }
}

export function createJstageArticlesAdapter(
  options: JstageAdapterOptions = {}
): SourceAdapter {
  const searchBaseUrl = options.searchBaseUrl ?? DEFAULT_SEARCH_BASE_URL;
  const articleBaseUrl = options.articleBaseUrl ?? DEFAULT_ARTICLE_BASE_URL;

  return {
    source: "jstage_articles",
    async search({ query, limit, page, issued_from, issued_to }) {
      const url = new URL(searchBaseUrl);

      url.searchParams.set("service", "3");
      url.searchParams.set("article", query);
      url.searchParams.set("count", String(limit));
      url.searchParams.set("page", String(page));
      if (issued_from) {
        url.searchParams.set("pubyearfrom", issued_from);
      }
      if (issued_to) {
        url.searchParams.set("pubyearto", issued_to);
      }

      const payload = await fetchText(url.toString());

      return mapJstageSearchResponse(payload.text);
    },
    async getRecord(sourceId) {
      try {
        const payload = await fetchText(resolveSourceUrl(articleBaseUrl, sourceId));

        return mapJstageRecordResponse(sourceId, payload.text);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    }
  };
}
