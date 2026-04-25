import {
  UnsupportedPayloadError,
  UpstreamHttpError
} from "../../lib/http.js";
import { assertXmlPayload } from "../../lib/xml.js";
import type { SourceAdapter } from "../types.js";
import { projectNdlSearchOpenSearchXml } from "../ndlSearch/projectOpenSearch.js";
import { mapNdlDigitalRecordResponse } from "./mapRecord.js";
import { mapNdlDigitalSearchResponse } from "./mapSearch.js";

const DEFAULT_SEARCH_BASE_URL = "https://ndlsearch.ndl.go.jp/api/opensearch";
const DEFAULT_RECORD_BASE_URL =
  "https://ndlsearch.ndl.go.jp/api/bib/external/search";

interface NdlDigitalAdapterOptions {
  searchBaseUrl?: string;
  recordBaseUrl?: string;
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

  return projectNdlSearchOpenSearchXml(text);
}

export function createNdlDigitalAdapter(
  options: NdlDigitalAdapterOptions = {}
): SourceAdapter {
  const searchBaseUrl = options.searchBaseUrl ?? DEFAULT_SEARCH_BASE_URL;
  const recordBaseUrl = options.recordBaseUrl ?? DEFAULT_RECORD_BASE_URL;

  return {
    source: "ndl_digital",
    async search({ query, limit, page }) {
      const url = new URL(searchBaseUrl);
      url.searchParams.set("any", query);
      url.searchParams.set("cnt", String(limit));
      url.searchParams.set("idx", String((page - 1) * limit + 1));
      url.searchParams.set("dpid", "ndl-dl");

      return mapNdlDigitalSearchResponse(
        await fetchNdlDigitalPayload(url.toString())
      );
    },
    async getRecord(sourceId) {
      const url = new URL(recordBaseUrl);
      url.searchParams.set("cs", "bib");
      url.searchParams.set("f-token", sourceId);

      try {
        const payload = await fetchNdlDigitalPayload(url.toString());

        return mapNdlDigitalRecordResponse(payload);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    }
  };
}
