import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import type { SessionEntry } from "../src/lib/persistence/types.js";
import type { SearchItem } from "../src/lib/types.js";
import type { EnrichRecordOutput } from "../src/lib/schemas.js";
import { createJpLitRefineResultsTool } from "../src/tools/jpLitRefineResults.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-refine-results-"));
  tempDirs.push(dir);
  return dir;
}

function createSearchItem(
  source: SearchItem["source"],
  sourceId: string,
  title: string,
  issuedAt: string | null,
  online = false,
  author = "著者A"
): SearchItem {
  return {
    source,
    source_id: sourceId,
    title,
    subtitle: null,
    title_reading: null,
    authors: [{ name: author, role: "author" }],
    publisher: null,
    journal_title: null,
    issued_at: issuedAt,
    issued_at_label: issuedAt,
    issued_at_precision: issuedAt ? "year" : "unknown",
    summary: null,
    url: null,
    availability: {
      online,
      digital_collection: true
    },
    material_type: null,
    subjects: [],
    table_of_contents: [],
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

function createSearchEntry(cacheKey: string): SessionEntry {
  return {
    tool: "jp_lit_search",
    input: { query: "夏目漱石" },
    cache_key: cacheKey,
    result_ref: {
      tool: "jp_lit_search",
      cache_key: cacheKey
    },
    selected_items: [],
    notes: []
  };
}

function createEnrichEntry(cacheKey: string): SessionEntry {
  return {
    tool: "jp_lit_enrich_record",
    input: {
      title: "日本文学史",
      authors: ["佐藤 一郎"],
      issued_year: "1999",
      providers: ["crossref", "openalex"]
    },
    cache_key: cacheKey,
    result_ref: {
      tool: "jp_lit_enrich_record",
      cache_key: cacheKey
    },
    selected_items: [],
    notes: []
  };
}

function createEnrichOutput(): EnrichRecordOutput {
  return {
    query: {
      doi: null,
      title: "日本文学史",
      authors: ["佐藤 一郎"],
      issued_year: "1999"
    },
    providers: {
      crossref: { status: "ok", item_count: 1, note: null },
      openalex: { status: "skipped", item_count: 0, note: "OPENALEX_API_KEY is not set." }
    },
    matches: [
      {
        provider: "crossref",
        id: "10.1234/bungakushi",
        doi: "10.1234/bungakushi",
        title: "日本文学史",
        authors: ["佐藤 一郎"],
        issued_year: "1999",
        url: "https://doi.org/10.1234/bungakushi",
        cited_by_count: 3,
        source_title: "日本文学",
        type: "journal-article",
        match_confidence: "high",
        reasons: ["title_match", "author_overlap", "year_match"],
        missing: [],
        caution: "Crossref/OpenAlex の一致は書誌確認の補助で、本文到達性や重要度を保証しません。"
      }
    ],
    caution: "Crossref/OpenAlex の一致は書誌確認の補助で、本文到達性や重要度を保証しません。"
  };
}

function createNoisyEnrichOutput(): EnrichRecordOutput {
  return {
    query: {
      doi: null,
      title: "日本文学史",
      authors: ["佐藤 一郎"],
      issued_year: "1999"
    },
    providers: {
      crossref: { status: "ok", item_count: 1, note: null },
      openalex: { status: "ok", item_count: 1, note: null }
    },
    matches: [
      {
        provider: "crossref",
        id: "10.9999/wrong-title",
        doi: "10.9999/wrong-title",
        title: "別の文学史",
        authors: ["別人"],
        issued_year: "1999",
        url: "https://doi.org/10.9999/wrong-title",
        cited_by_count: 99,
        source_title: "Noisy Journal",
        type: "journal-article",
        match_confidence: "low",
        reasons: ["year_match"],
        missing: ["title_match", "author_overlap"],
        caution: "Crossref/OpenAlex の一致は書誌確認の補助で、本文到達性や重要度を保証しません。"
      },
      {
        provider: "openalex",
        id: "W0",
        doi: null,
        title: "関係しない候補",
        authors: [],
        issued_year: null,
        url: null,
        cited_by_count: null,
        source_title: null,
        type: null,
        match_confidence: "none",
        reasons: [],
        missing: ["title_match", "year_match", "author_overlap"],
        caution: "Crossref/OpenAlex の一致は書誌確認の補助で、本文到達性や重要度を保証しません。"
      }
    ],
    caution: "Crossref/OpenAlex の一致は書誌確認の補助で、本文到達性や重要度を保証しません。"
  };
}

function createDoiOnlyEnrichOutput(): EnrichRecordOutput {
  return {
    query: {
      doi: "10.1234/doi-only",
      title: null,
      authors: [],
      issued_year: null
    },
    providers: {
      crossref: { status: "ok", item_count: 1, note: null }
    },
    matches: [
      {
        provider: "crossref",
        id: "10.1234/doi-only",
        doi: "10.1234/doi-only",
        title: "DOI一致資料",
        authors: ["田中 花子"],
        issued_year: "2001",
        url: "https://doi.org/10.1234/doi-only",
        cited_by_count: 1,
        source_title: "日本文学",
        type: "journal-article",
        match_confidence: "high",
        reasons: ["doi_match"],
        missing: [],
        caution: "Crossref/OpenAlex の一致は書誌確認の補助で、本文到達性や重要度を保証しません。"
      }
    ],
    caution: "Crossref/OpenAlex の一致は書誌確認の補助で、本文到達性や重要度を保証しません。"
  };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_refine_results", () => {
  it("直近の jp_lit_search 結果を issued_at で昇順ソートする", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const cacheKey = "latest-key";

    await sessions.appendEntry(createSearchEntry(cacheKey));
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: cacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "夏目漱石" },
      structured_content: {
        query: "夏目漱石",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 3,
        items: [
          createSearchItem("ndl_catalog", "c", "C", "1914"),
          createSearchItem("ndl_catalog", "a", "A", "1905"),
          createSearchItem("ndl_catalog", "b", "B", "1906")
        ]
      }
    });

    const result = await tool({
      sort_by: "issued_at",
      sort_order: "asc"
    });

    expect(result.structuredContent.base_cache_key).toBe(cacheKey);
    expect(result.structuredContent.base_cache_keys).toEqual([cacheKey]);
    expect(result.structuredContent.combine).toBe("union");
    expect(result.structuredContent.key_by).toBe("source_record");
    expect(result.structuredContent.limit).toBe(30);
    expect(result.structuredContent.total_before).toBe(3);
    expect(result.structuredContent.total_after).toBe(3);
    expect(result.structuredContent.totals_by_base).toEqual([
      { cache_key: cacheKey, total: 3 }
    ]);
    expect(result.structuredContent.items.map((item) => item.source_id)).toEqual([
      "a",
      "b",
      "c"
    ]);
  });

  it("cache_key 指定で対象結果を選び、source/title/online フィルタを適用する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const firstKey = "first-key";
    const secondKey = "second-key";

    await sessions.appendEntry(createSearchEntry(firstKey));
    await sessions.appendEntry(createSearchEntry(secondKey));

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: firstKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "夏目漱石" },
      structured_content: {
        query: "夏目漱石",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "old", "古い結果", "1900")]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: secondKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "夏目漱石" },
      structured_content: {
        query: "夏目漱石",
        source: null,
        page: 1,
        limit: 48,
        total: 3,
        items: [
          createSearchItem("ndl_catalog", "1", "坊っちゃん", "1906", true, "夏目 漱石"),
          createSearchItem("cinii_books", "2", "こころ", "1914", true, "夏目 漱石"),
          createSearchItem("ndl_catalog", "3", "門", "1910", false, "夏目 漱石")
        ]
      }
    });

    const result = await tool({
      cache_key: secondKey,
      sort_by: "title",
      sort_order: "desc",
      filters: {
        source: "ndl_catalog",
        online: true,
        title_contains: "坊",
        author_contains: "漱石"
      }
    });

    expect(result.structuredContent.base_cache_key).toBe(secondKey);
    expect(result.structuredContent.base_cache_keys).toEqual([secondKey]);
    expect(result.structuredContent.total_before).toBe(3);
    expect(result.structuredContent.total_after).toBe(1);
    expect(result.structuredContent.items.map((item) => item.source_id)).toEqual(["1"]);
  });

  it("cache_key 明示指定なら現在セッション外の過去キャッシュも再抽出できる", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const cacheKey = "past-key";

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: cacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "過去" },
      structured_content: {
        query: "過去",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "past", "過去資料", "1900")]
      }
    });

    const result = await tool({ cache_key: cacheKey });

    expect(result.structuredContent.base_cache_keys).toEqual([cacheKey]);
    expect(result.structuredContent.items.map((item) => item.source_id)).toEqual(["past"]);
  });

  it("cache_keys + union で複数キャッシュを統合し重複を除去する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const keyA = "union-a";
    const keyB = "union-b";

    await sessions.appendEntry(createSearchEntry(keyA));
    await sessions.appendEntry(createSearchEntry(keyB));

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: keyA,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "Q1" },
      structured_content: {
        query: "Q1",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 2,
        items: [
          createSearchItem("ndl_catalog", "A1", "A-1", "1901"),
          createSearchItem("ndl_catalog", "A2", "A-2", "1902")
        ]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: keyB,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "Q2" },
      structured_content: {
        query: "Q2",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 2,
        items: [
          createSearchItem("ndl_catalog", "A2", "A-2", "1902"),
          createSearchItem("ndl_catalog", "B1", "B-1", "1910")
        ]
      }
    });

    const result = await tool({
      cache_keys: [keyA, keyB],
      combine: "union",
      key_by: "source_record",
      sort_by: "issued_at",
      sort_order: "asc"
    });

    expect(result.structuredContent.base_cache_keys).toEqual([keyA, keyB]);
    expect(result.structuredContent.total_before).toBe(3);
    expect(result.structuredContent.total_after).toBe(3);
    expect(result.structuredContent.items.map((item) => item.source_id)).toEqual([
      "A1",
      "A2",
      "B1"
    ]);
  });

  it("intersection で共通集合を再抽出できる", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const keyA = "intersect-a";
    const keyB = "intersect-b";

    await sessions.appendEntry(createSearchEntry(keyA));
    await sessions.appendEntry(createSearchEntry(keyB));

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: keyA,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "Q1" },
      structured_content: {
        query: "Q1",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 2,
        items: [
          createSearchItem("ndl_catalog", "X", "共通", "1905"),
          createSearchItem("ndl_catalog", "Y", "片側", "1910")
        ]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: keyB,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "Q2" },
      structured_content: {
        query: "Q2",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 2,
        items: [
          createSearchItem("ndl_catalog", "X", "共通", "1905"),
          createSearchItem("ndl_catalog", "Z", "別", "1915")
        ]
      }
    });

    const result = await tool({
      cache_keys: [keyA, keyB],
      combine: "intersection"
    });

    expect(result.structuredContent.total_before).toBe(1);
    expect(result.structuredContent.items.map((item) => item.source_id)).toEqual(["X"]);
  });

  it("minus で先頭集合から後続集合を差し引ける", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const keyA = "minus-a";
    const keyB = "minus-b";

    await sessions.appendEntry(createSearchEntry(keyA));
    await sessions.appendEntry(createSearchEntry(keyB));

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: keyA,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "Q1" },
      structured_content: {
        query: "Q1",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 2,
        items: [
          createSearchItem("ndl_catalog", "K1", "残す", "1901"),
          createSearchItem("ndl_catalog", "K2", "除く", "1902")
        ]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: keyB,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "Q2" },
      structured_content: {
        query: "Q2",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "K2", "除く", "1902")]
      }
    });

    const result = await tool({
      cache_keys: [keyA, keyB],
      combine: "minus"
    });

    expect(result.structuredContent.total_before).toBe(1);
    expect(result.structuredContent.items.map((item) => item.source_id)).toEqual(["K1"]);
  });

  it("session_id 指定でセッション内の複数検索結果を対象にできる", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);

    const sessionA = await sessions.appendEntry(createSearchEntry("s1-a"));
    await sessions.appendEntry(createSearchEntry("s1-b"));
    await sessions.appendEntry(createSearchEntry("s2-a"));

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "s1-a",
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "Q1" },
      structured_content: {
        query: "Q1",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "S1A", "S1-A", "1900")]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "s1-b",
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "Q2" },
      structured_content: {
        query: "Q2",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "S1B", "S1-B", "1901")]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "s2-a",
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "Q3" },
      structured_content: {
        query: "Q3",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "S2A", "S2-A", "1902")]
      }
    });

    const result = await tool({
      session_id: sessionA.session_id,
      combine: "union"
    });

    expect(result.structuredContent.base_cache_keys).toEqual(["s1-a", "s1-b", "s2-a"]);
    expect(result.structuredContent.items.map((item) => item.source_id)).toEqual([
      "S1A",
      "S1B",
      "S2A"
    ]);
  });

  it("jp_lit_search 結果が無い場合はエラーを返す", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);

    await expect(tool({})).rejects.toThrow(
      "現在セッションに jp_lit_search の結果がありません"
    );
  });

  it("既定では整理後の先頭30件だけを返す", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const cacheKey = "limit-key";

    await sessions.appendEntry(createSearchEntry(cacheKey));
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: cacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "大量" },
      structured_content: {
        query: "大量",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 40,
        items: Array.from({ length: 40 }, (_, index) =>
          createSearchItem(
            "ndl_catalog",
            `id-${index + 1}`,
            `資料${index + 1}`,
            String(1900 + index)
          )
        )
      }
    });

    const result = await tool({
      sort_by: "issued_at",
      sort_order: "asc"
    });

    expect(result.structuredContent.total_after).toBe(40);
    expect(result.structuredContent.limit).toBe(30);
    expect(result.structuredContent.items).toHaveLength(30);
    expect(result.structuredContent.items[0]?.source_id).toBe("id-1");
    expect(result.structuredContent.items.at(-1)?.source_id).toBe("id-30");
  });

  it("重複クラスタは明示されたときだけ返す", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const cacheKey = "cluster-key";

    await sessions.appendEntry(createSearchEntry(cacheKey));
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: cacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "文学史" },
      structured_content: {
        query: "文学史",
        source: null,
        page: 1,
        limit: 50,
        total: 2,
        items: [
          createSearchItem("ndl_catalog", "cluster-1", "日本文学史", "1999", false, "佐藤 一郎"),
          createSearchItem("cinii_books", "cluster-2", "日本文学史", "1999", false, "佐藤 一郎")
        ]
      }
    });

    const result = await tool({ cache_key: cacheKey });
    expect(result.structuredContent).not.toHaveProperty("cluster_summary");
    expect(result.structuredContent).not.toHaveProperty("clusters");

    const clustered = await tool({
      cache_key: cacheKey,
      include_duplicate_clusters: true,
      cluster_limit: 10,
      cluster_member_limit: 3
    });

    expect(clustered.structuredContent.cluster_summary?.total_items_considered)
      .toBeGreaterThanOrEqual(clustered.structuredContent.total_after);
    expect(clustered.structuredContent.cluster_summary?.cluster_count).toBe(1);
    expect(clustered.structuredContent.clusters?.[0]?.member_count).toBe(2);
  });

  it("union の重複クラスタは key_by で畳まれる前の候補から作る", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const cacheKey = "cluster-raw-key";

    await sessions.appendEntry(createSearchEntry(cacheKey));
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: cacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "文学史" },
      structured_content: {
        query: "文学史",
        source: null,
        page: 1,
        limit: 50,
        total: 2,
        items: [
          createSearchItem("ndl_catalog", "raw-1", "日本文学史", "1999", false, "佐藤 一郎"),
          createSearchItem("cinii_books", "raw-2", "日本文学史", "1999", false, "佐藤 一郎")
        ]
      }
    });

    const clustered = await tool({
      cache_key: cacheKey,
      key_by: "title_author_year",
      include_duplicate_clusters: true
    });

    expect(clustered.structuredContent.total_after).toBe(1);
    expect(clustered.structuredContent.cluster_summary?.total_items_considered).toBe(2);
    expect(clustered.structuredContent.clusters?.[0]?.member_count).toBe(2);
  });

  it("保存済み jp_lit_enrich_record cache を重複クラスタに任意で付与する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const searchCacheKey = "cluster-enrich-search";
    const enrichCacheKey = "cluster-enrich-record";

    await sessions.appendEntry(createSearchEntry(searchCacheKey));
    await sessions.appendEntry(createEnrichEntry(enrichCacheKey));
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: searchCacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "文学史" },
      structured_content: {
        query: "文学史",
        source: null,
        page: 1,
        limit: 50,
        total: 2,
        items: [
          createSearchItem("ndl_catalog", "enrich-1", "日本文学史", "1999", false, "佐藤 一郎"),
          createSearchItem("cinii_books", "enrich-2", "日本文学史", "1999", false, "佐藤 一郎")
        ]
      }
    });
    await cache.write("jp_lit_enrich_record", {
      version: 1,
      tool: "jp_lit_enrich_record",
      cache_key: enrichCacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: {
        title: "日本文学史",
        authors: ["佐藤 一郎"],
        issued_year: "1999",
        providers: ["crossref", "openalex"]
      },
      structured_content: createEnrichOutput()
    });

    const clustered = await tool({
      cache_key: searchCacheKey,
      include_duplicate_clusters: true,
      include_enrichment: true
    });

    const enrichment = clustered.structuredContent.clusters?.[0]?.enrichment;
    expect(enrichment?.matched_cache_keys).toEqual([enrichCacheKey]);
    expect(enrichment?.identifiers.doi).toBe("10.1234/bungakushi");
    expect(enrichment?.match_confidence).toBe("high");
    expect(enrichment?.evidence_level).toEqual({
      bibliographic: "confirmed",
      abstract: "not_checked",
      fulltext: "not_checked"
    });
    expect(enrichment?.matched_records).toEqual([
      expect.objectContaining({
        provider: "crossref",
        id: "10.1234/bungakushi",
        doi: "10.1234/bungakushi",
        match_confidence: "high"
      })
    ]);
  });

  it("低 confidence の外部候補 DOI を cluster enrichment の識別子として採用しない", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const searchCacheKey = "cluster-noisy-search";
    const enrichCacheKey = "cluster-noisy-record";

    await sessions.appendEntry(createSearchEntry(searchCacheKey));
    await sessions.appendEntry(createEnrichEntry(enrichCacheKey));
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: searchCacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "文学史" },
      structured_content: {
        query: "文学史",
        source: null,
        page: 1,
        limit: 50,
        total: 2,
        items: [
          createSearchItem("ndl_catalog", "noisy-1", "日本文学史", "1999", false, "佐藤 一郎"),
          createSearchItem("cinii_books", "noisy-2", "日本文学史", "1999", false, "佐藤 一郎")
        ]
      }
    });
    await cache.write("jp_lit_enrich_record", {
      version: 1,
      tool: "jp_lit_enrich_record",
      cache_key: enrichCacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: {
        title: "日本文学史",
        authors: ["佐藤 一郎"],
        issued_year: "1999",
        providers: ["crossref", "openalex"]
      },
      structured_content: createNoisyEnrichOutput()
    });

    const clustered = await tool({
      cache_key: searchCacheKey,
      include_duplicate_clusters: true,
      include_enrichment: true
    });

    const enrichment = clustered.structuredContent.clusters?.[0]?.enrichment;
    expect(enrichment?.matched_cache_keys).toEqual([enrichCacheKey]);
    expect(enrichment?.identifiers.doi).toBeNull();
    expect(enrichment?.match_confidence).toBe("none");
    expect(enrichment?.evidence_level.bibliographic).toBe("not_found");
    expect(enrichment?.matched_records).toEqual([]);
  });

  it("DOI-only の照合 cache は検索 item の DOI metadata と厳密一致した場合だけ cluster に付与する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const searchCacheKey = "cluster-doi-search";
    const enrichCacheKey = "cluster-doi-record";
    const first = createSearchItem("ndl_catalog", "doi-1", "DOI一致資料", "2001", true, "田中 花子");
    const second = createSearchItem("jstage_articles", "doi-2", "DOI一致資料", "2001", true, "田中 花子");

    await sessions.appendEntry(createSearchEntry(searchCacheKey));
    await sessions.appendEntry({
      ...createEnrichEntry(enrichCacheKey),
      input: {
        doi: "10.1234/doi-only",
        providers: ["crossref"]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: searchCacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "DOI一致資料" },
      structured_content: {
        query: "DOI一致資料",
        source: null,
        page: 1,
        limit: 50,
        total: 2,
        items: [
          { ...first, source_metadata: { doi: "https://doi.org/10.1234/DOI-ONLY" } },
          { ...second, source_metadata: { doi: "10.1234/doi-only" } }
        ]
      }
    });
    await cache.write("jp_lit_enrich_record", {
      version: 1,
      tool: "jp_lit_enrich_record",
      cache_key: enrichCacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: {
        doi: "10.1234/doi-only",
        providers: ["crossref"]
      },
      structured_content: createDoiOnlyEnrichOutput()
    });

    const clustered = await tool({
      cache_key: searchCacheKey,
      include_duplicate_clusters: true,
      include_enrichment: true
    });

    expect(clustered.structuredContent.clusters?.[0]?.enrichment?.identifiers.doi)
      .toBe("10.1234/doi-only");
  });

  it("DOI-only の照合 cache は preview から漏れた cluster member の DOI metadata も参照する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const searchCacheKey = "cluster-doi-omitted-search";
    const enrichCacheKey = "cluster-doi-omitted-record";

    await sessions.appendEntry(createSearchEntry(searchCacheKey));
    await sessions.appendEntry({
      ...createEnrichEntry(enrichCacheKey),
      input: {
        doi: "10.1234/doi-only",
        providers: ["crossref"]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: searchCacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "DOI一致資料" },
      structured_content: {
        query: "DOI一致資料",
        source: null,
        page: 1,
        limit: 50,
        total: 3,
        items: [
          createSearchItem("ndl_catalog", "omitted-1", "DOI一致資料", "2001", true, "田中 花子"),
          createSearchItem("cinii_books", "omitted-2", "DOI一致資料", "2001", true, "田中 花子"),
          {
            ...createSearchItem("jstage_articles", "omitted-3", "DOI一致資料", "2001", true, "田中 花子"),
            source_metadata: { doi: "10.1234/doi-only" }
          }
        ]
      }
    });
    await cache.write("jp_lit_enrich_record", {
      version: 1,
      tool: "jp_lit_enrich_record",
      cache_key: enrichCacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: {
        doi: "10.1234/doi-only",
        providers: ["crossref"]
      },
      structured_content: createDoiOnlyEnrichOutput()
    });

    const clustered = await tool({
      cache_key: searchCacheKey,
      include_duplicate_clusters: true,
      include_enrichment: true,
      cluster_member_limit: 1
    });

    expect(clustered.structuredContent.clusters?.[0]?.omitted_member_count).toBe(2);
    expect(clustered.structuredContent.clusters?.[0]?.enrichment?.identifiers.doi)
      .toBe("10.1234/doi-only");
  });
});
