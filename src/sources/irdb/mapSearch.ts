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
    readString(record["#text"]) ??
    readString(record["@_href"]) ??
    readString(record.href) ??
    readString(record.name) ??
    readString(record.ja) ??
    readString(record.en)
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

function normalizeSourceId(url: string | null) {
  if (!url) {
    return "missing-irdb-id";
  }

  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function toAuthors(value: unknown) {
  return readStringList(value).map((name) => ({
    name,
    role: "author"
  }));
}

function mapIrdbEntry(entry: XmlObject): SearchItem {
  const url = readString(asRecord(entry.link)?.["@_href"] ?? entry.link) ?? readString(entry.id);
  const sourceUri = readString(entry.URI);
  const summary = readString(entry.content);
  const materialType = readString(entry.category);

  return {
    source: "irdb",
    source_id: normalizeSourceId(url),
    title: readString(entry.title) ?? "Untitled",
    subtitle: null,
    title_reading: null,
    authors: toAuthors(entry.author),
    publisher: readString(entry.publisher),
    journal_title: readString(entry["prism:publicationName"]),
    ...toIssuedFields(readString(entry["prism:publicationDate"])),
    summary:
      summary && summary !== "application/pdf" ? summary : null,
    url,
    availability: {
      online: Boolean(url || sourceUri),
      digital_collection: false
    },
    material_type: materialType,
    subjects: readStringList(entry.subject),
    table_of_contents: [],
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

export function mapIrdbSearchResponse(xml: string): SearchResult {
  const parsed = parseXml(xml);
  const feed = asRecord(parsed.feed);
  const entriesRaw = Array.isArray(feed?.entry)
    ? feed.entry
    : feed?.entry == null
      ? []
      : [feed.entry];
  const items = entriesRaw.map((entry) => mapIrdbEntry(asRecord(entry) ?? {}));
  const total = Number(readString(feed?.["opensearch:totalResults"]));

  return {
    total: Number.isFinite(total) ? total : items.length,
    items
  };
}
