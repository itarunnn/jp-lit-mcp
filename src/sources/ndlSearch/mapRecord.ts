import type { RecordItem } from "../../lib/types.js";
import {
  mapNdlSearchSearchEntry,
  readNdlSearchBoolean,
  readNdlSearchObject,
  readNdlSearchString,
  readNdlSearchStringList
} from "./mapSearch.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

export function mapNdlSearchRecordResponse(payload: unknown): RecordItem {
  const record = asRecord(payload) ?? {};
  const base = mapNdlSearchSearchEntry(record);

  return {
    ...base,
    alternative_titles: readNdlSearchStringList(
      record.alternativeTitles ?? record.alternative_titles
    ),
    publication_place: readNdlSearchString(
      record.publicationPlace ?? record.publication_place
    ),
    language: readNdlSearchString(record.language),
    material_type: readNdlSearchString(
      record.materialType ?? record.material_type
    ),
    extent: readNdlSearchString(record.extent),
    subjects: readNdlSearchStringList(record.subjects ?? record.subject),
    identifiers: readNdlSearchObject(record.identifiers),
    table_of_contents: readNdlSearchStringList(
      record.tableOfContents ?? record.table_of_contents
    ),
    content_access: {
      has_page_images: readNdlSearchBoolean(
        record.hasPageImages ?? record.has_page_images
      ),
      has_text_coordinates: readNdlSearchBoolean(
        record.hasTextCoordinates ?? record.has_text_coordinates
      ),
      viewer_url: readNdlSearchString(record.viewerUrl ?? record.viewer_url),
      access_note: readNdlSearchString(record.accessNote ?? record.access_note)
    },
    source_metadata: {
      provider_id: readNdlSearchString(record.providerId ?? record.provider_id),
      provider_name: readNdlSearchString(
        record.providerName ?? record.provider_name ?? record.provider
      ),
      raw_url: readNdlSearchString(record.rawUrl ?? record.raw_url)
    },
    raw: record
  };
}
