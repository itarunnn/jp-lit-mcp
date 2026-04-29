import { fetchText } from "../../lib/http.js";
import { projectRssChannelXml } from "../../lib/xml.js";

const DEFAULT_CRD_SEARCH_URL = "https://crd.ndl.go.jp/api/refsearch";

export interface CrdSearchInput {
  query: string;
  limit: number;
  page: number;
  lib_id?: string;
  lib_group?: string;
}

export interface CrdGuideManualItem {
  id: string;
  title: string;
  provider: string | null;
  url: string;
  published_at: string | null;
  categories: string[];
  summary: string | null;
  search_keywords: string[];
  guide_headings: string[];
  description: string;
}

export interface CrdReferenceCaseItem {
  id: string;
  title: string;
  provider: string | null;
  url: string;
  published_at: string | null;
  categories: string[];
  summary: string | null;
  question: string | null;
  answer_process: string | null;
  preliminary_research: string | null;
  reference_sources: string[];
  description: string;
}

export interface CrdManualsSearchResult {
  query: string;
  type: "manual";
  page: number;
  limit: number;
  total: number;
  items: CrdGuideManualItem[];
  raw: Record<string, unknown>;
}

export interface CrdCasesSearchResult {
  query: string;
  type: "reference";
  page: number;
  limit: number;
  total: number;
  items: CrdReferenceCaseItem[];
  raw: Record<string, unknown>;
}

interface CrdClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetchText;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      const stringValue = asString(entry);
      return stringValue ? [stringValue] : [];
    });
  }

  const stringValue = asString(value);
  return stringValue ? [stringValue] : [];
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function normalizeDescription(value: string | null) {
  if (!value) {
    return "";
  }

  return decodeXmlEntities(value)
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function splitTitleAndProvider(value: string | null) {
  if (!value) {
    return {
      title: "",
      provider: null
    };
  }

  const match = value.match(/^(.*)\((.+)\)$/);
  if (!match) {
    return {
      title: value.trim(),
      provider: null
    };
  }

  return {
    title: match[1]?.trim() ?? value.trim(),
    provider: match[2]?.trim() ?? null
  };
}

function extractIdFromUrl(value: string | null) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    return url.searchParams.get("id") ?? url.toString();
  } catch {
    return value;
  }
}

function compactLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function firstParagraph(value: string) {
  const paragraphs = value
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return paragraphs[0] ?? null;
}

function extractDelimitedSection(
  value: string,
  startPattern: RegExp,
  endPatterns: RegExp[]
) {
  const startMatch = value.match(startPattern);
  if (!startMatch || startMatch.index == null) {
    return null;
  }

  const startIndex = startMatch.index + startMatch[0].length;
  let endIndex = value.length;

  for (const pattern of endPatterns) {
    const sliced = value.slice(startIndex);
    const endMatch = sliced.match(pattern);
    if (endMatch?.index != null) {
      endIndex = Math.min(endIndex, startIndex + endMatch.index);
    }
  }

  const section = value.slice(startIndex, endIndex).trim();
  return section.length > 0 ? section : null;
}

function extractSearchKeywords(value: string) {
  const section = extractDelimitedSection(
    value,
    /(?:《検索する際のキーワード》|【検索する際のキーワード】)\s*/m,
    [/^【/m, /^備考[:：]/m, /^\(\d+\)/m]
  );

  if (!section) {
    return [];
  }

  return Array.from(
    new Set(
      section
        .split(/[／/、,，\n]+/)
        .map((part) =>
          part
            .replace(/^・+/, "")
            .replace(/\s*など$/, "")
            .replace(/^※.*$/, "")
            .trim()
        )
        .filter((part) => part.length > 0 && !part.startsWith("※"))
    )
  );
}

function extractGuideHeadings(value: string) {
  return Array.from(
    value.matchAll(/^【(.+?)】$/gm),
    (match) => match[1]?.trim() ?? ""
  ).filter((heading) => heading.length > 0);
}

