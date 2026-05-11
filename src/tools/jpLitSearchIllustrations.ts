import {
  searchIllustrationsInputSchema,
  searchIllustrationsOutputSchema
} from "../lib/schemas.js";
import type { SearchIllustrationsOutput } from "../lib/schemas.js";
import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { withToolCache } from "../lib/toolCache.js";
import type { NextDigitalLibraryClient } from "../sources/nextDigitalLibrary/adapter.js";
import { NotFoundError } from "../lib/errors.js";

function buildIiifPageUrl(pid: string, page: number): string {
  const paddedPage = String(page).padStart(7, "0");
  return `https://dl.ndl.go.jp/api/iiif/${pid}/R${paddedPage}/full/full/0/default.jpg`;
}

function buildIiifRegionUrl(pid: string, page: number, x: number, y: number, w: number, h: number): string {
  const paddedPage = String(page).padStart(7, "0");
  const region = `pct:${x},${y},${w},${h}`;
  return `https://dl.ndl.go.jp/api/iiif/${pid}/R${paddedPage}/${region}/full/0/default.jpg`;
}

export function createJpLitSearchIllustrationsTool(
  nextDlClient: NextDigitalLibraryClient,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = searchIllustrationsInputSchema.parse(input);
    const { force_refresh, ...cacheableInput } = parsed;

    const result = await runCachedTool<SearchIllustrationsOutput>({
      tool: "jp_lit_search_illustrations",
      input: cacheableInput as Record<string, unknown>,
      cache,
      sessions,
      bypassCache: force_refresh,
      live: async () => {
        const result = await nextDlClient.searchIllustrations(parsed.keyword, {
          size: parsed.size,
          from: parsed.from
        });

        if (!result) {
          throw new NotFoundError("検索結果が取得できませんでした");
        }

        const rawList = Array.isArray(result.list) ? result.list : [];
        const items = rawList.map((item: unknown) => {
          const r = item as Record<string, unknown>;
          const pid = String(r["pid"] ?? "");
          const page = Number(r["page"] ?? 0);
          const x = Number(r["x"] ?? 0);
          const y = Number(r["y"] ?? 0);
          const w = Number(r["w"] ?? 0);
          const h = Number(r["h"] ?? 0);
          const rawTags = Array.isArray(r["graphictags"]) ? r["graphictags"] : [];
          const graphictags = rawTags.map((t: unknown) => {
            const tag = t as Record<string, unknown>;
            return {
              tagname: String(tag["tagname"] ?? ""),
              confidence: Number(tag["confidence"] ?? 0)
            };
          });

          return {
            id: String(r["id"] ?? ""),
            pid,
            viewer_url: `https://dl.ndl.go.jp/pid/${pid}`,
            page,
            x,
            y,
            w,
            h,
            graphictags,
            page_image_url: buildIiifPageUrl(pid, page),
            illustration_image_url: buildIiifRegionUrl(pid, page, x, y, w, h)
          };
        });

        const total = (result.hit ?? result.total ?? 0) as number;

        return searchIllustrationsOutputSchema.parse({
          keyword: parsed.keyword,
          total,
          from: parsed.from,
          items,
          raw: result
        });
      }
    });
    const structuredContent = searchIllustrationsOutputSchema.parse(
      withToolCache(result.structuredContent as Record<string, unknown>, result)
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
