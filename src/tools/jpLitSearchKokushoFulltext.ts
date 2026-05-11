import {
  searchKokushoFulltextInputSchema,
  searchKokushoFulltextOutputSchema
} from "../lib/schemas.js";
import type { SearchKokushoFulltextOutput } from "../lib/schemas.js";
import { NotFoundError } from "../lib/errors.js";
import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { buildToolCacheInfo } from "../lib/toolCache.js";
import { networkRestrictionError } from "../sources/archiveShared.js";
import type { KokushoClient } from "../sources/kokusho/client.js";
import { mapKokushoFulltextResponse } from "../sources/kokusho/mapFulltext.js";

function addCacheInfo(
  output: SearchKokushoFulltextOutput,
  cache: { cacheHit: boolean; cacheKey: string; savedAt: string }
) {
  return searchKokushoFulltextOutputSchema.parse({
    ...output,
    cache: buildToolCacheInfo(cache)
  });
}

export function createJpLitSearchKokushoFulltextTool(
  client: KokushoClient,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = searchKokushoFulltextInputSchema.parse(input);
    const { force_refresh, ...cacheableInput } = parsed;

    const result = await runCachedTool<SearchKokushoFulltextOutput>({
      tool: "jp_lit_search_kokusho_fulltext",
      input: cacheableInput,
      cache,
      sessions,
      bypassCache: force_refresh,
      live: async () => {
        try {
          const payload = await client.searchFulltext(parsed.keyword);
          const mapped = mapKokushoFulltextResponse(payload, parsed.page, parsed.limit);
          if (!mapped) {
            throw new NotFoundError("国書DB全文検索結果が取得できませんでした");
          }

          return searchKokushoFulltextOutputSchema.parse({
            keyword: parsed.keyword,
            page: parsed.page,
            limit: parsed.limit,
            total: mapped.total,
            items: mapped.items,
            raw: mapped.raw
          });
        } catch (error) {
          if (error instanceof NotFoundError) {
            throw error;
          }
          throw networkRestrictionError(error);
        }
      }
    });

    const structuredContent = addCacheInfo(result.structuredContent, result);

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
