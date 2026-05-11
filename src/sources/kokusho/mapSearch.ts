import { compactStrings } from "../../lib/normalize.js";
import type { SearchItem } from "../../lib/types.js";
import type { SearchResult } from "../types.js";
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

function mapRecord(value: unknown): SearchItem {
  const record = asRecord(value);
  const sourceId = readString(record.bid) ?? "missing-kokusho-id";
  const imageAvailable = hasImages(record.image);
  const issued = readString(record.syear) ?? readString(record.year) ?? readString(record.wyear);
  const authors = toAuthors(record.authorlist).length > 0
    ? toAuthors(record.authorlist)
    : toAuthors(record.wauthor);

  return {
    source: "kokusho",
    source_id: sourceId,
    title: readString(record.name) ?? readString(record.wname) ?? "Untitled",
    subtitle: null,
    title_reading: readString(record.yomi),
    authors,
    publisher: readString(record.collection),
    journal_title: null,
    ...toIssuedFields(issued),
    summary: null,
    url: recordUrl(sourceId),
    availability: {
      online: imageAvailable,
      digital_collection: imageAvailable
    },
    material_type: materialType(),
    subjects: readStringList(record.wkeyword),
    table_of_contents: [],
    source_metadata: {
      bid: sourceId,
      wid: readString(record.wid),
      record_kind: "bibliographic_record",
      work_title: readString(record.wname),
      collection: readString(record.collection),
      call_number: readString(record.seikyu),
      kansha: readString(record.kansha),
      volumes: readString(record.satsu),
      has_images: imageAvailable,
      shubetsu: readString(record.shubetsu),
      work_keyword: readString(record.wkeyword),
      work_author: readString(record.wauthor),
      work_year: readString(record.wyear),
      raw: record
    },
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

export function mapKokushoSearchResponse(payload: unknown): SearchResult {
  const records = Array.isArray(payload) ? payload : [];
  const items = records.map((record) => mapRecord(record));

  return {
    total: items.length,
    items: compactStrings(items.map((item) => item.source_id)).length === items.length
      ? items
      : items
  };
}
