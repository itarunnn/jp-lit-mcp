import {
  fetchWithTimeout,
  UnsupportedPayloadError,
  UpstreamHttpError
} from "../../lib/http.js";
import { assertXmlPayload } from "../../lib/xml.js";
import type { RecordItem, SearchItem, SourceName } from "../../lib/types.js";
import type { SourceAdapter } from "../types.js";
import { mapCiniiRecordResponseForSource } from "../ciniiResearch/mapRecord.js";
import { mapNdlSearchRecordResponse } from "./mapRecord.js";
import { mapNdlSearchSearchResponse } from "./mapSearch.js";
import { projectNdlSearchDetailXml } from "./projectOpenSearch.js";
import { projectNdlSruSearchResponse } from "./parseSru.js";

const DEFAULT_CINII_RECORD_BASE_URL = "https://cir.nii.ac.jp/crid";
const CRID_PREFIX = "crid:";

const DEFAULT_SEARCH_BASE_URL = "https://ndlsearch.ndl.go.jp/api/sru";
const DEFAULT_RECORD_BASE_URL =
  "https://ndlsearch.ndl.go.jp/api/bib/external/search";

interface NdlSearchAdapterOptions {
  source?:
    | "ndl_search"
    | "ndl_catalog"
    | "ndl_articles"
    | "ndl_articles_online";
  providerId?: string;
  searchBaseUrl?: string;
  recordBaseUrl?: string;
  ciniiRecordBaseUrl?: string;
}

function withSource<T extends SearchItem | RecordItem>(item: T, source: SourceName): T {
  return {
    ...item,
    source
  };
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

async function fetchNdlSearchPayload(url: string): Promise<unknown> {
  const response = await fetchWithTimeout(url);

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

async function fetchNdlSearchSruPayload(url: string): Promise<unknown> {
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }

  return projectNdlSruSearchResponse(await response.text());
}

function normalizeSruSearchBaseUrl(baseUrl: string): string {
  return baseUrl
    .replace(/\/api\/opensearch\/?$/i, "/api/sru")
    .replace(/\/opensearch\/?$/i, "/sru");
}

function escapeCqlKeyword(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildIssuedClause(
  issuedFrom?: string,
  issuedTo?: string
): string[] {
  const clauses: string[] = [];

  if (issuedFrom) {
    clauses.push(`dcterms.issued >= "${escapeCqlKeyword(issuedFrom)}"`);
  }
  if (issuedTo) {
    clauses.push(`dcterms.issued <= "${escapeCqlKeyword(issuedTo)}"`);
  }

  return clauses;
}

function buildCqlQuery(
  keyword: string,
  dpid?: string,
  issuedFrom?: string,
  issuedTo?: string
): string {
  const keywordClause = `anywhere="${escapeCqlKeyword(keyword)}"`;
  const clauses = [...buildIssuedClause(issuedFrom, issuedTo), keywordClause];

  if (dpid) {
    clauses.unshift(`dpid=${dpid}`);
  }

  return clauses.join(" AND ");
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

export function createNdlSearchAdapter(
  options: NdlSearchAdapterOptions = {}
): SourceAdapter {
  const source = options.source ?? "ndl_search";
  const providerId = options.providerId;
  const searchBaseUrl = options.searchBaseUrl ?? DEFAULT_SEARCH_BASE_URL;
  const recordBaseUrl = options.recordBaseUrl ?? DEFAULT_RECORD_BASE_URL;
  const ciniiRecordBaseUrl = options.ciniiRecordBaseUrl ?? DEFAULT_CINII_RECORD_BASE_URL;

  return {
    source,
    async search({ query, limit, page, sort_by, sort_order, issued_from, issued_to }) {
      const url = new URL(normalizeSruSearchBaseUrl(searchBaseUrl));
      url.searchParams.set("operation", "searchRetrieve");
      url.searchParams.set("version", "1.2");
      url.searchParams.set("recordSchema", "dcndl");
      url.searchParams.set("recordPacking", "xml");
      url.searchParams.set("maximumRecords", String(limit));
      url.searchParams.set("startRecord", String((page - 1) * limit + 1));
      url.searchParams.set(
        "query",
        buildCqlQuery(query, providerId, issued_from, issued_to)
      );
      const sort = buildSortBy(sort_by, sort_order);
      if (sort) {
        url.searchParams.set("sortBy", sort);
      }

      const projected = await fetchNdlSearchSruPayload(url.toString()) as {
        totalResults?: string;
        items?: unknown[];
        facets?: {
          providers: Record<string, number>;
          ndc: Record<string, number>;
          issued_years: Record<string, number>;
        };
      };
      const result = mapNdlSearchSearchResponse(projected);

      return {
        total: result.total,
        items: result.items.map((item) => withSource(item, source)),
        facets: projected.facets
      };
    },
    async getRecord(sourceId) {
      if (sourceId.startsWith(CRID_PREFIX)) {
        const crid = sourceId.slice(CRID_PREFIX.length);
        const ciniiUrl = `${ciniiRecordBaseUrl.replace(/\/+$/, "")}/${crid}.json`;
        try {
          const response = await fetchWithTimeout(ciniiUrl, {
            headers: { accept: "application/json" }
          });
          if (!response.ok) {
            throw new UpstreamHttpError(response.status, response.statusText);
          }
          const payload = JSON.parse(await response.text()) as unknown;
          const record = mapCiniiRecordResponseForSource(payload, source);
          return withSource({ ...record, source_id: sourceId }, source);
        } catch (error) {
          if (error instanceof UpstreamHttpError && error.status === 404) {
            return null;
          }
          throw error;
        }
      }

      const url = new URL(recordBaseUrl);
      url.searchParams.set("cs", "bib");
      url.searchParams.set("f-token", sourceId);

      try {
        const record = mapNdlSearchRecordResponse(
          await fetchNdlSearchPayload(url.toString())
        );

        if (!record) {
          return null;
        }

        return withSource(record, source);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    }
  };
}

export function createNdlCatalogAdapter(
  options: Omit<NdlSearchAdapterOptions, "source" | "providerId"> = {}
): SourceAdapter {
  return createNdlSearchAdapter({
    ...options,
    source: "ndl_catalog",
    providerId: "iss-ndl-opac"
  });
}

export function createNdlArticlesAdapter(
  options: Omit<NdlSearchAdapterOptions, "source" | "providerId"> = {}
): SourceAdapter {
  return createNdlSearchAdapter({
    ...options,
    source: "ndl_articles",
    providerId: "zassaku"
  });
}

export function createNdlArticlesOnlineAdapter(
  options: Omit<NdlSearchAdapterOptions, "source" | "providerId"> = {}
): SourceAdapter {
  return createNdlSearchAdapter({
    ...options,
    source: "ndl_articles_online",
    providerId: "zassaku-online"
  });
}
