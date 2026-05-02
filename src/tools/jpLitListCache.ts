import { readdir } from "node:fs/promises";
import path from "node:path";

import { getCacheRoot, getLegacyCacheRoot } from "../lib/persistence/paths.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { resolveSavedDateFilter } from "../lib/savedDateFilter.js";
import { listCacheInputSchema, listCacheOutputSchema } from "../lib/schemas.js";
import type { ListCacheOutput, SearchOutput } from "../lib/schemas.js";

type CachedSummary = {
  tool: string;
  cache_key: string;
  saved_at: string;
  source: SearchOutput["source"] | null;
  session_ids: string[];
  query_preview: string | null;
  total: number;
  item_count: number;
};

function createPreview(value: string | null | undefined, maxLength = 120) {
  if (!value) {
    return null;
  }
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
}

export function createJpLitListCacheTool(
  cache: FileCache,
  sessions: SessionStore,
  baseDir = process.cwd()
) {
  return async (input: unknown) => {
    const parsed = listCacheInputSchema.parse(input);
    const { effectiveSavedFrom, effectiveSavedTo, resolvedSavedOn } =
      resolveSavedDateFilter(parsed);

    const allSessions = parsed.session_id
      ? [await sessions.readById(parsed.session_id)]
      : await sessions.listAll();
    const cacheToSessionIds = new Map<string, Set<string>>();
    for (const session of allSessions) {
      for (const entry of session.entries) {
        const ids = cacheToSessionIds.get(entry.cache_key) ?? new Set<string>();
        ids.add(session.session_id);
        cacheToSessionIds.set(entry.cache_key, ids);
      }
    }

    const cacheRoots = [getCacheRoot(baseDir), getLegacyCacheRoot(baseDir)];
    const targetTools = parsed.tool
      ? [parsed.tool]
      : Array.from(
          new Set(
            (
              await Promise.all(
                cacheRoots.map((root) => readdir(root).catch(() => [] as string[]))
              )
            ).flat()
          )
        );

    const summaries: CachedSummary[] = [];
    for (const tool of targetTools) {
      const cacheKeys = Array.from(
        new Set(
          (
            await Promise.all(
              cacheRoots.map((root) =>
                readdir(path.join(root, tool)).catch(() => [] as string[])
              )
            )
          )
            .flat()
            .filter((filename) => filename.endsWith(".json"))
            .map((filename) => filename.replace(/\.json$/i, ""))
        )
      );

      for (const cacheKey of cacheKeys) {
        const cached = await cache.read<Record<string, unknown>>(tool, cacheKey);
        if (!cached) {
          continue;
        }
        if (effectiveSavedFrom && cached.saved_at < effectiveSavedFrom) {
          continue;
        }
        if (effectiveSavedTo && cached.saved_at > effectiveSavedTo) {
          continue;
        }

        const sessionIds = Array.from(cacheToSessionIds.get(cacheKey) ?? []);
        if (parsed.session_id && !sessionIds.includes(parsed.session_id)) {
          continue;
        }

        const content = cached.structured_content as Partial<SearchOutput>;
        const source = typeof content.source === "string" ? content.source : null;
        if (parsed.source && source !== parsed.source) {
          continue;
        }

        const query =
          typeof content.query === "string"
            ? content.query
            : typeof cached.input.query === "string"
              ? cached.input.query
              : null;
        const itemCount = Array.isArray(content.items) ? content.items.length : 0;
        const total = typeof content.total === "number" ? content.total : itemCount;

        summaries.push({
          tool,
          cache_key: cacheKey,
          saved_at: cached.saved_at,
          source,
          session_ids: sessionIds,
          query_preview: createPreview(query),
          total,
          item_count: itemCount
        });
      }
    }

    summaries.sort((left, right) => right.saved_at.localeCompare(left.saved_at));
    const limited = summaries.slice(0, parsed.limit);
    const byTool: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const entry of summaries) {
      byTool[entry.tool] = (byTool[entry.tool] ?? 0) + 1;
      const sourceKey = entry.source ?? "unknown";
      bySource[sourceKey] = (bySource[sourceKey] ?? 0) + 1;
    }

    const structuredContent: ListCacheOutput = listCacheOutputSchema.parse({
      tool: parsed.tool ?? null,
      session_id: parsed.session_id ?? null,
      saved_on: parsed.saved_on ?? null,
      saved_on_resolved: resolvedSavedOn,
      saved_from: parsed.saved_from ?? null,
      saved_to: parsed.saved_to ?? null,
      source: parsed.source ?? null,
      total: summaries.length,
      limit: parsed.limit,
      cache_keys: limited.map((item) => item.cache_key),
      summary: {
        by_tool: byTool,
        by_source: bySource,
        newest_saved_at: summaries[0]?.saved_at ?? null,
        oldest_saved_at: summaries.at(-1)?.saved_at ?? null
      },
      items: limited
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
