import { createCacheKey, normalizeCacheInput } from "./cacheKeys.js";
import type { FileCache } from "./fileCache.js";
import type { SessionStore } from "./sessionStore.js";
import type { CacheEnvelope, SessionEntry } from "./types.js";

interface RunCachedToolOptions<T> {
  tool: string;
  input: Record<string, unknown>;
  live: () => Promise<T>;
  cache: FileCache;
  sessions: SessionStore;
  bypassCache?: boolean;
  createSessionEntry?: (args: {
    input: Record<string, unknown>;
    cacheKey: string;
  }) => SessionEntry;
}

export async function runCachedTool<T>({
  tool,
  input,
  live,
  cache,
  sessions,
  bypassCache = false,
  createSessionEntry
}: RunCachedToolOptions<T>) {
  const normalizedInput = normalizeCacheInput(input);
  const cacheKey = createCacheKey(tool, normalizedInput);
  const entry =
    createSessionEntry?.({ input: normalizedInput, cacheKey }) ?? {
      tool,
      input: normalizedInput,
      cache_key: cacheKey,
      result_ref: {
        tool,
        cache_key: cacheKey
      },
      selected_items: [],
      notes: []
    };
  const cached = bypassCache ? null : await cache.read<T>(tool, cacheKey);

  if (cached) {
    await sessions.appendEntry(entry);

    return {
      cacheKey,
      cacheHit: true,
      savedAt: cached.saved_at,
      structuredContent: cached.structured_content
    };
  }

  const structuredContent = await live();
  const envelope: CacheEnvelope<T> = {
    version: 1,
    tool,
    cache_key: cacheKey,
    saved_at: new Date().toISOString(),
    input: normalizedInput,
    structured_content: structuredContent
  };

  await cache.write(tool, envelope);
  await sessions.appendEntry(entry);

  return {
    cacheKey,
    cacheHit: false,
    savedAt: envelope.saved_at,
    structuredContent
  };
}
