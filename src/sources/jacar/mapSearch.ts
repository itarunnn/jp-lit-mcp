import { decodeHtml, extractLabel, htmlToText, toIssuedFields } from "../archiveShared.js";
import type { SearchItem } from "../../lib/types.js";
import type { SearchResult } from "../types.js";

const BASE_URL = "https://www.jacar.archives.go.jp";

function recordUrl(sourceId: string) {
  return `${BASE_URL}/das/meta/${sourceId}`;
}

function parseItems(html: string): SearchItem[] {
  const anchors = [...html.matchAll(/<a[^>]+href=["']([^"']*\/das\/meta\/([A-Z]\d{10,}))["'][^>]*>([\s\S]*?)<\/a>/gi)];

  return anchors.map((match) => {
    const sourceId = match[2]!;
    const title = decodeHtml(match[3]!) || "Untitled";
    const windowStart = Math.max(0, match.index ?? 0);
    const windowText = htmlToText(html.slice(windowStart, windowStart + 1000));
    const hierarchy = extractLabel(windowText, "階層");
    const issuedLabel = extractLabel(windowText, "作成年月日");

    return {
      source: "jacar",
      source_id: sourceId,
      title,
      subtitle: null,
      title_reading: null,
      authors: [],
      publisher: null,
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
        reference_code: sourceId
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

export function mapJacarSearchResponse(html: string): SearchResult {
  const items = parseItems(html);
  return {
    total: parseTotal(html, items.length),
    items
  };
}
