import { compactStrings } from "../../lib/normalize.js";
import type { RecordItem } from "../../lib/types.js";
import {
  asRecord,
  hasImages,
  materialType,
  readString,
  readStringList,
  recordUrl,
  toAuthors,
  toIssuedFields
} from "./shared.js";

function readWork(record: Record<string, unknown>) {
  const [first] = Array.isArray(record.work) ? record.work : [];
  return asRecord(first);
}

function readWorkAuthors(work: Record<string, unknown>) {
  const authors = Array.isArray(work.author) ? work.author : [];
  return authors
    .map((entry) => readString(asRecord(entry).name))
    .filter((value): value is string => Boolean(value));
}

function readIdentifiers(record: Record<string, unknown>) {
  const identifiers: Record<string, unknown> = {
    bid: readString(record.bid)
  };

  for (const entry of Array.isArray(record.refid) ? record.refid : []) {
    const ref = asRecord(entry);
    const kind = readString(ref.kind)?.toLowerCase();
    const value = readString(ref.refid);
    if (kind && value) {
      identifiers[kind] = value;
    }
  }

  const doi = readString(record.doi);
  if (doi) {
    identifiers.doi = doi;
  }

  return identifiers;
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

export function mapKokushoRecordResponse(payload: unknown): RecordItem {
  const record = asRecord(payload);
  const work = readWork(record);
  const sourceId = readString(record.bid) ?? "missing-kokusho-id";
  const imageAvailable = hasImages(record.image) || Boolean(readString(record.manifest));
  const url = recordUrl(sourceId);
  const authors = toAuthors(record.author).length > 0
    ? toAuthors(record.author)
    : readWorkAuthors(work).map((name) => ({ name, role: "author" }));
  const extent = compactStrings([readString(record.kansu), readString(record.satsu)]).join(" / ") || null;
  const callNumber =
    readString(record.d_seikyu) ??
    readString(record.m_seikyu) ??
    readString(record.c_seikyu) ??
    readString(record.w_seikyu);

  return {
    source: "kokusho",
    source_id: sourceId,
    title: readString(record.hshomei) ?? readString(record.hshomeipdf) ?? "Untitled",
    subtitle: null,
    title_reading: null,
    authors,
    publisher: readString(record.collection),
    journal_title: null,
    ...toIssuedFields(readString(record.syear) ?? readString(record.wyear)),
    summary: readStringList(record.chuki)[0] ?? null,
    url,
    availability: {
      online: imageAvailable,
      digital_collection: imageAvailable
    },
    alternative_titles: readStringList(record.kshomei),
    publication_place: null,
    language: "ja",
    material_type: materialType(),
    extent,
    subjects: uniqueStrings(compactStrings([readString(record.keyword), readString(work.keyword)])),
    identifiers: readIdentifiers(record),
    table_of_contents: readStringList(record.imageindex),
    content_access: {
      has_page_images: imageAvailable,
      has_text_coordinates: false,
      viewer_url: url,
      access_note: readString(record.licenselink)
    },
    source_metadata: {
      bid: sourceId,
      wid: readString(work.wid),
      record_kind: "bibliographic_record",
      work_title: readString(work.name),
      collection: readString(record.collection),
      call_number: callNumber,
      kansha: readString(record.kansha),
      volumes: readString(record.satsu),
      has_images: imageAvailable,
      manifest_url: readString(record.manifest),
      license_url: readString(record.licenselink),
      shubetsu: readString(record.shubetsu),
      work_year: readString(work.year),
      work_authors: readWorkAuthors(work),
      notes: readStringList(record.chuki),
      raw: record
    },
    raw: record
  };
}
