import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { RecordItem } from "../../lib/types.js";
import { mapJapanSearchSearchEntry } from "./mapSearch.js";

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

function collectValuesBySuffix(value: unknown, suffix: string): string[] {
  if (Array.isArray(value)) {
    return compactStrings(value.flatMap((entry) => collectValuesBySuffix(entry, suffix)));
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const direct = Object.entries(record)
    .filter(([key]) => key.endsWith(suffix))
    .flatMap(([, entry]) => readStringList(entry));

  const nested = Object.values(record).flatMap((entry) =>
    collectValuesBySuffix(entry, suffix)
  );

  return compactStrings([...direct, ...nested]);
}

export function mapJapanSearchRecordResponse(payload: unknown): RecordItem {
  const record = asRecord(payload) ?? {};
  const common = asRecord(record.common) ?? {};
  const base = mapJapanSearchSearchEntry(record);
  const rdfBlock = Object.entries(record)
    .find(([key]) => key.endsWith("-rdf:RDF"))?.[1];
  const linkUrl = readString(common.linkUrl);
  const iiifUrl = readString(common.iiifUrl);

  return {
    ...base,
    summary: readString(collectValuesBySuffix(rdfBlock, ":description-s")[0] ?? null),
    alternative_titles: compactStrings([readString(common.titleYomi)]),
    publication_place: null,
    language: null,
    material_type:
      readString(readStringList(asRecord(record.rdfindex)?.type).join(", ")) ??
      readString(readStringList(common.category).join(", ")),
    extent: readString(collectValuesBySuffix(rdfBlock, ":extent-s")[0] ?? null),
    subjects: readStringList(asRecord(record.rdfindex)?.type),
    identifiers: {
      japan_search_id: readString(record.id),
      database: readString(common.database),
      provider: readString(common.provider),
      owner_org: readString(common.ownerOrg)
    },
    table_of_contents: [],
    content_access: {
      has_page_images: Boolean(iiifUrl),
      has_text_coordinates: false,
      viewer_url: iiifUrl ?? linkUrl,
      access_note: readString(common.contentsRightsType)
    },
    source_metadata: {
      database: readString(common.database),
      provider: readString(common.provider),
      owner_org: readString(common.ownerOrg),
      contents_type: readString(common.contentsType),
      contents_access: readString(common.contentsAccess),
      iiif_url: iiifUrl,
      thumbnail_url: readStringList(common.thumbnailUrl),
      contents_url: readStringList(common.contentsUrl)
    },
    raw: record
  };
}

