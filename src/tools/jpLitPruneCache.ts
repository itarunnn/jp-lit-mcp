import {
  pruneCacheInputSchema,
  pruneCacheOutputSchema
} from "../lib/schemas.js";
import type { PruneCacheOutput } from "../lib/schemas.js";
import {
  listCacheInventory,
  removeInventoryItem
} from "../lib/persistence/cacheInventory.js";

function cutoffFrom(now: Date, olderThanDays: number) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - olderThanDays);
  return cutoff.toISOString();
}

export function createJpLitPruneCacheTool(
  baseDir = process.cwd(),
  now = () => new Date()
) {
  return async (input: unknown) => {
    const parsed = pruneCacheInputSchema.parse(input);
    const cutoff = cutoffFrom(now(), parsed.older_than_days);
    const inventory = await listCacheInventory(baseDir, parsed.tool);
    const candidates = inventory.items
      .filter((item) => item.saved_at < cutoff)
      .sort((left, right) => left.saved_at.localeCompare(right.saved_at))
      .slice(0, parsed.limit);

    let prunedCount = 0;
    if (!parsed.dry_run) {
      for (const candidate of candidates) {
        await removeInventoryItem(candidate, baseDir);
        prunedCount += 1;
      }
    }

    const totalBytes = candidates.reduce((sum, item) => sum + item.bytes, 0);
    const structuredContent: PruneCacheOutput = pruneCacheOutputSchema.parse({
      dry_run: parsed.dry_run,
      older_than_days: parsed.older_than_days,
      cutoff_saved_at: cutoff,
      tool: parsed.tool ?? null,
      limit: parsed.limit,
      matched_count: candidates.length,
      pruned_count: prunedCount,
      total_bytes: totalBytes,
      candidates: candidates.map(({ tool, cache_key, saved_at, bytes, root }) => ({
        tool,
        cache_key,
        saved_at,
        bytes,
        root
      })),
      skipped_count: inventory.skipped.length,
      skipped: inventory.skipped,
      message: parsed.dry_run
        ? `${candidates.length} 件の削除候補があります。削除するには dry_run=false を指定してください。`
        : `${prunedCount} 件のキャッシュを削除しました。`
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
