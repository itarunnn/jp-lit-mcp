import { fetchWithTimeout } from "../../lib/http.js";
import { normalizeDoi } from "./matching.js";
import type {
  EnrichRecordQuery,
  ExternalLookupResult,
  ExternalWorkItem
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.openalex.org/works";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface OpenAlexClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetcher?: Fetcher;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeAuthors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((authorship) => {
    const record = asRecord(authorship);
    const author = asRecord(record?.author);
    const name = asString(author?.display_name);
    return name ? [name] : [];
  });
}

function mapWork(work: Record<string, unknown>): ExternalWorkItem | null {
  const title = asString(work.title) ?? asString(work.display_name);
  if (!title) return null;
  const doi = normalizeDoi(asString(work.doi));
  const primaryLocation = asRecord(work.primary_location);
  const source = asRecord(primaryLocation?.source);

  return {
    provider: "openalex",
    id: asString(work.id) ?? doi ?? title,
    doi,
    title,
    authors: normalizeAuthors(work.authorships),
    issued_year: asString(work.publication_year),
    url: asString(primaryLocation?.landing_page_url) ?? (doi ? `https://doi.org/${doi}` : asString(work.id)),
    cited_by_count: asNumber(work.cited_by_count),
    source_title: asString(source?.display_name),
    type: asString(work.type)
  };
}

function createDoiUrl(baseUrl: string, doi: string, apiKey: string) {
  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/doi:${encodeURIComponent(doi)}`);
  url.searchParams.set("api_key", apiKey);
  return url;
}

function createSearchUrl(baseUrl: string, input: EnrichRecordQuery, apiKey: string) {
  const url = new URL(baseUrl);
  if (input.title) {
    url.searchParams.set("search", input.title);
  }
  url.searchParams.set("per_page", "5");
  url.searchParams.set("api_key", apiKey);
  if (input.issued_year) {
    url.searchParams.set(
      "filter",
      `from_publication_date:${input.issued_year}-01-01,to_publication_date:${input.issued_year}-12-31`
    );
  }
  return url;
}

function emptyResult(status: ExternalLookupResult["status"], note: string | null): ExternalLookupResult {
  return {
    provider: "openalex",
    status,
    note,
    item_count: 0,
    items: []
  };
}

export function createOpenAlexClient(options: OpenAlexClientOptions = {}) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const apiKey = options.apiKey ?? process.env.OPENALEX_API_KEY ?? "";
  const fetcher: Fetcher =
    options.fetcher ?? ((input, init) => fetchWithTimeout(input, init));

  return {
    async lookup(input: EnrichRecordQuery): Promise<ExternalLookupResult> {
      const trimmedApiKey = apiKey.trim();
      if (!trimmedApiKey) {
        return emptyResult(
          "skipped",
          "OPENALEX_API_KEY is not set; OpenAlex enrichment was skipped."
        );
      }

      const doi = normalizeDoi(input.doi);
      const url = doi
        ? createDoiUrl(baseUrl, doi, trimmedApiKey)
        : createSearchUrl(baseUrl, input, trimmedApiKey);

      try {
        const response = await fetcher(url, {
          headers: { accept: "application/json" }
        });
        if (response.status === 404) {
          return emptyResult("not_found", null);
        }
        if (!response.ok) {
          return emptyResult("error", `OpenAlex request failed: ${response.status} ${response.statusText}`);
        }

        const payload = asRecord(await response.json());
        const rawItems = Array.isArray(payload?.results)
          ? payload.results
          : payload
            ? [payload]
            : [];
        const items = rawItems.flatMap((item) => {
          const record = asRecord(item);
          const mapped = record ? mapWork(record) : null;
          return mapped ? [mapped] : [];
        });

        return {
          provider: "openalex",
          status: items.length > 0 ? "ok" : "not_found",
          note: null,
          item_count: items.length,
          items
        };
      } catch (error) {
        return emptyResult(
          "error",
          error instanceof Error ? error.message : "OpenAlex request failed"
        );
      }
    }
  };
}

export type OpenAlexClient = ReturnType<typeof createOpenAlexClient>;
