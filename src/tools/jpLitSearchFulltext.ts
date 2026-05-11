import {
  searchFulltextInputSchema,
  searchFulltextOutputSchema
} from "../lib/schemas.js";
import type { SearchFulltextOutput } from "../lib/schemas.js";
import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { withToolCache } from "../lib/toolCache.js";
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

export function createJpLitSearchFulltextTool(
  nextDlClient: NextDigitalLibraryClient,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = searchFulltextInputSchema.parse(input);
    const { force_refresh, ...cacheableInput } = parsed;

    const result = await runCachedTool<SearchFulltextOutput>({
      tool: "jp_lit_search_fulltext",
      input: cacheableInput as Record<string, unknown>,
      cache,
      sessions,
      bypassCache: force_refresh,
      live: async () => {
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
          const pid = str(r["id"]) ?? "";
          return {
            pid,
            viewer_url: `https://dl.ndl.go.jp/pid/${pid}`,
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

        return searchFulltextOutputSchema.parse({
          keyword: parsed.keyword,
          searchfield: parsed.searchfield,
          total,
          from: parsed.from,
          items,
          raw: result
        });
      }
    });
    const structuredContent = searchFulltextOutputSchema.parse(
      withToolCache(result.structuredContent as Record<string, unknown>, result)
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
