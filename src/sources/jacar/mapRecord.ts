import {
  csvFirst,
  extractDlValue,
  numberFromText,
  toAuthors,
  toIssuedFields
} from "../archiveShared.js";
import type { RecordItem } from "../../lib/types.js";

const BASE_URL = "https://www.jacar.archives.go.jp";

export function mapJacarRecordResponse(
  sourceId: string,
  html: string,
  csv: string | null = null
): RecordItem {
  const csvRecord = csvFirst(csv);
  const referenceCode = csvRecord["レファレンスコード"] || extractDlValue(html, "レファレンスコード") || sourceId;
  const title = csvRecord["件名標題"] || extractDlValue(html, "件名標題") || "Untitled";
  const issuedLabel =
    csvRecord["作成年月日"] ||
    csvRecord["資料作成年月日"] ||
    extractDlValue(html, "作成年月日");
  const imageCount = numberFromText(csvRecord["画像数"] || extractDlValue(html, "画像数"));
  const url = `${BASE_URL}/das/meta/${referenceCode}`;

  return {
    source: "jacar",
    source_id: referenceCode,
    title,
    subtitle: null,
    title_reading: null,
    authors: toAuthors(csvRecord["作成者名称"], "creator"),
    publisher: csvRecord["所蔵館"] || null,
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
    material_type: "archival_record",
    extent: null,
    subjects: [],
    identifiers: {
      reference_code: referenceCode,
      call_number: csvRecord["請求番号"] || extractDlValue(html, "請求番号")
    },
    table_of_contents: [],
    content_access: {
      has_page_images: (imageCount ?? 0) > 0,
      has_text_coordinates: false,
      viewer_url: url,
      access_note: csvRecord["利用制限"] || null
    },
    source_metadata: {
      hierarchy: csvRecord["階層"] || extractDlValue(html, "階層"),
      call_number: csvRecord["請求番号"] || extractDlValue(html, "請求番号"),
      holding_institution: csvRecord["所蔵館"] || null,
      creator: csvRecord["作成者名称"] || null,
      image_count: imageCount,
      has_images: (imageCount ?? 0) > 0,
      access_restriction: csvRecord["利用制限"] || null,
      reference_code: referenceCode,
      raw_csv: csvRecord
    },
    raw: {
      html,
      csv: csvRecord
    }
  };
}
