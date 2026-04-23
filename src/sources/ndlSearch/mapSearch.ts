import type { PersonRole, SearchItem } from "../../lib/types.js";
import { normalizeIssuedAt } from "../../lib/date.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { SearchResult } from "../types.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function pickNestedValue(record: JsonRecord): unknown {
  for (const key of [
    "name",
    "value",
    "text",
    "label",
    "title",
    "literal",
    "content",
    "rdf:value",
    "#text"
  ]) {
    if (key in record) {
      return record[key];
    }
  }

  return null;
}

export function readNdlSearchString(value: unknown): string | null {
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

  return readNdlSearchString(pickNestedValue(record));
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

function deriveSourceId(record: JsonRecord, url: string | null): string {
  const directId =
    readNdlSearchString(record.id) ??
    readNdlSearchString(record.itemno) ??
    readNdlSearchString(record.token);

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

  return "unknown";
}

function resolveItems(payload: JsonRecord): unknown[] {
  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  const channel = asRecord(payload.channel);
  if (!channel) {
    return [];
  }

  if (Array.isArray(channel.items)) {
    return channel.items;
  }

  if (Array.isArray(channel.item)) {
    return channel.item;
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
    readNdlSearchString(record.url) ?? readNdlSearchString(record.link);
  const providerId =
    readNdlSearchString(record.providerId) ??
    readNdlSearchString(record.dpid) ??
    readNdlSearchString(record.provider_id);
  const issuedFields = toIssuedFields(
    readNdlSearchString(record.issued) ??
      readNdlSearchString(record["dcterms:issued"]) ??
      readNdlSearchString(record.date)
  );

  return {
    source: "ndl_search",
    source_id: deriveSourceId(record, url),
    title: readNdlSearchString(record.title) ?? "Untitled",
    subtitle: readNdlSearchString(record.subtitle),
    authors: readAuthors(record.authors ?? record.creator ?? record["dc:creator"]),
    publisher:
      readNdlSearchString(record.publisher) ??
      readNdlSearchString(record["dcterms:publisher"]),
    ...issuedFields,
    summary:
      readNdlSearchString(record.summary) ??
      readNdlSearchString(record.description) ??
      readNdlSearchString(record["dcterms:abstract"]),
    url,
    availability: {
      online:
        readNdlSearchBoolean(record.online) ||
        readNdlSearchBoolean(record.isOnline),
      digital_collection:
        readNdlSearchBoolean(record.digitalCollection) ||
        readNdlSearchBoolean(record.digital_collection) ||
        providerId?.startsWith("ndl-dl") === true
    }
  };
}

export function mapNdlSearchSearchResponse(payload: unknown): SearchResult {
  const record = asRecord(payload) ?? {};
  const items = resolveItems(record).map((entry) => mapNdlSearchSearchEntry(entry));
  const totalValue =
    readNdlSearchString(record.total) ??
    readNdlSearchString(record.totalResults) ??
    readNdlSearchString(asRecord(record.channel)?.totalResults);
  const total = Number(totalValue);

  return {
    total: Number.isFinite(total) ? total : items.length,
    items
  };
}
