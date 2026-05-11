import { toIssuedFields } from "../archiveShared.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { SearchItem } from "../../lib/types.js";
import type { SearchResult } from "../types.js";
import { absolutizeUrl, cleanText, htmlToText } from "./html.js";

function parseTotal(html: string, itemCount: number) {
  const raw = html.match(/([0-9,]+)\s*件中/)?.[1]?.replace(/,/g, "");
  const total = raw ? Number(raw) : itemCount;
  return Number.isFinite(total) ? total : itemCount;
}

function parseItems(html: string): SearchItem[] {
  const blocks = [...html.matchAll(/<li[^>]+class=["'][^"']*media[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)];
  return blocks.flatMap((block): SearchItem[] => {
    const body = block[1] ?? "";
    const anchor = body.match(/<a[^>]+href=["']([^"']*\/bunken\/ja\/article\/(\d+))["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor) {
      return [];
    }

    const sourceId = anchor[2]!;
    const title = cleanText(anchor[3]) ?? "Untitled";
    const text = htmlToText(body)
      .replace(title, "")
      .replace(/^\d+\s+/, "")
      .trim();
    const parts = text.split(",").map((part) => normalizeText(part)).filter(Boolean) as string[];
    const author = parts[0] ?? null;
    const tail = parts.slice(1).join(", ");
    const date = tail.match(/(\d{4}(?:[./-]\d{1,2})?)\s*$/)?.[1] ?? null;

    return [{
      source: "ninjal_bibliography",
      source_id: sourceId,
      title,
      subtitle: null,
      title_reading: null,
      authors: compactStrings([author]).map((name) => ({ name, role: "author" })),
      publisher: null,
      journal_title: tail.replace(/\s*\d{4}(?:[./-]\d{1,2})?\s*$/, "") || null,
      ...toIssuedFields(date),
      summary: null,
      url: absolutizeUrl(anchor[1]) ?? `${absolutizeUrl(`/bunken/ja/article/${sourceId}`)}`,
      availability: {
        online: false,
        digital_collection: false
      },
      material_type: null,
      subjects: [],
      table_of_contents: [],
      source_metadata: {
        bibliography_id: sourceId
      },
      duplicate_key: null,
      duplicate_count: 1,
      related_records: []
    }];
  });
}

export function mapNinjalBibliographySearchResponse(html: string): SearchResult {
  const items = parseItems(html);
  return {
    total: parseTotal(html, items.length),
    items
  };
}
