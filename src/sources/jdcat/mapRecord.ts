import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { RecordItem } from "../../lib/types.js";
import { mapJdcatSearchEntry } from "./mapSearch.js";

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
    readString(record.value) ??
    readString(record.label) ??
    readString(record.subitem_1602144759036) ??
    readString(record.subitem_1592369405220) ??
    readString(record.subitem_1591178807921) ??
    readString(record.subitem_1551255702686) ??
    readString(record.subitem_1522650727486) ??
    readString(record.subitem_1586156939407) ??
    readString(record.creatorName) ??
    readString(record["#text"])
  );
}

function readValueByLang(
  value: unknown,
  textKey: string,
  langKey: string,
  preferred = "ja"
) {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];
  const preferredEntry = entries.find(
    (entry) => asRecord(entry)?.[langKey] === preferred
  );

  return (
    readString(asRecord(preferredEntry)?.[textKey]) ??
    readString(asRecord(entries[0])?.[textKey]) ??
    null
  );
}

function readDescriptionByType(metadata: JsonRecord, descriptionType: string) {
  const descriptions = Array.isArray(metadata.description) ? metadata.description : [];
  const preferred = descriptions.find(
    (entry) => asRecord(entry)?.descriptionType === descriptionType
  );

  return readString(asRecord(preferred)?.value);
}

function readSourceUri(metadata: JsonRecord) {
  const values = asRecord(metadata.item_1602145007095)?.attribute_value_mlt;
  const entries = Array.isArray(values) ? values : values == null ? [] : [values];

  return readString(asRecord(entries[0])?.subitem_1602144759036);
}

function readRightsUri(metadata: JsonRecord) {
  const values = asRecord(metadata.item_1551264629907)?.attribute_value_mlt;
  const entries = Array.isArray(values) ? values : values == null ? [] : [values];

  return readString(asRecord(entries[0])?.subitem_1602213569986);
}

function readDistributor(metadata: JsonRecord) {
  return readValueByLang(
    asRecord(metadata.item_1592405734122)?.attribute_value_mlt,
    "subitem_1592369405220",
    "subitem_1592369407829"
  );
}

function readPublisher(metadata: JsonRecord) {
  return readValueByLang(
    asRecord(metadata.item_1551264917614)?.attribute_value_mlt,
    "subitem_1551255702686",
    "subitem_1551255710277"
  );
}

function readDistributorUri(metadata: JsonRecord) {
  const values = asRecord(metadata.item_1592405734122)?.attribute_value_mlt;
  const entries = Array.isArray(values) ? values : values == null ? [] : [values];
  const preferred = entries.find((entry) => asRecord(entry)?.subitem_1592369407829 === "ja");

  return (
    readString(asRecord(preferred)?.subitem_1591320914113) ??
    readString(asRecord(entries[0])?.subitem_1591320914113)
  );
}

function readAccessRight(metadata: JsonRecord) {
  return readValueByLang(
    asRecord(metadata.item_1588260178185)?.attribute_value_mlt,
    "subitem_1522650727486",
    "subitem_1522650717957"
  );
}

function readDataType(metadata: JsonRecord) {
  return readValueByLang(
    asRecord(metadata.item_1588260046718)?.attribute_value_mlt,
    "subitem_1591178807921",
    "subitem_1591178808409"
  );
}

function readTemporalCoverage(metadata: JsonRecord) {
  const entries = asRecord(metadata.item_1602145192334)?.attribute_value_mlt;
  const values = Array.isArray(entries) ? entries : entries == null ? [] : [entries];

  return compactStrings(
    values.map((entry) => readString(asRecord(entry)?.subitem_1602144573160))
  ).join(" - ") || null;
}

function readSpatialCoverage(metadata: JsonRecord) {
  return readString(Array.isArray(metadata.text4) ? metadata.text4[0] : metadata.text4);
}

function readLanguage(metadata: JsonRecord) {
  const values = asRecord(metadata.item_1551265002099)?.attribute_value_mlt;
  const entries = Array.isArray(values) ? values : values == null ? [] : [values];

  return readString(asRecord(entries[0])?.subitem_1551255818386);
}

function readSubjects(metadata: JsonRecord) {
  const values = asRecord(metadata.item_1551264822581)?.attribute_value_mlt;
  const entries = Array.isArray(values) ? values : values == null ? [] : [values];

  return compactStrings(
    entries
      .filter((entry) => asRecord(entry)?.subitem_1592472785698 === "ja")
      .map((entry) => readString(asRecord(entry)?.subitem_1592472785169))
  );
}

function readStudyIds(metadata: JsonRecord) {
  const values = asRecord(metadata.item_1586157591881)?.attribute_value_mlt;
  const entries = Array.isArray(values) ? values : values == null ? [] : [values];
  const studyId = entries.find(
    (entry) => asRecord(entry)?.subitem_1591256665864 === "SSJデータアーカイブ"
  );
  const doi = entries.find(
    (entry) => asRecord(entry)?.subitem_1591256665864 === "DOI"
  );

  return {
    studyId: readString(asRecord(studyId)?.subitem_1586156939407),
    doi: readString(asRecord(doi)?.subitem_1586156939407)
  };
}

export function mapJdcatRecordResponse(payload: unknown): RecordItem {
  const record = asRecord(payload) ?? {};
  const metadata = asRecord(record.metadata) ?? {};
  const base = mapJdcatSearchEntry(record);
  const sourceUri = readSourceUri(metadata);
  const studyIds = readStudyIds(metadata);
  const materialType =
    readString(Array.isArray(metadata.type) ? metadata.type[0] : metadata.type) ??
    readDataType(metadata);

  return {
    ...base,
    summary: readDescriptionByType(metadata, "Abstract"),
    alternative_titles: compactStrings(
      (Array.isArray(metadata.title) ? metadata.title.slice(1) : []).map((entry) =>
        readString(entry)
      )
    ),
    publication_place: null,
    language: readLanguage(metadata),
    material_type: materialType,
    publisher: readPublisher(metadata) ?? base.publisher,
    extent: readDescriptionByType(metadata, "Methods"),
    subjects: readSubjects(metadata),
    identifiers: {
      jdcat_id: readString(record.id),
      oai_id: readString(asRecord(metadata._oai)?.id),
      control_number: readString(metadata.control_number),
      ...(studyIds.doi ? { doi: studyIds.doi } : {}),
      ...(studyIds.studyId ? { study_id: studyIds.studyId } : {})
    },
    table_of_contents: [],
    content_access: {
      has_page_images: false,
      has_text_coordinates: false,
      viewer_url: sourceUri,
      access_note: readAccessRight(metadata)
    },
    source_metadata: {
      distributor: readDistributor(metadata),
      distributor_uri: readDistributorUri(metadata),
      source_uri: sourceUri,
      access_right: readAccessRight(metadata),
      rights: readRightsUri(metadata),
      data_type: readDataType(metadata),
      temporal_coverage: readTemporalCoverage(metadata),
      spatial_coverage: readSpatialCoverage(metadata),
      version: readString(Array.isArray(metadata.version) ? metadata.version[0] : metadata.version)
    },
    raw: record
  };
}
