import { parseXml } from "../../lib/xml.js";
import {
  csvFirst,
  numberFromText,
  toAuthors,
  toIssuedFields
} from "../archiveShared.js";
import type { RecordItem } from "../../lib/types.js";

const BASE_URL = "https://www.digital.archives.go.jp";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readText(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  return readText(record["#text"]);
}

function rdfDescription(rdfXml: string): Record<string, unknown> {
  const parsed = parseXml(rdfXml);
  const root = asRecord(parsed["rdf:RDF"]) ?? parsed;
  const description = asRecord(root["rdf:Description"]);
  return description ?? {};
}

export function mapNationalArchivesRecordResponse(
  sourceId: string,
  rdfXml: string,
  csv: string | null = null
): RecordItem {
  const rdf = rdfDescription(rdfXml);
  const csvRecord = csvFirst(csv);
  const title = csvRecord["資料名"] || readText(rdf["dc:title"]) || "Untitled";
  const creator = csvRecord["作成者"] || readText(rdf["dc:creator"]);
  const issuedLabel = csvRecord["作成年月日"] || readText(rdf["dc:date"]);
  const materialType = readText(rdf["dc:type"]) || null;
  const imageCount = numberFromText(csvRecord["画像数"] || readText(rdf["dcterms:extent"]));
  const url = `${BASE_URL}/file/${sourceId}.html`;

  return {
    source: "national_archives",
    source_id: sourceId,
    title,
    subtitle: null,
    title_reading: null,
    authors: toAuthors(creator, "creator"),
    publisher: csvRecord["所蔵館"] || "国立公文書館",
    journal_title: null,
    ...toIssuedFields(issuedLabel),
    summary: null,
    url,
    availability: {
      online: true,
      digital_collection: (imageCount ?? 0) > 0
    },
    alternative_titles: [],
    publication_place: null,
    language: "ja",
    material_type: materialType,
    extent: null,
    subjects: [],
    identifiers: {
      national_archives_id: sourceId,
      call_number: csvRecord["請求番号"] || null
    },
    table_of_contents: [],
    content_access: {
      has_page_images: (imageCount ?? 0) > 0,
      has_text_coordinates: false,
      viewer_url: url,
      access_note: csvRecord["利用制限"] || null
    },
    source_metadata: {
      hierarchy: csvRecord["階層"] || null,
      call_number: csvRecord["請求番号"] || null,
      holding_institution: csvRecord["所蔵館"] || "国立公文書館",
      creator,
      image_count: imageCount,
      has_images: (imageCount ?? 0) > 0,
      access_restriction: csvRecord["利用制限"] || null,
      raw_csv: csvRecord
    },
    raw: {
      rdf,
      csv: csvRecord
    }
  };
}
