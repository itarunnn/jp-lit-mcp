import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import type { SearchItem } from "../src/lib/types.js";
import { createJpLitExportViewTool } from "../src/tools/jpLitExportView.js";
import { createJpLitListCacheTool } from "../src/tools/jpLitListCache.js";
import { createJpLitRefineResultsTool } from "../src/tools/jpLitRefineResults.js";
import { createJpLitSearchCacheIndexTool } from "../src/tools/jpLitSearchCacheIndex.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-export-view-"));
  tempDirs.push(dir);
  return dir;
}

function createSearchItem(
  sourceId: string,
  title: string,
  source: SearchItem["source"] = "ndl_catalog"
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
    subjects: ["文学"],
    table_of_contents: [],
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

async function createExportViewFixture(items: SearchItem[]) {
  const baseDir = await createTempDir();
  const cache = createFileCache(baseDir);
  const sessions = createSessionStore(baseDir);
  const listCacheTool = createJpLitListCacheTool(cache, sessions, baseDir);
  const searchCacheIndexTool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);
  const refineResultsTool = createJpLitRefineResultsTool(cache, sessions);
  const exportViewTool = createJpLitExportViewTool(
    {
      listCache: listCacheTool,
      searchCacheIndex: searchCacheIndexTool,
      refineResults: refineResultsTool
    },
    baseDir
  );
  await sessions.appendEntry({
    tool: "jp_lit_search",
    input: { query: "文学" },
    cache_key: "ev-fixture",
    result_ref: { tool: "jp_lit_search", cache_key: "ev-fixture" },
    selected_items: [],
    notes: []
  });
  await cache.write("jp_lit_search", {
    version: 1,
    tool: "jp_lit_search",
    cache_key: "ev-fixture",
    saved_at: "2026-05-01T00:00:00.000Z",
    input: { query: "文学" },
    structured_content: {
      query: "文学",
      source: "ndl_catalog",
      page: 1,
      limit: items.length,
      total: items.length,
      items
    }
  });
  return { baseDir, exportViewTool };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("jp_lit_export_view", () => {
  it("cache_list ビューを markdown で直接書き出せる", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const listCacheTool = createJpLitListCacheTool(cache, sessions, baseDir);
    const searchCacheIndexTool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);
    const refineResultsTool = createJpLitRefineResultsTool(cache, sessions);
    const exportViewTool = createJpLitExportViewTool(
      {
        listCache: listCacheTool,
        searchCacheIndex: searchCacheIndexTool,
        refineResults: refineResultsTool
      },
      baseDir
    );

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "夏目漱石" },
      cache_key: "ev1",
      result_ref: { tool: "jp_lit_search", cache_key: "ev1" },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "ev1",
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "夏目漱石" },
      structured_content: {
        query: "夏目漱石",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ev1-id", "こころ")]
      }
    });

    const outputPath = path.join(baseDir, "exports", "cache-list.md");
    const result = await exportViewTool({
      view: "cache_list",
      params: { tool: "jp_lit_search" },
      format: "markdown",
      output_path: outputPath
    });

    const written = await readFile(outputPath, "utf8");
    expect(result.structuredContent.view).toBe("cache_list");
    expect(result.structuredContent.item_count).toBe(1);
    expect(written).toContain("Cache View Export");
    expect(written).toContain("\"cache_keys\"");
    expect(written).toContain("ev1");
  });

  it("cache_query ビューを json で直接書き出せる", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const listCacheTool = createJpLitListCacheTool(cache, sessions, baseDir);
    const searchCacheIndexTool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);
    const refineResultsTool = createJpLitRefineResultsTool(cache, sessions);
    const exportViewTool = createJpLitExportViewTool(
      {
        listCache: listCacheTool,
        searchCacheIndex: searchCacheIndexTool,
        refineResults: refineResultsTool
      },
      baseDir
    );

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "舞姫" },
      cache_key: "ev2",
      result_ref: { tool: "jp_lit_search", cache_key: "ev2" },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "ev2",
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "舞姫" },
      structured_content: {
        query: "舞姫",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 1,
        items: [createSearchItem("ev2-id", "舞姫")]
      }
    });

    const outputPath = path.join(baseDir, "exports", "cache-query.json");
    const result = await exportViewTool({
      view: "cache_query",
      params: { query: "舞姫" },
      format: "json",
      output_path: outputPath
    });

    const written = JSON.parse(await readFile(outputPath, "utf8")) as {
      cache_keys: string[];
    };
    expect(result.structuredContent.view).toBe("cache_query");
    expect(result.structuredContent.item_count).toBe(1);
    expect(written.cache_keys).toEqual(["ev2"]);
  });

  it("refined_results ビューを json で直接書き出せる", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const listCacheTool = createJpLitListCacheTool(cache, sessions, baseDir);
    const searchCacheIndexTool = createJpLitSearchCacheIndexTool(cache, sessions, baseDir);
    const refineResultsTool = createJpLitRefineResultsTool(cache, sessions);
    const exportViewTool = createJpLitExportViewTool(
      {
        listCache: listCacheTool,
        searchCacheIndex: searchCacheIndexTool,
        refineResults: refineResultsTool
      },
      baseDir
    );

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "文学" },
      cache_key: "ev3",
      result_ref: { tool: "jp_lit_search", cache_key: "ev3" },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "ev3",
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "文学" },
      structured_content: {
        query: "文学",
        source: "ndl_catalog",
        page: 1,
        limit: 50,
        total: 2,
        items: [
          createSearchItem("ev3-id-1", "文学史"),
          createSearchItem("ev3-id-2", "文学入門")
        ]
      }
    });

    const outputPath = path.join(baseDir, "exports", "refined-results.json");
    const result = await exportViewTool({
      view: "refined_results",
      params: {
        cache_key: "ev3",
        sort_by: "title",
        sort_order: "asc"
      },
      format: "json",
      output_path: outputPath
    });

    const written = JSON.parse(await readFile(outputPath, "utf8")) as {
      total_after: number;
      items: Array<{ title: string }>;
    };
    expect(result.structuredContent.view).toBe("refined_results");
    expect(result.structuredContent.item_count).toBe(2);
    expect(written.total_after).toBe(2);
    expect(written.items.map((item) => item.title)).toEqual(["文学史", "文学入門"]);
  });

  it("refined_results は export_all でページ上限を超えて全件を書き出せる", async () => {
    const items = Array.from({ length: 205 }, (_, index) =>
      createSearchItem(`ev-all-${index}`, `文学 ${String(index).padStart(3, "0")}`)
    );
    const { baseDir, exportViewTool } = await createExportViewFixture(items);
    const outputPath = path.join(baseDir, "exports", "refined-all.json");

    const result = await exportViewTool({
      view: "refined_results",
      params: {
        cache_key: "ev-fixture",
        sort_by: "title",
        sort_order: "asc",
        limit: 20
      },
      export_all: true,
      format: "json",
      output_path: outputPath
    });

    const written = JSON.parse(await readFile(outputPath, "utf8")) as {
      total_after: number;
      items: Array<{ source_id: string }>;
    };
    expect(result.structuredContent.item_count).toBe(205);
    expect(written.total_after).toBe(205);
    expect(written.items).toHaveLength(205);
  });

  it("refined_results は duplicate_notes で重複クラスタを markdown に含める", async () => {
    const { baseDir, exportViewTool } = await createExportViewFixture([
      createSearchItem("ev-dup-1", "吾輩は猫である", "ndl_catalog"),
      createSearchItem("ev-dup-2", "吾輩は猫である", "cinii_books"),
      createSearchItem("ev-uniq-1", "草枕", "ndl_catalog")
    ]);
    const outputPath = path.join(baseDir, "exports", "refined-duplicates.md");

    const result = await exportViewTool({
      view: "refined_results",
      params: {
        cache_key: "ev-fixture",
        combine: "union",
        key_by: "source_record",
        cluster_offset: 1
      },
      export_all: true,
      duplicate_notes: true,
      format: "markdown",
      output_path: outputPath
    });

    const written = await readFile(outputPath, "utf8");
    expect(result.structuredContent.item_count).toBe(3);
    expect(written).toContain("Duplicate Cluster Summary");
    expect(written).toContain("Returned clusters: 1");
    expect(written).toContain("重複クラスタは自動削除ではありません");
    expect(written).toContain("Search result readiness");
    expect(written).toContain("吾輩は猫である");
  });
});
