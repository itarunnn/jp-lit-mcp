import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCacheKey } from "../src/lib/persistence/cacheKeys.js";
import * as cacheInventory from "../src/lib/persistence/cacheInventory.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import {
  getCacheRoot,
  getLegacyCacheRoot
} from "../src/lib/persistence/paths.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import type { SearchItem } from "../src/lib/types.js";
import { createJpLitSearchCacheIndexTool } from "../src/tools/jpLitSearchCacheIndex.js";

const tempDirs: string[] = [];

function fixtureCacheKey(label: string) {
  return createCacheKey("jp_lit_search", { fixture: label });
}

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-search-cache-index-"));
  tempDirs.push(dir);
  return dir;
}

function createSearchItem(
  source: SearchItem["source"],
  sourceId: string,
  title: string,
  issuedAt: string | null,
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
    availability: { online: false, digital_collection: true },
    material_type: null,
    subjects: ["文学"],
    table_of_contents: [],
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

function createSearchResult(
  query: string,
  sourceId: string,
  title = query
) {
  return {
    query,
    source: "ndl_catalog" as const,
    page: 1,
    limit: 50,
    total: 1,
    items: [createSearchItem("ndl_catalog", sourceId, title, "1950")]
  };
}

function createSearchEnvelope(
  cacheKey: string,
  savedAt: string,
  structuredContent: unknown
) {
  return {
    version: 1,
    tool: "jp_lit_search",
    cache_key: cacheKey,
    saved_at: savedAt,
    input: { query: "fixture" },
    structured_content: structuredContent
  };
}

async function appendSearchEntry(
  sessions: ReturnType<typeof createSessionStore>,
  cacheKey: string
) {
  await sessions.appendEntry({
    tool: "jp_lit_search",
    input: { query: "fixture" },
    cache_key: cacheKey,
    result_ref: { tool: "jp_lit_search", cache_key: cacheKey },
    selected_items: [],
    notes: []
  });
}

async function writeLegacySearchEnvelope(
  baseDir: string,
  envelope: ReturnType<typeof createSearchEnvelope>
) {
  const legacyDir = path.join(getLegacyCacheRoot(baseDir), "jp_lit_search");
  await mkdir(legacyDir, { recursive: true });
  await writeFile(
    path.join(legacyDir, `${envelope.cache_key}.json`),
    JSON.stringify(envelope),
    "utf8"
  );
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_search_cache_index", () => {
  it("inventory 後に一件が消失しても残る candidate cache を返す", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const disappearingKey = fixtureCacheKey("disappearing-after-inventory");
    const survivingKey = fixtureCacheKey("surviving-after-inventory");
    await appendSearchEntry(sessions, disappearingKey);
    await appendSearchEntry(sessions, survivingKey);
    await cache.write("jp_lit_search", createSearchEnvelope(
      disappearingKey,
      "2026-05-02T00:00:00.000Z",
      createSearchResult("inventory-race", "disappearing-id")
    ));
    await cache.write("jp_lit_search", createSearchEnvelope(
      survivingKey,
      "2026-05-01T00:00:00.000Z",
      createSearchResult("inventory-race", "surviving-id")
    ));

    const originalListCacheInventory = cacheInventory.listCacheInventory;
    let completedInventories = 0;
    vi.spyOn(cacheInventory, "listCacheInventory").mockImplementation(
      async (inventoryBaseDir, toolName) => {
        const inventory = await originalListCacheInventory(
          inventoryBaseDir,
          toolName
        );
        completedInventories += 1;
        if (completedInventories === 3) {
          await rm(path.join(
            getCacheRoot(baseDir),
            "jp_lit_search",
            `${disappearingKey}.json`
          ));
        }
        return inventory;
      }
    );
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    const result = await tool({ query: "inventory-race" });

    expect(result.structuredContent.result_refs).toEqual([
      { tool: "jp_lit_search", cache_key: survivingKey }
    ]);
  });

  it("inventory 後の予期しない filesystem read error を呼び出し元へ伝播する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const key = fixtureCacheKey("unexpected-filesystem-error");
    const target = path.join(
      getCacheRoot(baseDir),
      "jp_lit_search",
      `${key}.json`
    );
    await appendSearchEntry(sessions, key);
    await cache.write("jp_lit_search", createSearchEnvelope(
      key,
      "2026-05-02T00:00:00.000Z",
      createSearchResult("io-error", "io-error-id")
    ));

    const originalListCacheInventory = cacheInventory.listCacheInventory;
    let completedInventories = 0;
    vi.spyOn(cacheInventory, "listCacheInventory").mockImplementation(
      async (inventoryBaseDir, toolName) => {
        const inventory = await originalListCacheInventory(
          inventoryBaseDir,
          toolName
        );
        completedInventories += 1;
        if (completedInventories === 3) {
          await rm(target);
          await mkdir(target);
        }
        return inventory;
      }
    );
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    await expect(tool({ query: "io-error" })).rejects.toMatchObject({
      code: expect.stringMatching(/^(EACCES|EISDIR|EPERM)$/)
    });
  });

  it.each(["invalid_json", "invalid_structured_content"] as const)(
    "malformed current (%s) が valid legacy を遮らない",
    async (malformedKind) => {
      const baseDir = await createTempDir();
      const cache = createFileCache(baseDir);
      const sessions = createSessionStore(baseDir);
      const key = fixtureCacheKey(`malformed-current-${malformedKind}`);
      await appendSearchEntry(sessions, key);

      if (malformedKind === "invalid_json") {
        const currentDir = path.join(getCacheRoot(baseDir), "jp_lit_search");
        await mkdir(currentDir, { recursive: true });
        await writeFile(path.join(currentDir, `${key}.json`), "{", "utf8");
      } else {
        await cache.write("jp_lit_search", createSearchEnvelope(
          key,
          "2026-05-02T00:00:00.000Z",
          { query: "broken", items: "not-an-array" }
        ));
      }
      await writeLegacySearchEnvelope(baseDir, createSearchEnvelope(
        key,
        "2026-05-01T00:00:00.000Z",
        createSearchResult("legacy-fallback", "legacy-valid-id")
      ));
      const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

      const result = await tool({ query: "legacy-fallback" });

      expect(result.structuredContent.result_refs).toEqual([
        { tool: "jp_lit_search", cache_key: key }
      ]);
      expect(result.structuredContent.items[0]).toMatchObject({
        saved_at: "2026-05-01T00:00:00.000Z",
        query_preview: "legacy-fallback"
      });
    }
  );

  it("malformed structured_content は個別 cache を skip して検索を続ける", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const malformedKey = fixtureCacheKey("malformed-structured-content");
    const validKey = fixtureCacheKey("valid-beside-malformed");
    await appendSearchEntry(sessions, malformedKey);
    await appendSearchEntry(sessions, validKey);
    await cache.write("jp_lit_search", createSearchEnvelope(
      malformedKey,
      "2026-05-02T00:00:00.000Z",
      { query: "skip-malformed", items: "not-an-array" }
    ));
    await cache.write("jp_lit_search", createSearchEnvelope(
      validKey,
      "2026-05-01T00:00:00.000Z",
      createSearchResult("skip-malformed", "valid-id")
    ));
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    const result = await tool({ query: "skip-malformed" });

    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.result_refs).toEqual([
      { tool: "jp_lit_search", cache_key: validKey }
    ]);
  });

  it("tool-aware identity で browser query・fulltext title・canonical source ID を横断検索する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);
    const session = await sessions.startSession({
      research_goal: "candidate cache 横断"
    });
    const sharedKey = fixtureCacheKey("tool-aware-shared-hash");
    const canonicalSourceId = "R100000039-I1907653";

    await sessions.appendEntry({
      tool: "jp_lit_record_ndl_browser_search",
      input: { query: "横断一致 ブラウザ専用検索語" },
      cache_key: sharedKey,
      result_ref: {
        tool: "jp_lit_record_ndl_browser_search",
        cache_key: sharedKey
      },
      selected_items: [],
      notes: []
    }, session.session_id);
    await sessions.appendEntry({
      tool: "jp_lit_search_fulltext",
      input: { keyword: "本文語" },
      cache_key: sharedKey,
      result_ref: { tool: "jp_lit_search_fulltext", cache_key: sharedKey },
      selected_items: [],
      notes: []
    }, session.session_id);

    const browserItem = {
      ...createSearchItem(
        "ndl_digital",
        canonicalSourceId,
        "ブラウザ観測資料",
        "1926",
        "斉藤隆夫"
      ),
      url: "https://dl.ndl.go.jp/pid/1907653",
      source_metadata: {
        pid: "1907653",
        candidate_origins: ["ndl_digital_browser"],
        browser_observations: [{
          checked_at: "2026-09-05T12:00:00+09:00",
          login_state: "logged_in_existing_session",
          query: "横断一致 ブラウザ専用検索語",
          access_scope: "individual_transmission",
          access_label: "個人送信で閲覧可能",
          snippets: [{ text: "普通選挙法", locator_type: "koma", locator: "67" }],
          item_fulltext_state: "searched",
          hit_locations: ["67–73コマ"],
          content_state: "page_image_checked",
          print_file_state: "dialog_available"
        }]
      }
    };
    await cache.write("jp_lit_record_ndl_browser_search", {
      version: 1,
      tool: "jp_lit_record_ndl_browser_search",
      cache_key: sharedKey,
      saved_at: "2026-09-05T00:03:00.000Z",
      input: { query: "横断一致 ブラウザ専用検索語" },
      structured_content: {
        query: "横断一致 ブラウザ専用検索語",
        source: "ndl_digital",
        page: 1,
        limit: 100,
        total: 1,
        items: [browserItem],
        observation: {
          method: "browser",
          service: "ndl_digital_collections",
          checked_at: "2026-09-05T12:00:00+09:00",
          login_state: "logged_in_existing_session",
          reported_total: 1,
          total_relation: "reported_exact",
          observed_count: 1,
          filters: {
            access_scopes: ["transmission"],
            material_types: ["図書"],
            raw_labels: ["送信サービスで閲覧可能"]
          }
        }
      }
    });
    await cache.write("jp_lit_search_fulltext", {
      version: 1,
      tool: "jp_lit_search_fulltext",
      cache_key: sharedKey,
      saved_at: "2026-09-05T00:02:00.000Z",
      input: { keyword: "本文語" },
      structured_content: {
        keyword: "本文語",
        searchfield: "contentonly",
        total: 1,
        from: 0,
        items: [{
          pid: "1907653",
          viewer_url: "https://dl.ndl.go.jp/pid/1907653",
          title: "横断一致 全文検索固有タイトル",
          volume: null,
          responsibility: "斉藤隆夫 著",
          publisher: "憲政公論社",
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

    // 同じ hash の search cache は session 未登録なので、tool-aware identity なら混入しない。
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: sharedKey,
      saved_at: "2026-09-05T00:04:00.000Z",
      input: { query: "横断一致" },
      structured_content: {
        query: "横断一致",
        source: "ndl_digital",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem(
          "ndl_digital",
          "R100000039-I9999999",
          "session 未登録資料",
          "1926"
        )]
      }
    });

    const result = await tool({
      query: "横断一致",
      source: "ndl_digital",
      issued_from: "1926",
      issued_to: "1926"
    });

    expect(result.structuredContent.result_refs).toEqual([
      { tool: "jp_lit_record_ndl_browser_search", cache_key: sharedKey },
      { tool: "jp_lit_search_fulltext", cache_key: sharedKey }
    ]);
    expect(result.structuredContent.cache_keys).toEqual([sharedKey, sharedKey]);
    expect(result.structuredContent.items[0]).toMatchObject({
      tool: "jp_lit_record_ndl_browser_search",
      result_ref: {
        tool: "jp_lit_record_ndl_browser_search",
        cache_key: sharedKey
      },
      cache_key: sharedKey,
      source: "ndl_digital",
      matched_fields: ["query"]
    });
    expect(result.structuredContent.items[1]).toMatchObject({
      tool: "jp_lit_search_fulltext",
      result_ref: { tool: "jp_lit_search_fulltext", cache_key: sharedKey },
      cache_key: sharedKey,
      source: "ndl_digital",
      matched_fields: ["title"]
    });

    const browserQuery = await tool({ query: "ブラウザ専用検索語" });
    expect(browserQuery.structuredContent.result_refs).toEqual([
      { tool: "jp_lit_record_ndl_browser_search", cache_key: sharedKey }
    ]);

    const fulltextTitle = await tool({ query: "全文検索固有タイトル" });
    expect(fulltextTitle.structuredContent.result_refs).toEqual([
      { tool: "jp_lit_search_fulltext", cache_key: sharedKey }
    ]);

    const canonicalId = await tool({ query: canonicalSourceId });
    expect(canonicalId.structuredContent.result_refs).toEqual([
      { tool: "jp_lit_record_ndl_browser_search", cache_key: sharedKey },
      { tool: "jp_lit_search_fulltext", cache_key: sharedKey }
    ]);
    expect(canonicalId.structuredContent.items.every(
      (item) => item.matched_fields.includes("source_id")
    )).toBe(true);
  });

  it("candidate-producing tool 以外の session entry は cache index に登録しない", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const key = fixtureCacheKey("non-candidate-session-entry");
    await sessions.appendEntry({
      tool: "jp_lit_get_record",
      input: { source: "ndl_catalog", source_id: "id-0" },
      cache_key: key,
      result_ref: { tool: "jp_lit_get_record", cache_key: key },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: key,
      saved_at: "2026-09-05T00:00:00.000Z",
      input: { query: "candidate-only" },
      structured_content: {
        query: "candidate-only",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 0,
        items: []
      }
    });
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    const result = await tool({ query: "candidate-only" });

    expect(result.structuredContent.total).toBe(0);
    expect(result.structuredContent.cache_keys).toEqual([]);
  });

  it("キャッシュ横断で一致 cache_key を返す", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "夏目漱石" },
      cache_key: fixtureCacheKey("k1"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("k1") },
      selected_items: [],
      notes: []
    });
    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "森鴎外" },
      cache_key: fixtureCacheKey("k2"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("k2") },
      selected_items: [],
      notes: []
    });

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("k1"),
      saved_at: "2026-05-01T00:00:01.000Z",
      input: { query: "夏目漱石" },
      structured_content: {
        query: "夏目漱石",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "id-1", "こころ", "1914", "夏目 漱石")]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("k2"),
      saved_at: "2026-05-01T00:00:02.000Z",
      input: { query: "森鴎外" },
      structured_content: {
        query: "森鴎外",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "id-2", "舞姫", "1890", "森 鴎外")]
      }
    });

    const result = await tool({ query: "漱石" });

    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.cache_keys).toEqual([fixtureCacheKey("k1")]);
    expect(result.structuredContent.items[0]?.matched_fields).toContain("author");
  });

  it("source と issued 範囲で絞り込める", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "文学" },
      cache_key: fixtureCacheKey("k3"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("k3") },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("k3"),
      saved_at: "2026-05-01T00:00:03.000Z",
      input: { query: "文学" },
      structured_content: {
        query: "文学",
        source: "cinii_books",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("cinii_books", "id-3", "文学史", "1950")]
      }
    });

    const miss = await tool({
      query: "文学",
      source: "ndl_catalog",
      issued_from: "1900",
      issued_to: "1945"
    });
    expect(miss.structuredContent.total).toBe(0);

    const hit = await tool({
      query: "文学",
      source: "cinii_books",
      issued_from: "1940",
      issued_to: "1960"
    });
    expect(hit.structuredContent.total).toBe(1);
    expect(hit.structuredContent.cache_keys).toEqual([fixtureCacheKey("k3")]);
  });

  it("saved_on / saved_from / saved_to でキャッシュ作成日を絞り込める", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "猫" },
      cache_key: fixtureCacheKey("d1"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("d1") },
      selected_items: [],
      notes: []
    });
    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "猫" },
      cache_key: fixtureCacheKey("d2"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("d2") },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("d1"),
      saved_at: "2026-05-01T10:00:00.000Z",
      input: { query: "猫" },
      structured_content: {
        query: "猫",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "d1-id", "猫", "1900")]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("d2"),
      saved_at: "2026-05-02T10:00:00.000Z",
      input: { query: "猫" },
      structured_content: {
        query: "猫",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "d2-id", "猫", "1900")]
      }
    });

    const byDay = await tool({ query: "猫", saved_on: "2026-05-01" });
    expect(byDay.structuredContent.cache_keys).toEqual([fixtureCacheKey("d1")]);

    const byRange = await tool({
      query: "猫",
      saved_from: "2026-05-02T00:00:00.000Z",
      saved_to: "2026-05-02T23:59:59.999Z"
    });
    expect(byRange.structuredContent.cache_keys).toEqual([fixtureCacheKey("d2")]);
  });

  it("session_id 指定時は該当セッションの cache_key だけ返す", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    const s1 = await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "夏目漱石" },
      cache_key: fixtureCacheKey("k4"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("k4") },
      selected_items: [],
      notes: []
    });
    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "太宰治" },
      cache_key: fixtureCacheKey("k5"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("k5") },
      selected_items: [],
      notes: []
    });

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("k4"),
      saved_at: "2026-05-01T00:00:04.000Z",
      input: { query: "夏目漱石" },
      structured_content: {
        query: "夏目漱石",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "id-4", "吾輩は猫である", "1905")]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("k5"),
      saved_at: "2026-05-01T00:00:05.000Z",
      input: { query: "太宰治" },
      structured_content: {
        query: "太宰治",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "id-5", "人間失格", "1948")]
      }
    });

    const result = await tool({
      query: "失格",
      session_id: s1.session_id
    });
    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.cache_keys).toEqual([fixtureCacheKey("k5")]);
  });

  it("saved_on=last_7_days を JST 基準で解決する", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00+09:00"));
    try {
      const baseDir = await createTempDir();
      const cache = createFileCache(baseDir);
      const sessions = createSessionStore(baseDir);
      const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

      await sessions.appendEntry({
        tool: "jp_lit_search",
        input: { query: "猫" },
        cache_key: fixtureCacheKey("w1"),
        result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("w1") },
        selected_items: [],
        notes: []
      });
      await sessions.appendEntry({
        tool: "jp_lit_search",
        input: { query: "猫" },
        cache_key: fixtureCacheKey("w2"),
        result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("w2") },
        selected_items: [],
        notes: []
      });

      await cache.write("jp_lit_search", {
        version: 1,
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("w1"),
        saved_at: "2026-05-01T15:00:00.000Z",
        input: { query: "猫" },
        structured_content: {
          query: "猫",
          source: "ndl_catalog",
          page: 1,
          limit: 50,
          total: 1,
          items: [createSearchItem("ndl_catalog", "w1-id", "猫", "1900")]
        }
      });
      await cache.write("jp_lit_search", {
        version: 1,
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("w2"),
        saved_at: "2026-05-01T14:59:59.999Z",
        input: { query: "猫" },
        structured_content: {
          query: "猫",
          source: "ndl_catalog",
          page: 1,
          limit: 50,
          total: 1,
          items: [createSearchItem("ndl_catalog", "w2-id", "猫", "1900")]
        }
      });

      const result = await tool({ query: "猫", saved_on: "last_7_days" });
      expect(result.structuredContent.cache_keys).toEqual([fixtureCacheKey("w1")]);
      expect(result.structuredContent.saved_on).toBe("last_7_days");
      expect(result.structuredContent.saved_on_resolved).toBe("2026-05-08");
    } finally {
      vi.useRealTimers();
    }
  });

  it("旧 cache root の検索結果もインデックス検索に含める", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);
    const legacyDir = path.join(getLegacyCacheRoot(baseDir), "jp_lit_search");

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "legacy game" },
      cache_key: fixtureCacheKey("legacy-game"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("legacy-game") },
      selected_items: [],
      notes: ["legacy note"]
    });
    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      path.join(legacyDir, `${fixtureCacheKey("legacy-game")}.json`),
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("legacy-game"),
        saved_at: "2026-05-01T09:00:00.000Z",
        input: { query: "legacy game" },
        structured_content: {
          query: "legacy game",
          source: "ndl_catalog",
          page: 1,
          limit: 50,
          total: 1,
          items: [createSearchItem("ndl_catalog", "legacy", "ゲーム理論入門", "1950")]
        }
      }),
      "utf8"
    );

    const result = await tool({ query: "ゲーム理論" });
    expect(result.structuredContent.cache_keys).toContain(fixtureCacheKey("legacy-game"));
  });

  it.each([
    ["current", "outside"],
    ["current", "dangling"],
    ["legacy", "outside"],
    ["legacy", "dangling"]
  ] as const)(
    "%s の %s search directory containment error を握りつぶさない",
    async (rootKind, linkKind) => {
      const baseDir = await createTempDir();
      const cacheRoot =
        rootKind === "current"
          ? getCacheRoot(baseDir)
          : getLegacyCacheRoot(baseDir);
      const target = path.join(baseDir, `${rootKind}-${linkKind}-target`);
      await mkdir(cacheRoot, { recursive: true });
      if (linkKind === "outside") {
        await mkdir(target, { recursive: true });
      }
      await symlink(
        target,
        path.join(cacheRoot, "jp_lit_search"),
        process.platform === "win32" ? "junction" : "dir"
      );
      const tool = createJpLitSearchCacheIndexTool(
        createFileCache(baseDir),
        createSessionStore(baseDir),
        baseDir
      );

      await expect(tool({ query: "proof" })).rejects.toThrow(/cache/i);
    }
  );

  it("non-SHA filename は session に参照があっても安全に無視する", async () => {
    const baseDir = await createTempDir();
    const sessions = createSessionStore(baseDir);
    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "bad" },
      cache_key: "not-sha",
      result_ref: { tool: "jp_lit_search", cache_key: "not-sha" },
      selected_items: [],
      notes: []
    });
    const searchDir = path.join(getCacheRoot(baseDir), "jp_lit_search");
    await mkdir(searchDir, { recursive: true });
    await writeFile(path.join(searchDir, "not-sha.json"), "{}", "utf8");
    const tool = createJpLitSearchCacheIndexTool(
      createFileCache(baseDir),
      sessions,
      baseDir
    );

    const result = await tool({ query: "bad" });

    expect(result.structuredContent.total).toBe(0);
    expect(result.structuredContent.cache_keys).toEqual([]);
  });

  it("未知 directory を検索対象に含めない", async () => {
    const baseDir = await createTempDir();
    const unknownDir = path.join(getCacheRoot(baseDir), "unexpected");
    await mkdir(unknownDir, { recursive: true });
    await writeFile(
      path.join(unknownDir, `${fixtureCacheKey("unknown-index")}.json`),
      "{}",
      "utf8"
    );
    const tool = createJpLitSearchCacheIndexTool(
      createFileCache(baseDir),
      createSessionStore(baseDir),
      baseDir
    );

    const result = await tool({ query: "proof" });

    expect(result.structuredContent.total).toBe(0);
  });

  it("同一 key が current と legacy にある場合は current を優先する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const key = fixtureCacheKey("index-current-first");
    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "current" },
      cache_key: key,
      result_ref: { tool: "jp_lit_search", cache_key: key },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: key,
      saved_at: "2026-05-02T00:00:00.000Z",
      input: { query: "current" },
      structured_content: {
        query: "current",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 0,
        items: []
      }
    });
    const legacyDir = path.join(getLegacyCacheRoot(baseDir), "jp_lit_search");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      path.join(legacyDir, `${key}.json`),
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: key,
        saved_at: "2026-05-01T00:00:00.000Z",
        input: { query: "legacy-match" },
        structured_content: {
          query: "legacy-match",
          source: "ndl_catalog",
          page: 1,
          limit: 50,
          total: 0,
          items: []
        }
      }),
      "utf8"
    );
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    const result = await tool({ query: "legacy-match" });

    expect(result.structuredContent.total).toBe(0);
  });
});
