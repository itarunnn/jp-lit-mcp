import {
  UnsupportedPayloadError,
  UpstreamHttpError
} from "../../lib/http.js";
import type { SourceAdapter } from "../types.js";
import type { SourceName } from "../../lib/types.js";
import { mapCiniiRecordResponseForSource } from "./mapRecord.js";
import { mapCiniiSearchResponseForSource } from "./mapSearch.js";

const DEFAULT_SEARCH_BASE_URL = "https://cir.nii.ac.jp/opensearch/articles";
const DEFAULT_RECORD_BASE_URL = "https://cir.nii.ac.jp/crid";

interface CiniiResearchAdapterOptions {
  source?: "cinii_research" | "cinii_articles" | "cinii_books";
  searchType?: "articles" | "books";
  searchBaseUrl?: string;
  recordBaseUrl?: string;
  appId?: string;
}

function normalizeSearchBaseUrl(
  searchBaseUrl: string | undefined,
  searchType: "articles" | "books"
) {
  const base = searchBaseUrl ?? DEFAULT_SEARCH_BASE_URL;
  const url = new URL(base);

  url.pathname = url.pathname.replace(/\/(articles|books)\/?$/, `/${searchType}`);

  return url.toString();
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }

  const normalized = contentType.toLowerCase();

  return (
    normalized.includes("application/json") ||
    normalized.includes("+json") ||
    normalized.includes("text/json")
  );
}

async function fetchJsonPayload(url: string, accept?: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: accept
      ? {
          accept
        }
      : undefined
  });

  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }

  const contentType = response.headers?.get("content-type") ?? null;
  const text = await response.text();
  const trimmed = text.trimStart();

  if (
    isJsonContentType(contentType) ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    return JSON.parse(text) as unknown;
  }

  throw new UnsupportedPayloadError(
    `JSON payload required but received ${contentType ?? "unknown content type"}`
  );
}

function normalizeRecordBaseUrl(recordBaseUrl: string, sourceId: string) {
  const baseUrl = new URL(recordBaseUrl);
  const pathname = baseUrl.pathname.replace(/\/+$/, "");
  const suffix = pathname.endsWith("/crid")
    ? `${pathname}/${sourceId}.json`
    : `${pathname}/${sourceId}.json`;

  baseUrl.pathname = suffix;
  baseUrl.search = "";
  baseUrl.hash = "";

  return baseUrl.toString();
}

export function createCiniiResearchAdapter(
  options: CiniiResearchAdapterOptions = {}
): SourceAdapter {
  const source = options.source ?? "cinii_research";
  const searchType = options.searchType ?? "articles";
  const searchBaseUrl = normalizeSearchBaseUrl(
    options.searchBaseUrl,
    searchType
  );
  const recordBaseUrl = options.recordBaseUrl ?? DEFAULT_RECORD_BASE_URL;

  return {
    source,
    async search({ query, limit, page }) {
      const url = new URL(searchBaseUrl);
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(limit));
      url.searchParams.set("start", String((page - 1) * limit + 1));
      url.searchParams.set("format", "json");
      if (options.appId) {
        url.searchParams.set("appid", options.appId);
      }

      return mapCiniiSearchResponseForSource(
        await fetchJsonPayload(url.toString(), "application/json"),
        source
      );
    },
    async getRecord(sourceId) {
      const url = normalizeRecordBaseUrl(recordBaseUrl, sourceId);

      try {
        return mapCiniiRecordResponseForSource(
          await fetchJsonPayload(url.toString(), "application/json")
            .catch(() => fetchJsonPayload(url, "application/json, application/ld+json")),
          source
        );
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    }
  };
}

export function createCiniiArticlesAdapter(
  options: Omit<CiniiResearchAdapterOptions, "source" | "searchType"> = {}
): SourceAdapter {
  return createCiniiResearchAdapter({
    ...options,
    source: "cinii_articles",
    searchType: "articles"
  });
}

export function createCiniiBooksAdapter(
  options: Omit<CiniiResearchAdapterOptions, "source" | "searchType"> = {}
): SourceAdapter {
  return createCiniiResearchAdapter({
    ...options,
    source: "cinii_books",
    searchType: "books"
  });
}
