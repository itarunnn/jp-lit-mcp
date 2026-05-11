import { toIssuedFields } from "../archiveShared.js";
import { compactStrings } from "../../lib/normalize.js";
import type { RecordItem } from "../../lib/types.js";
import {
  absolutizeUrl,
  cleanText,
  splitTerms,
  uniqueStrings
} from "./html.js";

function extractFields(html: string) {
  const fields = new Map<string, { value: string | null; html: string }>();
  const pattern = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;

  for (const match of html.matchAll(pattern)) {
    const label = cleanText(match[1]);
    if (!label) {
      continue;
    }
    fields.set(label, {
      value: cleanText(match[2]),
      html: match[2] ?? ""
    });
  }

  return fields;
}

function links(html: string | undefined) {
  return uniqueStrings(
    [...(html ?? "").matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
      .map((match) => absolutizeUrl(match[1] ?? null))
      .filter((value): value is string => Boolean(value))
  );
}

export function mapNinjalBibliographyRecordResponse(
  sourceId: string,
  html: string
): RecordItem {
  const fields = extractFields(html);
  const bibliographyId = fields.get("文献ID")?.value ?? sourceId;
  const dbKind = fields.get("DB")?.value ?? null;
  const articleTitle = fields.get("論文名")?.value;
  const bookTitle = fields.get("誌名・書名")?.value;
  const authors =
    fields.get("論文著者名")?.value ??
    fields.get("図書編著者名")?.value;
  const keywords = splitTerms(fields.get("キーワード")?.value);
  const fieldsTerms = splitTerms(fields.get("分野")?.value);
  const fulltextLinks = links(fields.get("関連情報URL")?.html);
  const url = absolutizeUrl(`/bunken/ja/article/${bibliographyId}`)!;
  const volume = fields.get("巻号")?.value ?? null;
  const pages = fields.get("ページ")?.value ?? null;

  return {
    source: "ninjal_bibliography",
    source_id: bibliographyId,
    title: articleTitle ?? bookTitle ?? "Untitled",
    subtitle: null,
    title_reading: null,
    authors: compactStrings([authors]).map((name) => ({ name, role: "author" })),
    publisher: fields.get("発行")?.value ?? null,
    journal_title: bookTitle ?? null,
    ...toIssuedFields(fields.get("発行年月")?.value),
    summary: null,
    url,
    availability: {
      online: fulltextLinks.length > 0,
      digital_collection: false
    },
    alternative_titles: compactStrings([
      fields.get("論文名別表記")?.value,
      fields.get("誌名・書名別表記")?.value
    ]),
    publication_place: fields.get("発行地域")?.value ?? null,
    language: fields.get("記述言語")?.value ?? null,
    material_type: dbKind,
    extent: compactStrings([volume, pages]).join(" / ") || null,
    subjects: uniqueStrings([...fieldsTerms, ...keywords]),
    identifiers: {
      ...(fields.get("ISBN")?.value ? { isbn: fields.get("ISBN")?.value } : {}),
      ...(fields.get("ISSN")?.value ? { issn: fields.get("ISSN")?.value } : {})
    },
    table_of_contents: compactStrings([fields.get("章タイトル・目次")?.value]),
    content_access: {
      has_page_images: false,
      has_text_coordinates: false,
      viewer_url: fulltextLinks[0] ?? url,
      access_note: fulltextLinks.length > 0 ? "本文リンクあり。本文は取得していません。" : null
    },
    source_metadata: {
      bibliography_id: bibliographyId,
      db_kind: dbKind,
      library_call_number: fields.get("研究図書室請求記号")?.value ?? null,
      alternate_authors: fields.get("論文著者名別表記")?.value ?? fields.get("図書編著者名別表記")?.value ?? null,
      alternate_title: fields.get("論文名別表記")?.value ?? null,
      volume,
      pages,
      keywords,
      chapter_titles: compactStrings([fields.get("章タイトル・目次")?.value]),
      fields: fieldsTerms,
      isbn: fields.get("ISBN")?.value ?? null,
      issn: fields.get("ISSN")?.value ?? null,
      fulltext_links: fulltextLinks,
      related_information: fields.get("関連情報")?.value ?? null,
      raw_fields: Object.fromEntries(
        Array.from(fields.entries()).map(([label, entry]) => [label, entry.value])
      )
    },
    raw: {
      html
    }
  };
}
