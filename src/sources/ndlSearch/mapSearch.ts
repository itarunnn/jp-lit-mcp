import { createHash } from "node:crypto";
import type { PersonRole, SearchItem } from "../../lib/types.js";
import { normalizeIssuedAt } from "../../lib/date.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { SearchResult } from "../types.js";

type JsonRecord = Record<string, unknown>;
const NESTED_VALUE_KEYS = [
  "rdf:value",
  "value",
  "#text",
  "text",
  "name",
  "label",
  "title",
  "literal",
  "content",
  "foaf:name",
  "rdf:resource"
] as const;
const ATTRIBUTE_VALUE_KEYS = ["@_rdf:resource"] as const;
const NESTED_CONTAINER_KEYS = [
  "rdf:Description",
  "foaf:Agent",
  "dc:title",
  "dcterms:title",
  "dc:creator",
  "dcterms:creator"
] as const;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function stableSerialize(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  const record = asRecord(value);
  if (!record) {
    return JSON.stringify(String(value));
  }

  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`);

  return `{${entries.join(",")}}`;
}

export function readNdlSearchString(
  value: unknown,
  seen: Set<object> = new Set()
): string | null {
  if (typeof value === "string") {
    return normalizeText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = readNdlSearchString(entry);

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

  if (seen.has(record)) {
    return null;
  }

  seen.add(record);

  for (const key of NESTED_VALUE_KEYS) {
    if (key in record) {
      return readNdlSearchString(record[key], seen);
    }
  }

  for (const key of NESTED_CONTAINER_KEYS) {
    if (key in record) {
      return readNdlSearchString(record[key], seen);
    }
  }

  const prefixed = readStringFromPrefixedKey(record);
  if (prefixed) {
    return prefixed;
  }

  for (const [key, nestedValue] of Object.entries(record)) {
    if (key.startsWith("@_")) {
      continue;
    }

    const nested = readNdlSearchString(nestedValue, seen);

    if (nested) {
      return nested;
    }
  }

  return null;
}

export function readNdlSearchStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return compactStrings(
      value.flatMap((entry) => readNdlSearchStringList(entry))
    );
  }

  const text = readNdlSearchString(value);

  return text ? [text] : [];
}

function readStringFromPrefixedKey(record: JsonRecord): string | null {
  for (const key of ATTRIBUTE_VALUE_KEYS) {
    if (!(key in record)) {
      continue;
    }

    const text = readNdlSearchString(record[key]);

    if (text) {
      return text;
    }
  }

  return null;
}

export function readNdlSearchBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const text = readNdlSearchString(value)?.toLowerCase();

  return text === "true" || text === "1" || text === "yes";
}

export function readNdlSearchObject(value: unknown): Record<string, unknown> {
  return asRecord(value) ?? {};
}

function readAuthors(value: unknown): PersonRole[] {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];

  return entries.flatMap((entry) => {
    const record = asRecord(entry);
    const name = readNdlSearchString(record?.name ?? entry);

    if (!name) {
      return [];
    }

    const role = readNdlSearchString(record?.role) ?? "author";

    return [{ name, role }];
  });
}

function createFallbackSourceId(record: JsonRecord): string {
  const serialized = stableSerialize(record);
  const digest = createHash("sha256").update(serialized).digest("hex");

  return `fallback:sha256:${digest}`;
}

function deriveSourceId(record: JsonRecord, url: string | null): string {
  const directId =
    readNdlSearchString(record.id) ??
    readNdlSearchString(record.itemno) ??
    readNdlSearchString(record.token) ??
    readNdlSearchString(record["dc:identifier"]) ??
    readNdlSearchString(record["dcterms:identifier"]);

  if (directId) {
    return directId;
  }

  if (url) {
    try {
      const pathname = new URL(url).pathname;
      const sourceId = pathname.split("/").filter(Boolean).at(-1);

      if (sourceId) {
        return sourceId;
      }
    } catch {
      return url;
    }
  }

  return createFallbackSourceId(record);
}

function resolveChannel(payload: JsonRecord): JsonRecord | null {
  const directChannel = asRecord(payload.channel);

  if (directChannel) {
    return directChannel;
  }

  return asRecord(asRecord(payload.rss)?.channel);
}

function resolveItems(payload: JsonRecord): unknown[] {
  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if ("item" in payload) {
    return Array.isArray(payload.item) ? payload.item : [payload.item];
  }

  const channel = resolveChannel(payload);
  if (!channel) {
    return [];
  }

  if (Array.isArray(channel.items)) {
    return channel.items;
  }

  if (Array.isArray(channel.item)) {
    return channel.item;
  }

  if ("item" in channel) {
    return [channel.item];
  }

  return [];
}

function toIssuedFields(value: string | null) {
  const date = normalizeIssuedAt(value);

  if (date.issuedAtPrecision === "unknown") {
    return {
      issued_at: null,
      issued_at_label: date.issuedAtLabel,
      issued_at_precision: "unknown" as const
    };
  }

  return {
    issued_at: date.issuedAt,
    issued_at_label: date.issuedAtLabel,
    issued_at_precision: date.issuedAtPrecision
  };
}

export function mapNdlSearchSearchEntry(entry: unknown): SearchItem {
  const record = asRecord(entry) ?? {};
  const url =
    readNdlSearchString(record.url) ??
    readNdlSearchString(record.link) ??
    readNdlSearchString(record["rdfs:seeAlso"]);
  const providerId =
    readNdlSearchString(record.providerId) ??
    readNdlSearchString(record.dpid) ??
    readNdlSearchString(record.provider_id);
  const issuedFields = toIssuedFields(
    readNdlSearchString(record.issued) ??
      readNdlSearchString(record["dcterms:issued"]) ??
      readNdlSearchString(record.date)
  );

  const baseSourceId = deriveSourceId(record, url);
  const ciniiCrid = readNdlSearchString(record.ciniiCrid);
  const sourceId =
    ciniiCrid && baseSourceId.startsWith("R000000004-")
      ? `crid:${ciniiCrid}`
      : baseSourceId;

  return {
    source: "ndl_search",
    source_id: sourceId,
    title:
      readNdlSearchString(record.title) ??
      readNdlSearchString(record["dc:title"]) ??
      readNdlSearchString(record["dcterms:title"]) ??
      "Untitled",
    subtitle:
      readNdlSearchString(record.subtitle) ??
      readNdlSearchString(record["dcndl:volumeTitle"]),
    title_reading: readNdlSearchString(record.titleReading) ?? null,
    authors: readAuthors(
      record.authors ??
        record.author ??
        record.creator ??
        record["dc:creator"] ??
        record["dcterms:creator"]
    ),
    publisher:
      readNdlSearchString(record.publisher) ??
      readNdlSearchString(record["dcterms:publisher"]) ??
      readNdlSearchString(record["dc:publisher"]),
    journal_title: readNdlSearchString(record.journalTitle) ?? null,
    ...issuedFields,
    summary:
      readNdlSearchString(record.summary) ??
      readNdlSearchString(record.description) ??
      readNdlSearchString(record["dcterms:abstract"]) ??
      readNdlSearchString(record["dc:description"]),
    url,
    availability: {
      online:
        readNdlSearchBoolean(record.online) ||
        readNdlSearchBoolean(record.isOnline),
      digital_collection:
        readNdlSearchBoolean(record.digitalCollection) ||
        readNdlSearchBoolean(record.digital_collection) ||
        readNdlSearchStringList(record.category).includes("デジタル") ||
        providerId?.startsWith("ndl-dl") === true
    },
    material_type: readNdlSearchString(record.materialType) ?? null,
    subjects: readNdlSearchStringList(record.subjects),
    table_of_contents: readNdlSearchStringList(
      record.tableOfContents ?? record.table_of_contents
    ),
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

export function mapNdlSearchSearchResponse(payload: unknown): SearchResult {
  const record = asRecord(payload) ?? {};
  const items = resolveItems(record).map((entry) => mapNdlSearchSearchEntry(entry));
  const channel = resolveChannel(record);
  const totalValue =
    readNdlSearchString(record.total) ??
    readNdlSearchString(record.totalResults) ??
    readNdlSearchString(record["openSearch:totalResults"]) ??
    readNdlSearchString(channel?.totalResults) ??
    readNdlSearchString(channel?.["openSearch:totalResults"]);
  const total = Number(totalValue);

  return {
    total: Number.isFinite(total) ? total : items.length,
    items
  };
}
