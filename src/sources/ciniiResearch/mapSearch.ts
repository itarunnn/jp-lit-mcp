import { normalizeIssuedAt } from "../../lib/date.js";
import type { SearchItem } from "../../lib/types.js";
import { normalizeText } from "../../lib/normalize.js";
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
    readString(record["@value"]) ??
    readString(record["@id"]) ??
    readString(record.title) ??
    readString(record.name) ??
    readString(record.link)
  );
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => readStringList(entry)).filter(Boolean);
  }

  const text = readString(value);

  return text ? [text] : [];
}

function readAuthors(value: unknown) {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];

  return entries.flatMap((entry) => {
    const record = asRecord(entry);
    const name =
      readString(record?.["foaf:name"]) ??
      readString(record?.name) ??
      readString(entry);

    return name
      ? [
          {
            name,
            role: "author"
          }
        ]
      : [];
  });
}

function readIdentifiers(value: unknown): Record<string, unknown> {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];
  const identifiers: Record<string, unknown> = {};

  for (const entry of entries) {
    const record = asRecord(entry);
    const identifierRecord = asRecord(record?.identifier) ?? record;
    const type = readString(identifierRecord?.["@type"]);
    const identifierValue =
      readString(identifierRecord?.["@value"]) ?? readString(identifierRecord);

    if (!type || !identifierValue) {
      continue;
    }

    identifiers[type.toLowerCase()] = identifierValue;
  }

  return identifiers;
}

function readCrid(record: JsonRecord): string {
  const rawId =
    readString(record["@id"]) ??
    readString(asRecord(record.link)?.["@id"]) ??
    readString(asRecord(record["rdfs:seeAlso"])?.["@id"]);

  if (!rawId) {
    return "missing-crid";
  }

  return rawId
    .replace(/\.json$/i, "")
    .replace(/\.rdf$/i, "")
    .split("/")
    .filter(Boolean)
    .at(-1) ?? rawId;
}

function toIssuedFields(value: string | null) {
  const dateInfo = normalizeIssuedAt(value);

  if (dateInfo.issuedAtPrecision === "unknown") {
    return {
      issued_at: null,
      issued_at_label: dateInfo.issuedAtLabel,
      issued_at_precision: "unknown" as const
    };
  }

  return {
    issued_at: dateInfo.issuedAt,
    issued_at_label: dateInfo.issuedAtLabel,
    issued_at_precision: dateInfo.issuedAtPrecision
  };
}

export function mapCiniiResearchSearchEntry(entry: unknown): SearchItem {
  const record = asRecord(entry) ?? {};
  const issuedSource =
    readString(record["prism:publicationDate"]) ??
    readString(record["dc:date"]);
  const url =
    readString(asRecord(record.link)?.["@id"]) ??
    readString(record["@id"]) ??
    null;

  return {
    source: "cinii_research",
    source_id: readCrid(record),
    title:
      readString(record.title) ??
      readString(record["dc:title"]) ??
      readString(record["prism:publicationName"]) ??
      "Untitled",
    subtitle: null,
    authors: readAuthors(record["dc:creator"] ?? record.creator),
    publisher:
      readString(record["dc:publisher"]) ??
      readString(record.publisher) ??
      null,
    ...toIssuedFields(issuedSource),
    summary:
      readString(record.description) ??
      readString(record["dc:description"]) ??
      null,
    url,
    availability: {
      online: false,
      digital_collection: false
    }
  };
}

export function mapCiniiResearchSearchResponse(payload: unknown): SearchResult {
  const record = asRecord(payload) ?? {};
  const items = Array.isArray(record.items)
    ? record.items.map((entry) => mapCiniiResearchSearchEntry(entry))
    : [];
  const total = Number(record["opensearch:totalResults"]);

  return {
    total: Number.isFinite(total) ? total : items.length,
    items
  };
}

export function readCiniiIdentifiers(payload: unknown) {
  return readIdentifiers(payload);
}

export function readCiniiString(payload: unknown) {
  return readString(payload);
}

export function readCiniiStringList(payload: unknown) {
  return readStringList(payload);
}

export function readCiniiAuthors(payload: unknown) {
  return readAuthors(payload);
}
