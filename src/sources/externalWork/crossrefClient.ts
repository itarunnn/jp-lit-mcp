import { fetchWithTimeout } from "../../lib/http.js";
import { normalizeDoi } from "./matching.js";
import type {
  EnrichRecordQuery,
  ExternalLookupResult,
  ExternalWorkItem
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.crossref.org/works";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface CrossrefClientOptions {
  baseUrl?: string;
  mailto?: string;
  fetcher?: Fetcher;
}

interface CrossrefWork {
  DOI?: unknown;
  title?: unknown;
  author?: unknown;
  issued?: unknown;
  published?: unknown;
  URL?: unknown;
  "container-title"?: unknown;
  type?: unknown;
  "is-referenced-by-count"?: unknown;
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

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const text = asString(item);
      return text ? [text] : [];
    });
  }
  const text = asString(value);
  return text ? [text] : [];
}

function normalizeAuthor(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) return asString(value);
  const family = asString(record.family);
  const given = asString(record.given);
  return [family, given].filter(Boolean).join(" ").trim() || null;
}

function normalizeAuthors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const author = normalizeAuthor(entry);
    return author ? [author] : [];
  });
}

function firstIssuedYear(value: unknown) {
  const record = asRecord(value);
  const dateParts = record?.["date-parts"];
  if (!Array.isArray(dateParts)) return null;
  const firstPart = dateParts[0];
  if (!Array.isArray(firstPart)) return null;
  const year = firstPart[0];
  return typeof year === "number" ? String(year) : asString(year);
}

function citationCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapWork(work: CrossrefWork): ExternalWorkItem | null {
  const doi = normalizeDoi(asString(work.DOI));
  const title = asStringArray(work.title)[0];
  if (!title) return null;

  return {
    provider: "crossref",
    id: doi ?? asString(work.URL) ?? title,
    doi,
    title,
    authors: normalizeAuthors(work.author),
    issued_year: firstIssuedYear(work.issued) ?? firstIssuedYear(work.published),
    url: asString(work.URL) ?? (doi ? `https://doi.org/${doi}` : null),
    cited_by_count: citationCount(work["is-referenced-by-count"]),
    source_title: asStringArray(work["container-title"])[0] ?? null,
    type: asString(work.type)
  };
}

function worksFromPayload(payload: unknown): ExternalWorkItem[] {
  const root = asRecord(payload);
  const message = asRecord(root?.message);
  if (!message) return [];

  if (Array.isArray(message.items)) {
    return message.items.flatMap((item) => {
      const record = asRecord(item);
      const mapped = record ? mapWork(record as CrossrefWork) : null;
      return mapped ? [mapped] : [];
    });
  }

  const mapped = mapWork(message as CrossrefWork);
  return mapped ? [mapped] : [];
}

function createDoiUrl(baseUrl: string, doi: string, mailto: string | undefined) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(encodeURIComponent(doi), base);
  if (mailto?.trim()) {
    url.searchParams.set("mailto", mailto.trim());
  }
  return url;
}

function createSearchUrl(baseUrl: string, input: EnrichRecordQuery, mailto: string | undefined) {
  const url = new URL(baseUrl);
  if (input.title) {
    url.searchParams.set("query.title", input.title);
  }
  if (input.authors[0]) {
    url.searchParams.set("query.author", input.authors[0]);
  }
  if (input.issued_year) {
    url.searchParams.set("filter", `from-pub-date:${input.issued_year},until-pub-date:${input.issued_year}`);
  }
  url.searchParams.set("rows", "5");
  url.searchParams.set("select", "DOI,title,author,issued,published,URL,container-title,type,is-referenced-by-count");
  if (mailto?.trim()) {
    url.searchParams.set("mailto", mailto.trim());
  }
  return url;
}

function emptyResult(status: ExternalLookupResult["status"], note: string | null): ExternalLookupResult {
  return {
    provider: "crossref",
    status,
    note,
    item_count: 0,
    items: []
  };
}

export function createCrossrefClient(options: CrossrefClientOptions = {}) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const mailto = options.mailto ?? process.env.CROSSREF_MAILTO;
  const fetcher: Fetcher =
    options.fetcher ?? ((input, init) => fetchWithTimeout(input, init));

  return {
    async lookup(input: EnrichRecordQuery): Promise<ExternalLookupResult> {
      const doi = normalizeDoi(input.doi);
      const url = doi
        ? createDoiUrl(baseUrl, doi, mailto)
        : createSearchUrl(baseUrl, input, mailto);

      try {
        const response = await fetcher(url, {
          headers: { accept: "application/json" }
        });
        if (response.status === 404) {
          return emptyResult("not_found", null);
        }
        if (!response.ok) {
          return emptyResult("error", `Crossref request failed: ${response.status} ${response.statusText}`);
        }

        const items = worksFromPayload(await response.json());
        return {
          provider: "crossref",
          status: items.length > 0 ? "ok" : "not_found",
          note: null,
          item_count: items.length,
          items
        };
      } catch (error) {
        return emptyResult(
          "error",
          error instanceof Error ? error.message : "Crossref request failed"
        );
      }
    }
  };
}

export type CrossrefClient = ReturnType<typeof createCrossrefClient>;
