import {
  deleteCacheInputSchema,
  deleteCacheOutputSchema
} from "../lib/schemas.js";
import type { DeleteCacheOutput } from "../lib/schemas.js";
import type { FileCache } from "../lib/persistence/fileCache.js";

export function createJpLitDeleteCacheTool(cache: FileCache) {
  return async (input: unknown) => {
    const parsed = deleteCacheInputSchema.parse(input);

    let deletedCount = 0;
    let deleted = false;
    if (parsed.clear_all) {
      deletedCount = await cache.clear(parsed.tool);
      deleted = deletedCount > 0;
    } else if (parsed.cache_key) {
      deleted = await cache.delete(parsed.tool, parsed.cache_key);
      deletedCount = deleted ? 1 : 0;
    }

    const structuredContent: DeleteCacheOutput = deleteCacheOutputSchema.parse({
      tool: parsed.tool,
      cache_key: parsed.cache_key ?? null,
      clear_all: parsed.clear_all,
      deleted_count: deletedCount,
      deleted,
      message: parsed.clear_all
        ? `${parsed.tool} のキャッシュを ${deletedCount} 件削除しました`
        : deleted
          ? `cache_key=${parsed.cache_key} を削除しました`
          : `cache_key=${parsed.cache_key} は見つかりませんでした`
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(structuredContent, null, 2)
        }
      ],
      structuredContent
    };
  };
}
