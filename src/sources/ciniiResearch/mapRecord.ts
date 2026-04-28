import type { RecordItem, SourceName } from "../../lib/types.js";
import {
  readCiniiAuthors,
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

function readDescription(value: unknown): string | null {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];

  for (const entry of entries) {
    const record = asRecord(entry);
    const notation = readCiniiString(record?.notation);

    if (notation) {
      return notation;
    }

    const direct = readCiniiString(entry);

    if (direct) {
      return direct;
    }
  }

  return null;
}

function readSubjects(record: JsonRecord): string[] {
  const structuredSubjects = readCiniiStringList(
    (Array.isArray(record["dcterms:subject"])
      ? record["dcterms:subject"]
      : record["dcterms:subject"] == null
        ? []
        : [record["dcterms:subject"]]
    ).flatMap((entry) => {
      const subjectRecord = asRecord(entry);

      return subjectRecord?.notation ?? [];
    })
  );

  return [
    ...structuredSubjects,
    ...readCiniiStringList(record["dc:subject"]),
    ...readCiniiStringList(record["foaf:topic"])
  ].filter((value, index, array) => array.indexOf(value) === index);
}

function readUrls(record: JsonRecord): string[] {
  return readCiniiStringList(record.url);
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
  return mapCiniiRecordResponseForSource(payload, "cinii_articles");
}

export function mapCiniiRecordResponseForSource(
  payload: unknown,
  source: SourceName
): RecordItem {
  const record = asRecord(payload) ?? {};
  const base = mapCiniiResearchSearchEntry({
    ...record,
    title:
      readCiniiString(record["dc:title"]) ??
      readCiniiString(record.title) ??
      readCiniiString(readPublication(record)["prism:publicationName"]),
    "dc:creator": record.creator ?? record["dc:creator"],
    "dc:publisher":
      readCiniiString(readPublication(record)["dc:publisher"]) ??
      record["dc:publisher"],
    "prism:publicationDate":
      readCiniiString(readPublication(record)["prism:publicationDate"]) ??
      record["prism:publicationDate"],
    "prism:publicationName":
      readCiniiString(readPublication(record)["prism:publicationName"]) ??
      record["prism:publicationName"],
    description: readDescription(record.description) ?? record.description
  }, source);
  const publication = readPublication(record);
  const startingPage = readCiniiString(publication["prism:startingPage"]);
  const endingPage = readCiniiString(publication["prism:endingPage"]);
  const number = readCiniiString(publication["prism:number"]);
  const volume = readCiniiString(publication["prism:volume"]);

  return {
    ...base,
    authors: readCiniiAuthors(record.creator ?? record["dc:creator"]),
    publisher:
      readCiniiString(publication["dc:publisher"]) ?? base.publisher,
    summary: readDescription(record.description) ?? base.summary,
    alternative_titles: readCiniiStringList(
      record.alternativeTitle ??
        record["dcterms:alternative"] ??
        record["dc:title"]
    ).filter((t) => t !== base.title),
    publication_place: null,
    language:
      readCiniiString(record.inLanguage) ??
      readCiniiString(record["dc:language"]) ??
      null,
    material_type:
      readCiniiString(record.resourceType) ??
      readCiniiString(record["@type"]),
    extent: null,
    subjects: readSubjects(record),
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
      publication_publisher: readCiniiString(publication["dc:publisher"]),
      publication_date: readCiniiString(publication["prism:publicationDate"]),
      volume,
      number,
      starting_page: startingPage,
      ending_page: endingPage,
      urls: readUrls(record),
      related_count: Array.isArray(record.relatedProduct)
        ? record.relatedProduct.length
        : record.relatedProduct
          ? 1
          : 0
    },
    raw: record
  };
}
