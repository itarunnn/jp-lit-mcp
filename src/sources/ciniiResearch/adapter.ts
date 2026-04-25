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
const DEFAULT_HOLDINGS_BASE_URL = "https://ci.nii.ac.jp/books/opensearch/holder";

interface CiniiResearchAdapterOptions {
  source?: "cinii_research" | "cinii_articles" | "cinii_books";
  searchType?: "articles" | "books";
  searchBaseUrl?: string;
  recordBaseUrl?: string;
  holdingsBaseUrl?: string;
  appId?: string;
}

type JsonRecord = Record<string, unknown>;

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

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = readString(entry);

      if (text) {
        return text;
      }
    }

    return null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return readString(record["@value"]) ?? readString(record["@id"]) ?? null;
}

function extractNcid(payload: unknown): string | null {
  const record = asRecord(payload) ?? {};
  const entries = Array.isArray(record.productIdentifier)
    ? record.productIdentifier
    : record.productIdentifier == null
      ? []
      : [record.productIdentifier];

  for (const entry of entries) {
    const recordEntry = asRecord(entry);
    const identifier = asRecord(recordEntry?.identifier) ?? recordEntry;
    const type = readString(identifier?.["@type"])?.toLowerCase();
    const value = readString(identifier?.["@value"]);

    if (type === "ncid" && value) {
      return value;
    }
  }

  return null;
}

function normalizeHoldingsUrl(
  holdingsBaseUrl: string,
  ncid: string,
  appId?: string
) {
  const url = new URL(holdingsBaseUrl);

  url.searchParams.set("ncid", ncid);
  url.searchParams.set("format", "json");
  if (appId) {
    url.searchParams.set("appid", appId);
  }

  return url.toString();
}

function mapHoldingsPayload(payload: unknown) {
  const record = asRecord(payload) ?? {};
  const graph = Array.isArray(record["@graph"]) ? record["@graph"] : [];
  const channel = asRecord(graph[0]) ?? {};
  const items = Array.isArray(channel.items)
    ? channel.items
    : channel.items == null
      ? []
      : [channel.items];
  const holdings = items.flatMap((entry) => {
    const item = asRecord(entry);
    const libraryName = readString(item?.title);
    const libraryUrl =
      readString(asRecord(item?.link)?.["@id"]) ?? readString(item?.["@id"]);

    if (!libraryName || !libraryUrl) {
      return [];
    }

    return [
      {
        library_name: libraryName,
        library_url: libraryUrl,
        library_json_url: readString(asRecord(item?.["rdfs:seeAlso"])?.["@id"])
      }
    ];
  });
  const total = Number(readString(channel["opensearch:totalResults"]));

  return {
    holding_count: Number.isFinite(total) ? total : holdings.length,
    holdings
  };
}

function withHoldings(record: ReturnType<typeof mapCiniiRecordResponseForSource>, holdings: {
  holding_count: number | null;
  holdings: Array<{
    library_name: string;
    library_url: string;
    library_json_url: string | null;
  }>;
}) {
  return {
    ...record,
    source_metadata: {
      ...record.source_metadata,
      ...holdings
    },
    raw: {
      ...record.raw,
      holdings
    }
  };
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
  const holdingsBaseUrl = options.holdingsBaseUrl ?? DEFAULT_HOLDINGS_BASE_URL;

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
        const payload = await fetchJsonPayload(url.toString(), "application/json")
          .catch(() => fetchJsonPayload(url, "application/json, application/ld+json"));
        const record = mapCiniiRecordResponseForSource(payload, source);

        if (source !== "cinii_books") {
          return record;
        }

        const ncid = extractNcid(payload);
        if (!ncid) {
          return withHoldings(record, {
            holding_count: null,
            holdings: []
          });
        }

        try {
          const holdingsPayload = await fetchJsonPayload(
            normalizeHoldingsUrl(holdingsBaseUrl, ncid, options.appId),
            "application/json"
          );

          return withHoldings(record, mapHoldingsPayload(holdingsPayload));
        } catch {
          return withHoldings(record, {
            holding_count: null,
            holdings: []
          });
        }
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
