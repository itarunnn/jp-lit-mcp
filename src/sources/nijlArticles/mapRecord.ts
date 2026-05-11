import { toIssuedFields } from "../archiveShared.js";
import { compactStrings } from "../../lib/normalize.js";
import type { RecordItem } from "../../lib/types.js";
import {
  absolutizeUrl,
  cleanText,
  firstHref,
  splitSubject
} from "./html.js";

const BASE_URL = "https://ronbun.nijl.ac.jp";

function extractRows(html: string) {
  const rows = new Map<string, { value: string | null; html: string }>();
  const pattern = /<tr[^>]*>\s*<td[^>]*>\s*<label[^>]*>([\s\S]*?):\s*<\/label>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;

  for (const match of html.matchAll(pattern)) {
    const label = cleanText(match[1])?.replace(/:$/, "");
    if (!label) {
      continue;
    }

    rows.set(label, {
      value: cleanText(match[2]),
      html: match[2] ?? ""
    });
  }

  return rows;
}

export function mapNijlArticlesRecordResponse(sourceId: string, html: string): RecordItem {
  const rows = extractRows(html);
  const recordId = rows.get("ID")?.value ?? sourceId;
  const subject = splitSubject(rows.get("時代分類-分野")?.value ?? null);
  const opacRow = rows.get("請求");
  const opacUrl = absolutizeUrl(BASE_URL, firstHref(opacRow?.html));
  const callNumber = opacRow?.value ?? null;
  const url = `${BASE_URL}/kokubun/${recordId}`;
  const issuedLabel = rows.get("発表年月日")?.value ?? null;

  return {
    source: "nijl_articles",
    source_id: recordId,
    title: rows.get("題名")?.value ?? "Untitled",
    subtitle: null,
    title_reading: null,
    authors: compactStrings([rows.get("執筆者名")?.value]).map((name) => ({
      name,
      role: "author"
    })),
    publisher: null,
    journal_title: rows.get("誌著名")?.value ?? null,
    ...toIssuedFields(issuedLabel),
    summary: null,
    url,
    availability: {
      online: true,
      digital_collection: false
    },
    alternative_titles: [],
    publication_place: null,
    language: rows.get("言語")?.value ?? null,
    material_type: "論文",
    extent: rows.get("巻号")?.value ?? null,
    subjects: compactStrings([subject.periodClassification, subject.field]),
    identifiers: {
      nijl_article_id: recordId,
      ...(callNumber ? { nijl_call_number: callNumber } : {})
    },
    table_of_contents: [],
    content_access: {
      has_page_images: false,
      has_text_coordinates: false,
      viewer_url: url,
      access_note: "HTML best-effort metadata only"
    },
    source_metadata: {
      nijl_article_id: recordId,
      volume: rows.get("巻号")?.value ?? null,
      period_classification: subject.periodClassification,
      field: subject.field,
      nijl_call_number: callNumber,
      opac_url: opacUrl,
      raw_fields: Object.fromEntries(
        Array.from(rows.entries()).map(([label, entry]) => [label, entry.value])
      )
    },
    raw: {
      html
    }
  };
}
