import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCacheKey } from "../src/lib/persistence/cacheKeys.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import {
  getCacheRoot,
  getLegacyCacheRoot
} from "../src/lib/persistence/paths.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import type { SearchItem } from "../src/lib/types.js";
import { createJpLitListCacheTool } from "../src/tools/jpLitListCache.js";

const tempDirs: string[] = [];

function fixtureCacheKey(label: string) {
  return createCacheKey("jp_lit_search", { fixture: label });
}

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-list-cache-"));
  tempDirs.push(dir);
  return dir;
}

function createSearchItem(
  source: SearchItem["source"],
  sourceId: string,
  title: string
): SearchItem {
  return {
    source,
    source_id: sourceId,
    title,
    subtitle: null,
    title_reading: null,
    authors: [{ name: "著者A", role: "author" }],
    publisher: null,
    journal_title: null,
    issued_at: "1900",
    issued_at_label: "1900",
    issued_at_precision: "year",
    summary: null,
    url: null,
    availability: { online: false, digital_collection: true },
    material_type: null,
    subjects: [],
    table_of_contents: [],
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("jp_lit_list_cache", () => {
  it("キャッシュ一覧と集計を返す", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitListCacheTool(cache, sessions, baseDir);

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "夏目漱石" },
      cache_key: fixtureCacheKey("lc1"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("lc1") },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("lc1"),
      saved_at: "2026-05-01T09:00:00.000Z",
      input: { query: "夏目漱石" },
      structured_content: {
        query: "夏目漱石",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "1", "こころ")]
      }
    });

    const result = await tool({ tool: "jp_lit_search" });
    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.cache_keys).toEqual([fixtureCacheKey("lc1")]);
    expect(result.structuredContent.summary.by_tool.jp_lit_search).toBe(1);
    expect(result.structuredContent.summary.by_source.ndl_catalog).toBe(1);
    expect(result.structuredContent.items[0]?.session_ids).toEqual([
      expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}-\d{6}(?:-[0-9a-f]{8})?$/
      )
    ]);
  });

  it("saved_on と source で絞り込める", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitListCacheTool(cache, sessions, baseDir);

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "a" },
      cache_key: fixtureCacheKey("lc2"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("lc2") },
      selected_items: [],
      notes: []
    });
    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "b" },
      cache_key: fixtureCacheKey("lc3"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("lc3") },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("lc2"),
      saved_at: "2026-05-01T11:00:00.000Z",
      input: { query: "a" },
      structured_content: {
        query: "a",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ndl_catalog", "2", "A")]
      }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("lc3"),
      saved_at: "2026-05-02T11:00:00.000Z",
      input: { query: "b" },
      structured_content: {
        query: "b",
        source: "cinii_books",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("cinii_books", "3", "B")]
      }
    });

    const result = await tool({
      tool: "jp_lit_search",
      saved_on: "2026-05-01",
      source: "ndl_catalog"
    });
    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.cache_keys).toEqual([fixtureCacheKey("lc2")]);
  });

  it("saved_on=today を JST 基準で解決する", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T00:30:00+09:00"));
    try {
      const baseDir = await createTempDir();
      const cache = createFileCache(baseDir);
      const sessions = createSessionStore(baseDir);
      const tool = createJpLitListCacheTool(cache, sessions, baseDir);

      await sessions.appendEntry({
        tool: "jp_lit_search",
        input: { query: "jst-a" },
        cache_key: fixtureCacheKey("jst-a"),
        result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("jst-a") },
        selected_items: [],
        notes: []
      });
      await sessions.appendEntry({
        tool: "jp_lit_search",
        input: { query: "jst-b" },
        cache_key: fixtureCacheKey("jst-b"),
        result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("jst-b") },
        selected_items: [],
        notes: []
      });

      await cache.write("jp_lit_search", {
        version: 1,
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("jst-a"),
        saved_at: "2026-05-01T16:00:00.000Z",
        input: { query: "jst-a" },
        structured_content: {
          query: "jst-a",
          source: "ndl_catalog",
          page: 1,
          limit: 50,
          total: 1,
          items: [createSearchItem("ndl_catalog", "jst-a", "A")]
        }
      });
      await cache.write("jp_lit_search", {
        version: 1,
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("jst-b"),
        saved_at: "2026-05-01T14:00:00.000Z",
        input: { query: "jst-b" },
        structured_content: {
          query: "jst-b",
          source: "ndl_catalog",
          page: 1,
          limit: 50,
          total: 1,
          items: [createSearchItem("ndl_catalog", "jst-b", "B")]
        }
      });

      const result = await tool({ tool: "jp_lit_search", saved_on: "today" });
      expect(result.structuredContent.cache_keys).toEqual([fixtureCacheKey("jst-a")]);
      expect(result.structuredContent.saved_on).toBe("today");
      expect(result.structuredContent.saved_on_resolved).toBe("2026-05-02");
    } finally {
      vi.useRealTimers();
    }
  });

  it("旧 cache root の項目も一覧に含める", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitListCacheTool(cache, sessions, baseDir);
    const legacyDir = path.join(getLegacyCacheRoot(baseDir), "jp_lit_search");

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "legacy" },
      cache_key: fixtureCacheKey("legacy-list"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("legacy-list") },
      selected_items: [],
      notes: []
    });
    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      path.join(legacyDir, `${fixtureCacheKey("legacy-list")}.json`),
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("legacy-list"),
        saved_at: "2026-05-01T09:00:00.000Z",
        input: { query: "legacy" },
        structured_content: {
          query: "legacy",
          source: "ndl_catalog",
          page: 1,
          limit: 50,
          total: 1,
          items: [createSearchItem("ndl_catalog", "legacy", "Legacy")]
        }
      }),
      "utf8"
    );

    const result = await tool({ tool: "jp_lit_search" });
    expect(result.structuredContent.cache_keys).toContain(fixtureCacheKey("legacy-list"));
  });

  it.each(["unexpected", "../../../../victim"])(
    "未知または traversal tool %s を schema で拒否する",
    async (invalidTool) => {
      const baseDir = await createTempDir();
      const tool = createJpLitListCacheTool(
        createFileCache(baseDir),
        createSessionStore(baseDir),
        baseDir
      );

      await expect(tool({ tool: invalidTool })).rejects.toThrow();
    }
  );

  it("未知 directory と non-SHA filename を安全に無視する", async () => {
    const baseDir = await createTempDir();
    const currentRoot = getCacheRoot(baseDir);
    const unknownDir = path.join(currentRoot, "unexpected");
    const searchDir = path.join(currentRoot, "jp_lit_search");
    await mkdir(unknownDir, { recursive: true });
    await mkdir(searchDir, { recursive: true });
    await writeFile(
      path.join(unknownDir, `${fixtureCacheKey("unknown-list")}.json`),
      "{}",
      "utf8"
    );
    await writeFile(path.join(searchDir, "not-sha.json"), "{}", "utf8");
    const tool = createJpLitListCacheTool(
      createFileCache(baseDir),
      createSessionStore(baseDir),
      baseDir
    );

    const result = await tool({});

    expect(result.structuredContent.total).toBe(0);
    expect(result.structuredContent.cache_keys).toEqual([]);
  });

  it.each([
    ["current", "outside"],
    ["current", "dangling"],
    ["legacy", "outside"],
    ["legacy", "dangling"]
  ] as const)(
    "%s の %s tool directory containment error を握りつぶさない",
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
      const tool = createJpLitListCacheTool(
        createFileCache(baseDir),
        createSessionStore(baseDir),
        baseDir
      );

      await expect(tool({ tool: "jp_lit_search" })).rejects.toThrow(/cache/i);
    }
  );

  it("同一 key が current と legacy にある場合は current を優先する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const key = fixtureCacheKey("list-current-first");
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
        input: { query: "legacy" },
        structured_content: {
          query: "legacy",
          source: "ndl_catalog",
          page: 1,
          limit: 50,
          total: 0,
          items: []
        }
      }),
      "utf8"
    );
    const tool = createJpLitListCacheTool(
      cache,
      createSessionStore(baseDir),
      baseDir
    );

    const result = await tool({ tool: "jp_lit_search" });

    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.items[0]?.query_preview).toBe("current");
  });
});
