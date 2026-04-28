import { normalizeIssuedAt } from "../../lib/date.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { PersonRole, SearchItem } from "../../lib/types.js";
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
    readString(record["@value"]) ??
    readString(record["rdf:value-s"]) ??
    readString(record["foaf:name-s"]) ??
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

function readNestedCreatorNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return compactStrings(value.flatMap((entry) => readNestedCreatorNames(entry)));
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  return compactStrings([
    readString(record["foaf:name-s"]),
    ...Object.values(record).flatMap((entry) => readNestedCreatorNames(entry))
  ]);
}

function toAuthors(payload: JsonRecord): PersonRole[] {
  const common = asRecord(payload.common) ?? {};
  const contributors = readStringList(common.contributor);
  const rdfBlock = Object.entries(payload)
    .find(([key]) => key.endsWith("-rdf:RDF"))?.[1];
  const creatorNames = readNestedCreatorNames(rdfBlock);

  return compactStrings([...creatorNames, ...contributors])
    .filter((name, index, array) => array.indexOf(name) === index)
    .map((name) => ({
      name,
      role: "author"
    }));
}

export function mapJapanSearchSearchEntry(entry: unknown): SearchItem {
  const record = asRecord(entry) ?? {};
  const common = asRecord(record.common) ?? {};
  const online = readString(common.contentsAccess) === "internet";

  const rdfindex = asRecord(record.rdfindex);
  const typeList = readStringList(rdfindex?.type);

  return {
    source: "japan_search",
    source_id: readString(record.id) ?? readString(common.id) ?? "missing-jps-id",
    title: readString(common.title) ?? "Untitled",
    subtitle: null,
    title_reading: readString(common.titleYomi),
    authors: toAuthors(record),
    publisher: null,
    journal_title: null,
    ...toIssuedFields(null),
    summary: null,
    url: readString(common.linkUrl),
    availability: {
      online,
      digital_collection: Boolean(readString(common.iiifUrl))
    },
    material_type: typeList.join(", ") || null,
    subjects: typeList,
    table_of_contents: [],
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

export function mapJapanSearchSearchResponse(payload: unknown): SearchResult {
  const record = asRecord(payload) ?? {};
  const items = Array.isArray(record.list)
    ? record.list.map((entry) => mapJapanSearchSearchEntry(entry))
    : [];
  const total = Number(record.hit);

  return {
    total: Number.isFinite(total) ? total : items.length,
    items
  };
}

