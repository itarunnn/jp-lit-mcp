import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { getLegacyCacheRoot } from "../src/lib/persistence/paths.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import type { SearchItem } from "../src/lib/types.js";
import { createJpLitSearchCacheIndexTool } from "../src/tools/jpLitSearchCacheIndex.js";

const tempDirs: string[] = [];

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

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_search_cache_index", () => {
  it("キャッシュ横断で一致 cache_key を返す", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "夏目漱石" },
      cache_key: "k1",
      result_ref: { tool: "jp_lit_search", cache_key: "k1" },
      selected_items: [],
      notes: []
    });
    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "森鴎外" },
      cache_key: "k2",
      result_ref: { tool: "jp_lit_search", cache_key: "k2" },
      selected_items: [],
      notes: []
    });

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "k1",
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
      cache_key: "k2",
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
    expect(result.structuredContent.cache_keys).toEqual(["k1"]);
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
      cache_key: "k3",
      result_ref: { tool: "jp_lit_search", cache_key: "k3" },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "k3",
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
    expect(hit.structuredContent.cache_keys).toEqual(["k3"]);
  });

  it("saved_on / saved_from / saved_to でキャッシュ作成日を絞り込める", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "猫" },
      cache_key: "d1",
      result_ref: { tool: "jp_lit_search", cache_key: "d1" },
      selected_items: [],
      notes: []
    });
    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "猫" },
      cache_key: "d2",
      result_ref: { tool: "jp_lit_search", cache_key: "d2" },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "d1",
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
      cache_key: "d2",
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
    expect(byDay.structuredContent.cache_keys).toEqual(["d1"]);

    const byRange = await tool({
      query: "猫",
      saved_from: "2026-05-02T00:00:00.000Z",
      saved_to: "2026-05-02T23:59:59.999Z"
    });
    expect(byRange.structuredContent.cache_keys).toEqual(["d2"]);
  });

  it("session_id 指定時は該当セッションの cache_key だけ返す", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);

    const s1 = await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "夏目漱石" },
      cache_key: "k4",
      result_ref: { tool: "jp_lit_search", cache_key: "k4" },
      selected_items: [],
      notes: []
    });
    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "太宰治" },
      cache_key: "k5",
      result_ref: { tool: "jp_lit_search", cache_key: "k5" },
      selected_items: [],
      notes: []
    });

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "k4",
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
      cache_key: "k5",
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
    expect(result.structuredContent.cache_keys).toEqual(["k5"]);
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
        cache_key: "w1",
        result_ref: { tool: "jp_lit_search", cache_key: "w1" },
        selected_items: [],
        notes: []
      });
      await sessions.appendEntry({
        tool: "jp_lit_search",
        input: { query: "猫" },
        cache_key: "w2",
        result_ref: { tool: "jp_lit_search", cache_key: "w2" },
        selected_items: [],
        notes: []
      });

      await cache.write("jp_lit_search", {
        version: 1,
        tool: "jp_lit_search",
        cache_key: "w1",
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
        cache_key: "w2",
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
      expect(result.structuredContent.cache_keys).toEqual(["w1"]);
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
      cache_key: "legacy-game",
      result_ref: { tool: "jp_lit_search", cache_key: "legacy-game" },
      selected_items: [],
      notes: ["legacy note"]
    });
    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      path.join(legacyDir, "legacy-game.json"),
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: "legacy-game",
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
    expect(result.structuredContent.cache_keys).toContain("legacy-game");
  });
});