function extractReferenceSources(value: string) {
  return compactLines(value)
    .filter((line) => line.startsWith("参考資料:"))
    .map((line) => line.replace(/^参考資料[:：]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function mapManualItem(item: Record<string, unknown>): CrdGuideManualItem {
  const rawTitle = asString(item.title);
  const url = asString(item.guid) ?? asString(item.link) ?? "";
  const description = normalizeDescription(asString(item.description));
  const titleParts = splitTitleAndProvider(rawTitle);

  return {
    id: extractIdFromUrl(url),
    title: titleParts.title,
    provider: titleParts.provider,
    url,
    published_at: asString(item.pubDate),
    categories: toStringArray(item.category),
    summary: firstParagraph(description),
    search_keywords: extractSearchKeywords(description),
    guide_headings: extractGuideHeadings(description),
    description
  };
}

function mapCaseItem(item: Record<string, unknown>): CrdReferenceCaseItem {
  const rawTitle = asString(item.title);
  const url = asString(item.guid) ?? asString(item.link) ?? "";
  const description = normalizeDescription(asString(item.description));
  const titleParts = splitTitleAndProvider(rawTitle);

  return {
    id: extractIdFromUrl(url),
    title: titleParts.title,
    provider: titleParts.provider,
    url,
    published_at: asString(item.pubDate),
    categories: toStringArray(item.category),
    summary: firstParagraph(description),
    question: titleParts.title || null,
    answer_process: extractDelimitedSection(
      description,
      /回答プロセス[:：]\s*/m,
      [/^事前調査事項[:：]/m, /^参考資料[:：]/m]
    ),
    preliminary_research: extractDelimitedSection(
      description,
      /事前調査事項[:：]\s*/m,
      [/^参考資料[:：]/m]
    ),
    reference_sources: extractReferenceSources(description),
    description
  };
}

function extractTotalResults(channel: Record<string, unknown>): number | null {
  const raw = channel["opensearch:totalResults"] ?? channel["openSearch:totalResults"];
  if (raw == null) return null;
  const str = asString(raw);
  if (str == null) return null;
  const n = Number(str);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildSearchUrl(baseUrl: string, type: "manual" | "reference", input: CrdSearchInput) {
  const url = new URL(baseUrl);
  const start = (input.page - 1) * input.limit + 1;
  const safeQuery = input.query.replace(/"/g, " ").trim();

  url.searchParams.set("type", type);
  url.searchParams.set("query", `anywhere all "${safeQuery}"`);
  url.searchParams.set("results_format", "rss");
  url.searchParams.set("results_num", String(input.limit));
  url.searchParams.set("results_get_position", String(start));

  if (input.lib_id) {
    url.searchParams.set("lib-id", input.lib_id);
  }

  if (input.lib_group) {
    url.searchParams.set("lib-group", input.lib_group);
  }

  return url.toString();
}

export function createCrdClient(options: CrdClientOptions = {}) {
  const baseUrl = options.baseUrl ?? DEFAULT_CRD_SEARCH_URL;
  const fetcher = options.fetcher ?? fetchText;

  return {
    async searchManuals(input: CrdSearchInput): Promise<CrdManualsSearchResult> {
      const payload = await fetcher(buildSearchUrl(baseUrl, "manual", input));
      const projected = projectRssChannelXml(payload.text);
      const items = projected.items.map((item) => mapManualItem(item));

      return {
        query: input.query,
        type: "manual",
        page: input.page,
        limit: input.limit,
        total: extractTotalResults(projected.channel) ?? items.length,
        items,
        raw: projected.channel
      };
    },

    async searchCases(input: CrdSearchInput): Promise<CrdCasesSearchResult> {
      const payload = await fetcher(buildSearchUrl(baseUrl, "reference", input));
      const projected = projectRssChannelXml(payload.text);
      const items = projected.items.map((item) => mapCaseItem(item));

      return {
        query: input.query,
        type: "reference",
        page: input.page,
        limit: input.limit,
        total: extractTotalResults(projected.channel) ?? items.length,
        items,
        raw: projected.channel
      };
    }
  };
}

export type CrdClient = ReturnType<typeof createCrdClient>;
