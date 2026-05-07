import { decodeHtml, extractLabel, htmlToText, toIssuedFields } from "../archiveShared.js";
import type { SearchResult } from "../types.js";
import type { SearchItem } from "../../lib/types.js";

const BASE_URL = "https://www.digital.archives.go.jp";

function recordUrl(sourceId: string) {
  return `${BASE_URL}/file/${sourceId}.html`;
}

function parseItems(html: string): SearchItem[] {
  const anchors = [...html.matchAll(/<a[^>]+href=["']([^"']*\/file\/(\d+)(?:\.html)?)["'][^>]*>([\s\S]*?)<\/a>/gi)];

  return anchors.map((match) => {
    const sourceId = match[2]!;
    const title = decodeHtml(match[3]!) || "Untitled";
    const windowStart = Math.max(0, match.index ?? 0);
    const windowHtml = html.slice(windowStart, windowStart + 1000);
    const windowText = htmlToText(windowHtml);
    const callNumber = extractLabel(windowText, "請求番号");
    const hierarchy = extractLabel(windowText, "階層");
    const issuedLabel = extractLabel(windowText, "作成年月日");

    return {
      source: "national_archives",
      source_id: sourceId,
      title,
      subtitle: null,
      title_reading: null,
      authors: [],
      publisher: "国立公文書館",
      journal_title: null,
      ...toIssuedFields(issuedLabel),
      summary: null,
      url: recordUrl(sourceId),
      availability: {
        online: true,
        digital_collection: false
      },
      material_type: null,
      subjects: [],
      table_of_contents: [],
      source_metadata: {
        hierarchy,
        call_number: callNumber
      },
      duplicate_key: null,
      duplicate_count: 1,
      related_records: []
    };
  });
}

function parseTotal(html: string, itemCount: number) {
  const dataCount = html.match(/\bdata-count=["']?(\d+)["']?/i)?.[1];
  const total = dataCount ? Number(dataCount) : itemCount;
  return Number.isFinite(total) ? total : itemCount;
}

export function mapNationalArchivesSearchResponse(html: string): SearchResult {
  const items = parseItems(html);

  return {
    total: parseTotal(html, items.length),
    items
  };
}
