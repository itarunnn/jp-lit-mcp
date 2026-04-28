import {
  UnsupportedPayloadError,
  UpstreamHttpError
} from "../../lib/http.js";
import { assertXmlPayload } from "../../lib/xml.js";
import type { SourceAdapter } from "../types.js";
import { projectNdlSearchDetailXml } from "../ndlSearch/projectOpenSearch.js";
import { projectNdlSruSearchResponse } from "../ndlSearch/parseSru.js";
import { createNextDigitalLibraryClient } from "../nextDigitalLibrary/adapter.js";
import { resolveNextDigitalLibraryPid } from "../nextDigitalLibrary/resolvePid.js";
import { mapNdlDigitalRecordResponse } from "./mapRecord.js";
import { mapNdlDigitalSearchResponse } from "./mapSearch.js";

const DEFAULT_SEARCH_BASE_URL = "https://ndlsearch.ndl.go.jp/api/sru";
const DEFAULT_RECORD_BASE_URL =
  "https://ndlsearch.ndl.go.jp/api/bib/external/search";
const DEFAULT_NEXT_DL_BASE_URL = "https://lab.ndl.go.jp/dl/api";

interface NdlDigitalAdapterOptions {
  searchBaseUrl?: string;
  recordBaseUrl?: string;
  nextDlBaseUrl?: string;
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

async function fetchNdlDigitalPayload(url: string): Promise<unknown> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }

  const contentType = response.headers?.get("content-type") ?? null;
  if (typeof response.text !== "function") {
    if (isJsonContentType(contentType) && typeof response.json === "function") {
      return (await response.json()) as unknown;
    }

    throw new UnsupportedPayloadError(
      "Response body reader is unavailable for the received payload"
    );
  }

  const text = await response.text();
  const trimmed = text.trimStart();

  if (
    isJsonContentType(contentType) ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new UnsupportedPayloadError(
        "JSON payload required but upstream returned non-JSON content"
      );
    }
  }

  assertXmlPayload({ text, contentType });

  return projectNdlSearchDetailXml(text);
}

async function fetchNdlDigitalSruPayload(url: string): Promise<unknown> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }

  const projected = projectNdlSruSearchResponse(await response.text()) as {
    totalResults?: string;
    items?: Array<Record<string, unknown>>;
  };

  return {
    ...projected,
    items: Array.isArray(projected.items)
      ? projected.items.map((item) => ({
          ...item,
          digitalCollection: true
        }))
      : []
  };
}

function normalizeSruSearchBaseUrl(baseUrl: string): string {
  return baseUrl
    .replace(/\/api\/opensearch\/?$/i, "/api/sru")
    .replace(/\/opensearch\/?$/i, "/sru");
}

function escapeCqlKeyword(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildSortBy(
  sortBy?: "title" | "creator" | "issued_date" | "created_date" | "modified_date",
  sortOrder?: "asc" | "desc"
) {
  if (!sortBy) {
    return null;
  }

  const direction = sortOrder === "desc" ? "descending" : "ascending";

  return `${sortBy}/sort.${direction}`;
}

export function createNdlDigitalAdapter(
  options: NdlDigitalAdapterOptions = {}
): SourceAdapter {
  const searchBaseUrl = options.searchBaseUrl ?? DEFAULT_SEARCH_BASE_URL;
  const recordBaseUrl = options.recordBaseUrl ?? DEFAULT_RECORD_BASE_URL;
  const nextDlBaseUrl = (options.nextDlBaseUrl ?? DEFAULT_NEXT_DL_BASE_URL).replace(/\/+$/, "");
  const nextDlClient = createNextDigitalLibraryClient({ baseUrl: nextDlBaseUrl });

  return {
    source: "ndl_digital",
    async search({ query, limit, page, sort_by, sort_order }) {
      const url = new URL(normalizeSruSearchBaseUrl(searchBaseUrl));
      url.searchParams.set("operation", "searchRetrieve");
      url.searchParams.set("version", "1.2");
      url.searchParams.set("recordSchema", "dcndl");
      url.searchParams.set("recordPacking", "xml");
      url.searchParams.set("maximumRecords", String(limit));
      url.searchParams.set("startRecord", String((page - 1) * limit + 1));
      url.searchParams.set(
        "query",
        `dpid=ndl-dl AND anywhere="${escapeCqlKeyword(query)}"`
      );
      const sort = buildSortBy(sort_by, sort_order);
      if (sort) {
        url.searchParams.set("sortBy", sort);
      }

      const projected = await fetchNdlDigitalSruPayload(url.toString()) as {
        totalResults?: string;
        items?: unknown[];
        facets?: {
          providers: Record<string, number>;
          ndc: Record<string, number>;
          issued_years: Record<string, number>;
        };
      };

      const result = mapNdlDigitalSearchResponse(projected);

      return {
        total: result.total,
        items: result.items,
        facets: projected.facets
      };
    },
    async getRecord(sourceId) {
      const url = new URL(recordBaseUrl);
      url.searchParams.set("cs", "bib");
      url.searchParams.set("f-token", sourceId);

      let record;
      try {
        const payload = await fetchNdlDigitalPayload(url.toString());
        record = mapNdlDigitalRecordResponse(payload);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }

      if (!record) {
        return null;
      }

      const pidResolution = resolveNextDigitalLibraryPid(record);
      if (!pidResolution) {
        return {
          ...record,
          source_metadata: {
            ...record.source_metadata,
            next_digital_library: null
          }
        };
      }

      const { pid } = pidResolution;
      const bookApiUrl = `${nextDlBaseUrl}/book/${encodeURIComponent(pid)}`;
      const bookData = await nextDlClient.getBook(pid);

      return {
        ...record,
        source_metadata: {
          ...record.source_metadata,
          next_digital_library: {
            pid,
            available: bookData !== null,
            reason: bookData !== null ? null : "not_indexed_in_next_digital_library",
            book_api_url: bookApiUrl,
            total_page: typeof bookData?.totalPage === "number" ? bookData.totalPage : null,
            public_domain: typeof bookData?.publicDomain === "boolean" ? bookData.publicDomain : null,
            online_pdf: typeof bookData?.onlinePdf === "boolean" ? bookData.onlinePdf : null
          }
        }
      };
    }
  };
}
