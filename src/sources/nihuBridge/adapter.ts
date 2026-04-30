import { fetchJson, UpstreamHttpError } from "../../lib/http.js";
import type { NihuBridgeSearchFilters, SourceAdapter } from "../types.js";
import { mapNihuBridgeRecordResponse } from "./mapRecord.js";
import { mapNihuBridgeSearchResponse } from "./mapSearch.js";

const DEFAULT_SEARCH_URL =
  "https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/search";
const DEFAULT_RECORD_BASE_URL =
  "https://api.bridge.nihu.jp/v1/integratedsearch/metadatas";

interface NihuBridgeAdapterOptions {
  searchUrl?: string;
  recordBaseUrl?: string;
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

interface NihuBridgeQueryCondition {
  connect: "AND" | "OR";
  negation?: boolean;
  query?: {
    field?: string;
    term: string;
    operator?: "LE" | "GE" | "BETWEEN";
    match?: "start" | "contain" | "end" | "is" | "regex";
    normalize?: boolean;
    negation?: boolean;
  };
}

interface NihuBridgeRequestBody {
  institute?: string[];
  database?: string[];
  query: {
    conditions: NihuBridgeQueryCondition[];
    paging: { start: number; size: number };
  };
}

function expandPeriodToISO(value: string, isStart: boolean): string {
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) {
    return isStart
      ? `${trimmed}-01-01T00:00:00+09:00`
      : `${trimmed}-12-31T00:00:00+09:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00+09:00`;
  }
  return trimmed;
}

function buildBody(
  query: string,
  limit: number,
  page: number,
  filters: NihuBridgeSearchFilters | undefined,
  issuedFrom?: string,
  issuedTo?: string
): NihuBridgeRequestBody {
  const conditions: NihuBridgeQueryCondition[] = [
    {
      connect: "AND",
      query: {
        term: query,
        ...(filters?.normalize === false ? { normalize: false } : {})
      }
    }
  ];

  const periodFrom = filters?.period_from ?? issuedFrom;
  const periodTo = filters?.period_to ?? issuedTo;
  if (periodFrom || periodTo) {
    const start = expandPeriodToISO(periodFrom ?? "1000", true);
    const end = expandPeriodToISO(periodTo ?? "9999", false);
    conditions.push({
      connect: "AND",
      query: {
        field: "temporal",
        term: `${start},${end}`,
        operator: "BETWEEN"
      }
    });
  }

  if (filters?.bbox) {
    const { lat1, lon1, lat2, lon2 } = filters.bbox;
    conditions.push({
      connect: "AND",
      query: {
        field: "spatial",
        term: `(${lat1},${lon1}),(${lat2},${lon2})`
      }
    });
  }

  const body: NihuBridgeRequestBody = {
    query: {
      conditions,
      paging: {
        start: (page - 1) * limit,
        size: limit
      }
    }
  };

  if (filters?.institute && filters.institute.length > 0) {
    body.institute = [...filters.institute];
  }
  if (filters?.database && filters.database.length > 0) {
    body.database = [...filters.database];
  }

  return body;
}

export function createNihuBridgeAdapter(
  options: NihuBridgeAdapterOptions = {}
): SourceAdapter {
  const searchUrl = options.searchUrl ?? DEFAULT_SEARCH_URL;
  const recordBaseUrl = normalizeBaseUrl(
    options.recordBaseUrl ?? DEFAULT_RECORD_BASE_URL
  );

  return {
    source: "nihu_bridge",
    async search({ query, limit, page, issued_from, issued_to, filters }) {
      const body = buildBody(
        query,
        limit,
        page,
        filters?.nihu_bridge,
        issued_from,
        issued_to
      );
      const payload = await fetchJson(searchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      return mapNihuBridgeSearchResponse(payload);
    },
    async getRecord(sourceId) {
      const url = `${recordBaseUrl}/${encodeURIComponent(sourceId)}`;
      try {
        return mapNihuBridgeRecordResponse(await fetchJson(url));
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }
        throw error;
      }
    }
  };
}
