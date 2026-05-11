import { toIssuedFields } from "../archiveShared.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { SearchItem } from "../../lib/types.js";
import type { SearchResult } from "../types.js";
import { absolutizeUrl, cleanText, firstHref, htmlToText } from "./html.js";

const BASE_URL = "https://ronbun.nijl.ac.jp";

function parseTotal(html: string, itemCount: number) {
  const total = html.match(/検索結果：\s*([0-9,]+)件中/)?.[1]?.replace(/,/g, "");
  const parsed = total ? Number(total) : itemCount;
  return Number.isFinite(parsed) ? parsed : itemCount;
}

function parseCells(rowHtml: string) {
  const cell = rowHtml.match(/<td[^>]*>\s*<a[\s\S]*$/i)?.[0] ?? rowHtml;
  return htmlToText(cell)
    .split(",")
    .map((value) => normalizeText(value))
    .map((value) => value ?? "")
    .slice(0, 11);
}

function parseItems(html: string): SearchItem[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const items: SearchItem[] = [];

  for (const row of rows) {
    const rowHtml = row[1] ?? "";
    const anchor = rowHtml.match(/<a[^>]+href=["']([^"']*\/kokubun\/(\d{8}))["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor) {
      continue;
    }

    const sourceId = anchor[2]!;
    const title = cleanText(anchor[3]) ?? "Untitled";
    const fields = parseCells(rowHtml);
    const author = fields[1] || null;
    const journalTitle = fields[2] || null;
    const volume = fields[3] || null;
    const serialNumber = fields[4] || null;
    const issuedYear = fields[5] || null;
    const callNumber = fields[6] || null;
    const periodClassification = fields[7] || null;
    const field = fields[8] || null;
    const englishTitle = fields[9] || null;
    const englishJournal = fields[10] || null;
    const opacUrl = firstHref(rowHtml.match(/<a[^>]+href=["'][^"']*opac[^"']*["'][^>]*>[\s\S]*?<\/a>/i)?.[0]);

    items.push({
      source: "nijl_articles",
      source_id: sourceId,
      title,
      subtitle: null,
      title_reading: null,
      authors: compactStrings([author]).map((name) => ({ name, role: "author" })),
      publisher: null,
      journal_title: journalTitle,
      ...toIssuedFields(issuedYear),
      summary: null,
      url: `${BASE_URL}/kokubun/${sourceId}`,
      availability: {
        online: true,
        digital_collection: false
      },
      material_type: "論文",
      subjects: compactStrings([periodClassification, field]),
      table_of_contents: [],
      source_metadata: {
        nijl_article_id: sourceId,
        volume,
        serial_number: serialNumber,
        nijl_call_number: callNumber,
        opac_url: absolutizeUrl(BASE_URL, opacUrl),
        period_classification: periodClassification,
        field,
        english_title: englishTitle,
        english_journal: englishJournal
      },
      duplicate_key: null,
      duplicate_count: 1,
      related_records: []
    });
  }

  return items;
}

export function mapNijlArticlesSearchResponse(html: string): SearchResult {
  const items = parseItems(html);
  return {
    total: parseTotal(html, items.length),
    items
  };
}
