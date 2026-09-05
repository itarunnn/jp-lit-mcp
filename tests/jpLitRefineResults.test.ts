import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCacheKey } from "../src/lib/persistence/cacheKeys.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import type { SessionEntry } from "../src/lib/persistence/types.js";
import type { CandidateResultTool } from "../src/lib/candidateResults.js";
import type { SearchItem } from "../src/lib/types.js";
import type { EnrichRecordOutput } from "../src/lib/schemas.js";
import { createJpLitRecordNdlBrowserSearchTool } from "../src/tools/jpLitRecordNdlBrowserSearch.js";
import { createJpLitRefineResultsTool } from "../src/tools/jpLitRefineResults.js";

const tempDirs: string[] = [];

function fixtureCacheKey(label: string) {
  return createCacheKey("jp_lit_search", { fixture: label });
}

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

function createCandidateEntry(
  tool: CandidateResultTool,
  cacheKey: string
): SessionEntry {
  return {
    tool,
    input: { query: "普通選挙法" },
    cache_key: cacheKey,
    result_ref: { tool, cache_key: cacheKey },
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

async function setupThreeRouteCandidates() {
  const baseDir = await createTempDir();
  const cache = createFileCache(baseDir);
  const sessions = createSessionStore(baseDir);
  const session = await sessions.startSession({ research_goal: "三経路候補統合" });
  const sharedCacheKey = fixtureCacheKey("three-route-shared-key");
  const canonicalSourceId = "R100000039-I1907653";
  const apiItem = {
    ...createSearchItem(
      "ndl_digital",
      canonicalSourceId,
      "帝国憲法大要（NDL Search 正式書誌）",
      "1926",
      false,
      "斉藤隆夫"
    ),
    publisher: "憲政公論社",
    source_metadata: {
      pid: "1907653",
      provider_id: "ndl-dl"
    }
  };

  await cache.write("jp_lit_search", {
    version: 1,
    tool: "jp_lit_search",
    cache_key: sharedCacheKey,
    saved_at: "2026-09-05T00:00:00.000Z",
    input: { query: "普通選挙法" },
    structured_content: {
      query: "普通選挙法",
      source: "ndl_digital",
      page: 1,
      limit: 50,
      total: 1,
      items: [apiItem]
    }
  });
  await sessions.appendEntry(
    createCandidateEntry("jp_lit_search", sharedCacheKey),
    session.session_id
  );

  await cache.write("jp_lit_search_fulltext", {
    version: 1,
    tool: "jp_lit_search_fulltext",
    cache_key: sharedCacheKey,
    saved_at: "2026-09-05T00:01:00.000Z",
    input: { keyword: "普通選挙法" },
    structured_content: {
      keyword: "普通選挙法",
      searchfield: "contentonly",
      total: 1,
      from: 0,
      items: [{
        pid: "1907653",
        viewer_url: "https://dl.ndl.go.jp/pid/1907653",
        title: "帝国憲法大要（全文検索候補）",
        volume: null,
        responsibility: "斉藤隆夫 著",
        publisher: null,
        published: "大正15",
        publishyear: 1926,
        ndc: "323",
        bib_id: "000000000001",
        call_no: "特1-1",
        page_count: 123,
        is_classic: false,
        highlights: ["普通選挙法"]
      }],
      raw: {}
    }
  });
  await sessions.appendEntry(
    createCandidateEntry("jp_lit_search_fulltext", sharedCacheKey),
    session.session_id
  );

  const recordBrowserResult = createJpLitRecordNdlBrowserSearchTool(cache, sessions);
  const browserInput = {
    session_id: session.session_id,
    query: "普通選挙法",
    checked_at: "2026-09-05T12:00:00+09:00",
    login_state: "logged_in_existing_session",
    page: 1,
    reported_total: 1,
    total_relation: "reported_exact",
    filters: {
      access_scopes: ["transmission"],
      material_types: ["図書"],
      raw_labels: ["送信サービスで閲覧可能"]
    },
    items: [{
      pid: "1907653",
      title: "帝国憲法大要（ブラウザ観測）",
      volume: null,
      authors: ["斉藤隆夫"],
      publisher: null,
      published: "1926",
      viewer_url: "https://dl.ndl.go.jp/pid/1907653",
      access_scope: "individual_transmission",
      access_label: "個人送信で閲覧可能",
      snippets: [{ text: "普通選挙法", locator_type: "koma", locator: "67" }],
      item_fulltext_state: "searched",
      hit_locations: ["67–73コマ"],
      content_state: "page_image_checked",
      print_file_state: "dialog_available"
    }]
  } as const;
  const browserResult = await recordBrowserResult(browserInput);
  await recordBrowserResult(browserInput);
  const browserCacheKey = browserResult.structuredContent.cache.cache_key;

  return {
    cache,
    sessions,
    sessionId: session.session_id,
    searchRef: { tool: "jp_lit_search" as const, cache_key: sharedCacheKey },
    fulltextRef: { tool: "jp_lit_search_fulltext" as const, cache_key: sharedCacheKey },
    browserRef: {
      tool: "jp_lit_record_ndl_browser_search" as const,
      cache_key: browserCacheKey
    }
  };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_refine_results", () => {
  it("result_ref で fulltext cache を選び result ref と tool 付き total を返す", async () => {
    const setup = await setupThreeRouteCandidates();
    const tool = createJpLitRefineResultsTool(setup.cache, setup.sessions);

    const result = await tool({ result_ref: setup.fulltextRef });

    expect(result.structuredContent).toMatchObject({
      base_cache_key: setup.fulltextRef.cache_key,
      base_cache_keys: [setup.fulltextRef.cache_key],
      base_result_ref: setup.fulltextRef,
      base_result_refs: [setup.fulltextRef],
      totals_by_base: [{ ...setup.fulltextRef, total: 1 }],
      total_before: 1,
      total_after: 1,
      items: [{
        source: "ndl_digital",
        source_id: "R100000039-I1907653",
        source_metadata: {
          next_digital_library_fulltext: {
            highlights: ["普通選挙法"]
          }
        }
      }]
    });
  });

  it("session_id で三経路を tool:cache_key 単位に選び同一 PID を一候補へ統合する", async () => {
    const setup = await setupThreeRouteCandidates();
    const tool = createJpLitRefineResultsTool(setup.cache, setup.sessions);

    const result = await tool({ session_id: setup.sessionId });

    expect(result.structuredContent.base_result_refs).toEqual([
      setup.searchRef,
      setup.fulltextRef,
      setup.browserRef
    ]);
    expect(result.structuredContent.totals_by_base).toEqual([
      { ...setup.searchRef, total: 1 },
      { ...setup.fulltextRef, total: 1 },
      { ...setup.browserRef, total: 1 }
    ]);
    expect(result.structuredContent.items).toHaveLength(1);
    expect(result.structuredContent.items[0]).toMatchObject({
      source: "ndl_digital",
      source_id: "R100000039-I1907653",
      title: "帝国憲法大要（NDL Search 正式書誌）",
      publisher: "憲政公論社",
      availability: { online: true, digital_collection: true },
      source_metadata: {
        candidate_origins: [
          "jp_lit_search",
          "ndl_digital_browser",
          "next_digital_library_fulltext"
        ],
        browser_observations: [{
          access_scope: "individual_transmission",
          snippets: [{ text: "普通選挙法", locator_type: "koma", locator: "67" }]
        }],
        next_digital_library_fulltext: {
          highlights: ["普通選挙法"]
        }
      }
    });
  });

  it("source_record intersection でも一致した三経路の field と provenance を統合する", async () => {
    const setup = await setupThreeRouteCandidates();
    const tool = createJpLitRefineResultsTool(setup.cache, setup.sessions);

    const result = await tool({
      result_refs: [setup.fulltextRef, setup.browserRef, setup.searchRef],
      combine: "intersection",
      key_by: "source_record"
    });

    expect(result.structuredContent.items).toHaveLength(1);
    expect(result.structuredContent.items[0]).toMatchObject({
      title: "帝国憲法大要（NDL Search 正式書誌）",
      publisher: "憲政公論社",
      source_metadata: {
        candidate_origins: [
          "jp_lit_search",
          "ndl_digital_browser",
          "next_digital_library_fulltext"
        ]
      }
    });
  });

  it.each(["duplicate_key", "title_author_year"] as const)(
    "%s は別 source の field/provenance を merge せず先頭 representative を保つ",
    async (keyBy) => {
      const baseDir = await createTempDir();
      const cache = createFileCache(baseDir);
      const sessions = createSessionStore(baseDir);
      const tool = createJpLitRefineResultsTool(cache, sessions);
      const firstKey = fixtureCacheKey(`${keyBy}-first`);
      const secondKey = fixtureCacheKey(`${keyBy}-second`);
      const first = {
        ...createSearchItem("ndl_catalog", "first", "同一視候補", "1926", false, "斉藤隆夫"),
        duplicate_key: "shared-duplicate-key",
        source_metadata: { representative: "first" }
      };
      const second = {
        ...createSearchItem("cinii_books", "second", "同一視候補", "1926", true, "斉藤隆夫"),
        duplicate_key: "shared-duplicate-key",
        publisher: "混ぜてはいけない出版社",
        source_metadata: { representative: "second", extra: "must-not-merge" }
      };

      for (const [cacheKey, item] of [[firstKey, first], [secondKey, second]] as const) {
        await cache.write("jp_lit_search", {
          version: 1,
          tool: "jp_lit_search",
          cache_key: cacheKey,
          saved_at: "2026-09-05T00:00:00.000Z",
          input: { query: "同一視候補" },
          structured_content: {
            query: "同一視候補",
            source: null,
            page: 1,
            limit: 50,
            total: 1,
            items: [item]
          }
        });
      }

      const result = await tool({
        cache_keys: [firstKey, secondKey],
        combine: "union",
        key_by: keyBy
      });

      expect(result.structuredContent.items).toHaveLength(1);
      expect(result.structuredContent.items[0]).toMatchObject({
        source: "ndl_catalog",
        source_id: "first",
        publisher: null,
        source_metadata: { representative: "first" }
      });
      expect(result.structuredContent.items[0]?.source_metadata).not.toHaveProperty("extra");
    }
  );

  it("session_id で選んだ jp_lit_search 結果を issued_at で昇順ソートする", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const cacheKey = fixtureCacheKey("latest-key");

    const session = await sessions.appendEntry(createSearchEntry(cacheKey));
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
      session_id: session.session_id,
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
      { tool: "jp_lit_search", cache_key: cacheKey, total: 3 }
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
    const firstKey = fixtureCacheKey("first-key");
    const secondKey = fixtureCacheKey("second-key");

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
    const cacheKey = fixtureCacheKey("past-key");

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
    const keyA = fixtureCacheKey("union-a");
    const keyB = fixtureCacheKey("union-b");

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
    const keyA = fixtureCacheKey("intersect-a");
    const keyB = fixtureCacheKey("intersect-b");

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
    const keyA = fixtureCacheKey("minus-a");
    const keyB = fixtureCacheKey("minus-b");

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

    const sessionA = await sessions.appendEntry(createSearchEntry(fixtureCacheKey("s1-a")));
    await sessions.appendEntry(createSearchEntry(fixtureCacheKey("s1-b")));
    await sessions.appendEntry(createSearchEntry(fixtureCacheKey("s2-a")));

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("s1-a"),
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
      cache_key: fixtureCacheKey("s1-b"),
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
      cache_key: fixtureCacheKey("s2-a"),
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

    expect(result.structuredContent.base_cache_keys).toEqual([fixtureCacheKey("s1-a"), fixtureCacheKey("s1-b"), fixtureCacheKey("s2-a")]);
    expect(result.structuredContent.items.map((item) => item.source_id)).toEqual([
      "S1A",
      "S1B",
      "S2A"
    ]);
  });

  it("candidate result が無い場合はエラーを返す", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const session = await sessions.readCurrent();

    await expect(tool({ session_id: session.session_id })).rejects.toThrow(
      `session_id=${session.session_id} に candidate result がありません`
    );
  });

  it("既定では整理後の先頭30件だけを返す", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const cacheKey = fixtureCacheKey("limit-key");

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
      cache_key: cacheKey,
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
    const cacheKey = fixtureCacheKey("cluster-key");

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
    const cacheKey = fixtureCacheKey("cluster-raw-key");

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
    const searchCacheKey = fixtureCacheKey("cluster-enrich-search");
    const enrichCacheKey = fixtureCacheKey("cluster-enrich-record");

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
      include_enrichment: true,
      enrichment_cache_keys: [enrichCacheKey]
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
    const searchCacheKey = fixtureCacheKey("cluster-noisy-search");
    const enrichCacheKey = fixtureCacheKey("cluster-noisy-record");

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
      include_enrichment: true,
      enrichment_cache_keys: [enrichCacheKey]
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
    const searchCacheKey = fixtureCacheKey("cluster-doi-search");
    const enrichCacheKey = fixtureCacheKey("cluster-doi-record");
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
      include_enrichment: true,
      enrichment_cache_keys: [enrichCacheKey]
    });

    expect(clustered.structuredContent.clusters?.[0]?.enrichment?.identifiers.doi)
      .toBe("10.1234/doi-only");
  });

  it("DOI-only の照合 cache は preview から漏れた cluster member の DOI metadata も参照する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitRefineResultsTool(cache, sessions);
    const searchCacheKey = fixtureCacheKey("cluster-doi-omitted-search");
    const enrichCacheKey = fixtureCacheKey("cluster-doi-omitted-record");

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
      enrichment_cache_keys: [enrichCacheKey],
      cluster_member_limit: 1
    });

    expect(clustered.structuredContent.clusters?.[0]?.omitted_member_count).toBe(2);
    expect(clustered.structuredContent.clusters?.[0]?.enrichment?.identifiers.doi)
      .toBe("10.1234/doi-only");
  });
});
