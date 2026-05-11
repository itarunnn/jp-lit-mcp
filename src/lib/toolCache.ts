export interface ToolCacheRunInfo {
  cacheHit: boolean;
  cacheKey: string;
  savedAt: string;
}

export function buildToolCacheInfo({ cacheHit, cacheKey, savedAt }: ToolCacheRunInfo) {
  return {
    hit: cacheHit,
    cache_key: cacheKey,
    saved_at: savedAt,
    refresh_hint: cacheHit
      ? `キャッシュ結果です（保存日時: ${savedAt}）。上流APIへは再検索していません。最新データで再検索したい場合は force_refresh=true を指定してください。`
      : null
  };
}

export function withToolCache<T extends Record<string, unknown>>(
  structuredContent: T,
  cacheInfo: ToolCacheRunInfo
) {
  return {
    ...structuredContent,
    cache: buildToolCacheInfo(cacheInfo)
  };
}
