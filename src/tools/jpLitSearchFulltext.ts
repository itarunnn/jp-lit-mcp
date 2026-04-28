import {
  searchFulltextInputSchema,
  searchFulltextOutputSchema
} from "../lib/schemas.js";
import type { SearchFulltextOutput } from "../lib/schemas.js";
import type { NextDigitalLibraryClient } from "../sources/nextDigitalLibrary/adapter.js";
import { NotFoundError } from "../lib/errors.js";

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

export function createJpLitSearchFulltextTool(nextDlClient: NextDigitalLibraryClient) {
  return async (input: unknown) => {
    const parsed = searchFulltextInputSchema.parse(input);

    const result = await nextDlClient.searchBooks(parsed.keyword, {
      searchfield: parsed.searchfield,
      size: parsed.size,
      from: parsed.from,
      fNdc: parsed.f_ndc,
      fcIsClassic: parsed.fc_is_classic
    });

    if (!result) {
      throw new NotFoundError("検索結果が取得できませんでした");
    }

    const rawList = Array.isArray(result.list) ? result.list : [];
    const items = rawList.map((item: unknown) => {
      const r = item as Record<string, unknown>;
      return {
        pid: str(r["id"]) ?? "",
        title: str(r["title"]),
        volume: str(r["volume"]),
        responsibility: str(r["responsibility"]),
        publisher: str(r["publisher"]),
        published: str(r["published"]),
        publishyear: num(r["publishyear"]),
        ndc: str(r["ndc"]),
        bib_id: str(r["bibId"]),
        call_no: str(r["callNo"]),
        page_count: num(r["page"]),
        is_classic: bool(r["isClassic"]),
        highlights: r["highlights"] ?? null
      };
    });

    const total = (result.hit ?? result.total ?? 0) as number;

    const structuredContent: SearchFulltextOutput = searchFulltextOutputSchema.parse({
      keyword: parsed.keyword,
      searchfield: parsed.searchfield,
      total,
      from: parsed.from,
      items,
      raw: result
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
