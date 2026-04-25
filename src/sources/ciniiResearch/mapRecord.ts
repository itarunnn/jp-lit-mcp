import type { RecordItem } from "../../lib/types.js";
import {
  mapCiniiResearchSearchEntry,
  readCiniiIdentifiers,
  readCiniiString,
  readCiniiStringList
} from "./mapSearch.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readPublication(record: JsonRecord | null): JsonRecord {
  return asRecord(record?.publication) ?? {};
}

function readDataSourceIdentifiers(value: unknown): Record<string, unknown> {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];
  const identifiers: Record<string, unknown> = {};

  for (const entry of entries) {
    const record = asRecord(entry);
    const type = readCiniiString(record?.["@type"]);
    const identifierValue = readCiniiString(record?.["@value"]);

    if (!type || !identifierValue) {
      continue;
    }

    identifiers[`data_source_${type.toLowerCase()}`] = identifierValue;
  }

  return identifiers;
}

export function mapCiniiResearchRecordResponse(payload: unknown): RecordItem {
  const record = asRecord(payload) ?? {};
  const base = mapCiniiResearchSearchEntry({
    ...record,
    "dc:creator": record.creator ?? record["dc:creator"],
    "prism:publicationDate":
      readCiniiString(readPublication(record)["prism:publicationDate"]) ??
      record["prism:publicationDate"],
    "prism:publicationName":
      readCiniiString(readPublication(record)["prism:publicationName"]) ??
      record["prism:publicationName"]
  });
  const publication = readPublication(record);

  return {
    ...base,
    alternative_titles: readCiniiStringList(
      record.alternativeTitle ?? record["dcterms:alternative"]
    ),
    publication_place: null,
    language:
      readCiniiString(record.inLanguage) ??
      readCiniiString(record["dc:language"]) ??
      null,
    material_type: readCiniiString(record["@type"]),
    extent: null,
    subjects: readCiniiStringList(record.keyword ?? record.subject),
    identifiers: {
      ...readCiniiIdentifiers(record.productIdentifier),
      ...readDataSourceIdentifiers(record.dataSourceIdentifier)
    },
    table_of_contents: [],
    content_access: {
      has_page_images: false,
      has_text_coordinates: false,
      viewer_url: null,
      access_note: null
    },
    source_metadata: {
      publication_name: readCiniiString(publication["prism:publicationName"]),
      publication_date: readCiniiString(publication["prism:publicationDate"]),
      related_count: Array.isArray(record.relatedProduct)
        ? record.relatedProduct.length
        : record.relatedProduct
          ? 1
          : 0
    },
    raw: record
  };
}
