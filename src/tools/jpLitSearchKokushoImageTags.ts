import {
  searchKokushoImageTagsInputSchema,
  searchKokushoImageTagsOutputSchema
} from "../lib/schemas.js";
import type { SearchKokushoImageTagsOutput } from "../lib/schemas.js";
import { NotFoundError } from "../lib/errors.js";
import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { buildToolCacheInfo } from "../lib/toolCache.js";
import { networkRestrictionError } from "../sources/archiveShared.js";
import type { KokushoClient } from "../sources/kokusho/client.js";
import { mapKokushoImageTagsResponse } from "../sources/kokusho/mapImageTags.js";

function addCacheInfo(
  output: SearchKokushoImageTagsOutput,
  cache: { cacheHit: boolean; cacheKey: string; savedAt: string }
) {
  return searchKokushoImageTagsOutputSchema.parse({
    ...output,
    cache: buildToolCacheInfo(cache)
  });
}

export function createJpLitSearchKokushoImageTagsTool(
  client: KokushoClient,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = searchKokushoImageTagsInputSchema.parse(input);
    const { force_refresh, ...cacheableInput } = parsed;

    const result = await runCachedTool<SearchKokushoImageTagsOutput>({
      tool: "jp_lit_search_kokusho_image_tags",
      input: cacheableInput,
      cache,
      sessions,
      bypassCache: force_refresh,
      live: async () => {
        try {
          const payload = await client.searchImageTags(parsed.keyword, parsed.page);
          const mapped = mapKokushoImageTagsResponse(payload, parsed.limit);
          if (!mapped) {
            throw new NotFoundError("国書DB画像タグ検索結果が取得できませんでした");
          }

          return searchKokushoImageTagsOutputSchema.parse({
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
