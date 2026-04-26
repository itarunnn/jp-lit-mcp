import { normalizeIssuedAt } from "../../lib/date.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { SearchItem } from "../../lib/types.js";
import { parseXml, type XmlObject } from "../../lib/xml.js";
import type { SearchResult } from "../types.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    return normalizeText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
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

  return (
    readString(record.ja) ??
    readString(record.en) ??
    readString(record.name) ??
    readString(record["@_href"]) ??
    readString(record.href) ??
    readString(record["#text"])
  );
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return compactStrings(value.flatMap((entry) => readStringList(entry)));
  }

  const text = readString(value);

  return text ? [text] : [];
}

function toIssuedFields(value: string | null) {
  const issuedAt = normalizeIssuedAt(value);

  if (issuedAt.issuedAtPrecision === "unknown") {
    return {
      issued_at: null,
      issued_at_label: issuedAt.issuedAtLabel,
      issued_at_precision: "unknown" as const
    };
  }

  return {
    issued_at: issuedAt.issuedAt,
    issued_at_label: issuedAt.issuedAtLabel,
    issued_at_precision: issuedAt.issuedAtPrecision
  };
}

function readAuthorNames(value: unknown) {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];

  return entries.flatMap((entry) => {
    const record = asRecord(entry);
    const localized = record?.ja ?? record?.en ?? entry;
    const names = readStringList(asRecord(localized)?.name ?? localized);

    return names.map((name) => ({
      name,
      role: "author"
    }));
  });
}

function readLink(value: unknown) {
  const record = asRecord(value);

  return readString(record?.ja) ?? readString(record?.en) ?? readString(value);
}

function normalizeSourceId(url: string | null) {
  if (!url) {
    return "missing-jstage-id";
  }

  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function mapJstageEntry(entry: XmlObject): SearchItem {
  const url = readString(entry.id) ?? readLink(entry.link) ?? readLink(entry.article_link);

  return {
    source: "jstage_articles",
    source_id: normalizeSourceId(url),
    title:
      readString(entry.title) ??
      readString(entry.article_title) ??
      "Untitled",
    subtitle: null,
    authors: readAuthorNames(entry.author),
    publisher: readString(entry.systemname),
    ...toIssuedFields(readString(entry.pubyear)),
    summary: null,
    url,
    availability: {
      online: Boolean(url),
      digital_collection: false
    },
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

export function mapJstageSearchResponse(xml: string): SearchResult {
  const parsed = parseXml(xml);
  const feed = asRecord(parsed.feed);
  const itemsRaw = Array.isArray(feed?.entry)
    ? feed.entry
    : feed?.entry == null
      ? []
      : [feed.entry];
  const resultNode = asRecord(feed?.result);
  const status = readString(resultNode?.status);

  if (status && status !== "0") {
    return {
      total: 0,
      items: []
    };
  }

  const items = itemsRaw.map((entry) => mapJstageEntry(asRecord(entry) ?? {}));
  const total = Number(readString(feed?.["opensearch:totalResults"]));

  return {
    total: Number.isFinite(total) ? total : items.length,
    items
  };
}
