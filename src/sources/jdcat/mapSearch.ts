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
    readString(record.value) ??
    readString(record.label) ??
    readString(record.subitem_1551255647225) ??
    readString(record.subitem_1592472785169) ??
    readString(record.subitem_1591178807921) ??
    readString(record.subitem_1592369405220) ??
    readString(record.subitem_1602144759036) ??
    readString(record.creatorName) ??
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

function pickLangValue(
  value: unknown,
  langField = "subitem_1551255648112",
  textField = "subitem_1551255647225",
  preferred = "ja"
) {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];
  const preferredEntry = entries.find(
    (entry) => asRecord(entry)?.[langField] === preferred
  );

  return (
    readString(asRecord(preferredEntry)?.[textField]) ??
    readString(asRecord(entries[0])?.[textField]) ??
    null
  );
}

function pickFirstByLang(
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

function readTimePIssuedAt(metadata: JsonRecord): string | null {
  const timePValues = asRecord(metadata.item_1602145192334)?.attribute_value_mlt;
  const entries = Array.isArray(timePValues) ? timePValues : [];
  const startEntry =
    entries.find((e) => asRecord(e)?.subitem_1602144587621 === "start") ??
    entries[0];
  return readString(asRecord(startEntry)?.subitem_1602144573160) ?? null;
}

function readAbstract(metadata: JsonRecord) {
  const descriptions = Array.isArray(metadata.description) ? metadata.description : [];
  const preferred = descriptions.find(
    (entry) => asRecord(entry)?.descriptionType === "Abstract"
  );

  return readString(asRecord(preferred)?.value);
}

function readMaterialType(metadata: JsonRecord) {
  return (
    readString(Array.isArray(metadata.type) ? metadata.type[0] : metadata.type) ??
    pickFirstByLang(
      asRecord(metadata.item_1588260046718)?.attribute_value_mlt,
      "subitem_1591178807921",
      "subitem_1591178808409"
    )
  );
}

function readDistributor(metadata: JsonRecord) {
  const contributorName = asRecord(metadata.contributor)?.contributorName;
  const contributorValues = Array.isArray(contributorName)
    ? contributorName
    : contributorName == null
      ? []
      : [contributorName];

  return (
    readString(contributorValues[0]) ??
    pickFirstByLang(
      asRecord(metadata.item_1592405734122)?.attribute_value_mlt,
      "subitem_1592369405220",
      "subitem_1592369407829"
    )
  );
}

function readSourceUri(metadata: JsonRecord) {
  const values = asRecord(metadata.item_1602145007095)?.attribute_value_mlt;
  const entries = Array.isArray(values) ? values : values == null ? [] : [values];

  return readString(asRecord(entries[0])?.subitem_1602144759036);
}

function toAuthors(metadata: JsonRecord): PersonRole[] {
  const creator = asRecord(metadata.creator);
  const values = Array.isArray(creator?.creatorName)
    ? creator.creatorName
    : creator?.creatorName == null
      ? []
      : [creator.creatorName];
  const names = values.length > 0 ? [readString(values[0])] : [];

  return names
    .filter((name): name is string => Boolean(name))
    .filter((name, index, array) => array.indexOf(name) === index)
    .map((name) => ({ name, role: "author" }));
}

function readSubjects(metadata: JsonRecord) {
  const topicValues = readStringList(
    (asRecord(metadata.item_1551264822581)?.attribute_value_mlt as unknown[] | undefined)
      ?.filter((entry) => asRecord(entry)?.subitem_1592472785698 === "ja")
      .map((entry) => asRecord(entry)?.subitem_1592472785169) ?? []
  );

  return compactStrings([
    ...topicValues,
    pickFirstByLang(
      asRecord(metadata.item_1588260046718)?.attribute_value_mlt,
      "subitem_1591178807921",
      "subitem_1591178808409"
    ),
    ...(topicValues.length === 0
      ? readStringList(Array.isArray(metadata.text4) ? metadata.text4[0] : metadata.text4)
      : [])
  ]);
}

export function mapJdcatSearchEntry(entry: unknown): SearchItem {
  const record = asRecord(entry) ?? {};
  const metadata = asRecord(record.metadata) ?? {};
  const id = readString(record.id) ?? readString(metadata.control_number) ?? "missing-jdcat-id";
  const titleValues = Array.isArray(metadata.title)
    ? metadata.title
    : metadata.title == null
      ? []
      : [metadata.title];
  const title = readString(titleValues[0] ?? metadata.title) ?? "Untitled";
  const sourceUri = readSourceUri(metadata);

  return {
    source: "jdcat",
    source_id: id,
    title,
    subtitle: null,
    title_reading: null,
    authors: toAuthors(metadata),
    publisher: readDistributor(metadata),
    journal_title: null,
    ...toIssuedFields(readTimePIssuedAt(metadata)),
    summary: readAbstract(metadata),
    url: `https://jdcat.jsps.go.jp/records/${id}`,
    availability: {
      online: Boolean(sourceUri),
      digital_collection: false
    },
    material_type: readMaterialType(metadata),
    subjects: readSubjects(metadata),
    table_of_contents: [],
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

export function mapJdcatSearchResponse(payload: unknown): SearchResult {
  const record = asRecord(payload) ?? {};
  const hits = asRecord(record.hits) ?? {};
  const items = Array.isArray(hits.hits)
    ? hits.hits.map((entry) => mapJdcatSearchEntry(entry))
    : [];
  const total = Number(hits.total);

  return {
    total: Number.isFinite(total) ? total : items.length,
    items
  };
}
