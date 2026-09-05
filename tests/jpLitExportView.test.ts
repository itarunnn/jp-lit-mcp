import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCacheKey } from "../src/lib/persistence/cacheKeys.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import type { EnrichRecordOutput, RefineResultsOutput } from "../src/lib/schemas.js";
import type { SearchItem } from "../src/lib/types.js";
import { createJpLitExportViewTool } from "../src/tools/jpLitExportView.js";
import { createJpLitListCacheTool } from "../src/tools/jpLitListCache.js";
import { createJpLitRefineResultsTool } from "../src/tools/jpLitRefineResults.js";
import { createJpLitSearchCacheIndexTool } from "../src/tools/jpLitSearchCacheIndex.js";

const tempDirs: string[] = [];

function fixtureCacheKey(label: string) {
  return createCacheKey("jp_lit_search", { fixture: label });
}

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

function createExportEnrichOutput(): EnrichRecordOutput {
  return {
    query: {
      doi: null,
      title: "吾輩は猫である",
      authors: ["著者A"],
      issued_year: "1900"
    },
    providers: {
      crossref: { status: "ok", item_count: 1, note: null },
      openalex: { status: "skipped", item_count: 0, note: "OPENALEX_API_KEY is not set." }
    },
    matches: [
      {
        provider: "crossref",
        id: "10.1234/neko",
        doi: "10.1234/neko",
        title: "吾輩は猫である",
        authors: ["著者A"],
        issued_year: "1900",
        url: "https://doi.org/10.1234/neko",
        cited_by_count: 12,
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
    cache_key: fixtureCacheKey("ev-fixture"),
    result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("ev-fixture") },
    selected_items: [],
    notes: []
  });
  await cache.write("jp_lit_search", {
    version: 1,
    tool: "jp_lit_search",
    cache_key: fixtureCacheKey("ev-fixture"),
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
  return { baseDir, cache, sessions, exportViewTool };
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
      cache_key: fixtureCacheKey("ev1"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("ev1") },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("ev1"),
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
    expect(written).toContain(fixtureCacheKey("ev1"));
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
      cache_key: fixtureCacheKey("ev2"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("ev2") },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("ev2"),
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
    expect(written.cache_keys).toEqual([fixtureCacheKey("ev2")]);
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
      cache_key: fixtureCacheKey("ev3"),
      result_ref: { tool: "jp_lit_search", cache_key: fixtureCacheKey("ev3") },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("ev3"),
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
        cache_key: fixtureCacheKey("ev3"),
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

  it("refined_results は result refs と最新 browser provenance を表示し JSON の観測履歴を保つ", async () => {
    const baseDir = await createTempDir();
    const browserCacheKey = fixtureCacheKey("ev-browser");
    const browserRef = {
      tool: "jp_lit_record_ndl_browser_search" as const,
      cache_key: browserCacheKey
    };
    const olderObservation = {
      checked_at: "2026-09-04T12:00:00+09:00",
      login_state: "logged_out",
      query: "普通選挙法",
      access_scope: "ndl_onsite_only",
      access_label: "国立国会図書館内限定",
      snippets: [],
      item_fulltext_state: "unavailable",
      hit_locations: ["12コマ"],
      content_state: "restricted",
      print_file_state: "unavailable"
    };
    const latestObservation = {
      checked_at: "2026-09-05T12:00:00+09:00",
      login_state: "logged_in_existing_session",
      query: "普通選挙法",
      access_scope: "individual_transmission",
      access_label: "個人送信で閲覧可能",
      snippets: [{ text: "普通選挙法", locator_type: "koma", locator: "67" }],
      item_fulltext_state: "searched",
      hit_locations: ["67–73コマ"],
      content_state: "page_image_checked",
      print_file_state: "dialog_available"
    };
    const apiItem = {
      ...createSearchItem("api-item", "API 候補"),
      source_metadata: { candidate_origins: ["jp_lit_search"] }
    };
    const fulltextItem = {
      ...createSearchItem("R100000039-I1907652", "全文候補", "ndl_digital"),
      source_metadata: { candidate_origins: ["next_digital_library_fulltext"] }
    };
    const browserItem = {
      ...createSearchItem("R100000039-I1907653", "ブラウザ候補", "ndl_digital"),
      source_metadata: {
        pid: "1907653",
        candidate_origins: ["ndl_digital_browser"],
        browser_observations: [olderObservation, latestObservation]
      }
    };
    const legacyItem = createSearchItem("legacy-item", "従来候補");
    const refinedOutput: RefineResultsOutput = {
      base_cache_key: browserCacheKey,
      base_cache_keys: [browserCacheKey],
      base_result_ref: browserRef,
      base_result_refs: [browserRef],
      combine: "union",
      key_by: "source_record",
      totals_by_base: [{ ...browserRef, total: 4 }],
      total_before: 4,
      total_after: 4,
      limit: 30,
      offset: 0,
      items: [apiItem, fulltextItem, browserItem, legacyItem]
    };
    const unsupported = async (): Promise<never> => {
      throw new Error("unexpected view call");
    };
    const exportViewTool = createJpLitExportViewTool({
      listCache: unsupported,
      searchCacheIndex: unsupported,
      refineResults: async () => ({ structuredContent: refinedOutput })
    }, baseDir);
    const markdownPath = path.join(baseDir, "exports", "browser-provenance.md");
    const jsonPath = path.join(baseDir, "exports", "browser-provenance.json");

    await exportViewTool({
      view: "refined_results",
      params: { result_ref: browserRef },
      format: "markdown",
      output_path: markdownPath
    });
    await exportViewTool({
      view: "refined_results",
      params: { result_ref: browserRef },
      format: "json",
      output_path: jsonPath
    });

    const written = await readFile(markdownPath, "utf8");
    const json = JSON.parse(await readFile(jsonPath, "utf8")) as RefineResultsOutput;
    expect(written).toContain(
      `Base result refs: jp_lit_record_ndl_browser_search/${browserCacheKey}`
    );
    expect(written).toContain("Acquisition: NDL Search API");
    expect(written).toContain("Acquisition: 次世代デジタルライブラリー全文検索");
    expect(written).toContain("Acquisition: デジコレ全文検索（ブラウザ）");
    expect(written).toContain("Browser checked at: 2026-09-05T12:00:00+09:00");
    expect(written).toContain("Access: 個人送信で閲覧可能");
    expect(written).toContain("Item fulltext: searched");
    expect(written).toContain("Content: page_image_checked");
    expect(written).toContain("Print PDF: dialog_available");
    expect(written).toContain("Hit locations: 67–73コマ");
    expect(written).not.toContain("Browser checked at: 2026-09-04T12:00:00+09:00");
    expect(written).toContain("### 4. 従来候補");
    expect(written).toContain("- Source ID: legacy-item");
    expect(json.items[2]?.source_metadata?.browser_observations).toEqual([
      olderObservation,
      latestObservation
    ]);
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
        cache_key: fixtureCacheKey("ev-fixture"),
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
        cache_key: fixtureCacheKey("ev-fixture"),
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

  it("refined_results の duplicate_notes は任意の enrichment summary を markdown に含める", async () => {
    const { baseDir, cache, sessions, exportViewTool } = await createExportViewFixture([
      createSearchItem("ev-enrich-1", "吾輩は猫である", "ndl_catalog"),
      createSearchItem("ev-enrich-2", "吾輩は猫である", "cinii_books")
    ]);
    const enrichCacheKey = fixtureCacheKey("ev-enrich-record");
    await sessions.appendEntry({
      tool: "jp_lit_enrich_record",
      input: {
        title: "吾輩は猫である",
        authors: ["著者A"],
        issued_year: "1900",
        providers: ["crossref", "openalex"]
      },
      cache_key: enrichCacheKey,
      result_ref: { tool: "jp_lit_enrich_record", cache_key: enrichCacheKey },
      selected_items: [],
      notes: []
    });
    await cache.write("jp_lit_enrich_record", {
      version: 1,
      tool: "jp_lit_enrich_record",
      cache_key: enrichCacheKey,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: {
        title: "吾輩は猫である",
        authors: ["著者A"],
        issued_year: "1900",
        providers: ["crossref", "openalex"]
      },
      structured_content: createExportEnrichOutput()
    });
    const outputPath = path.join(baseDir, "exports", "refined-enrichment.md");

    await exportViewTool({
      view: "refined_results",
      params: {
        cache_key: fixtureCacheKey("ev-fixture"),
        include_enrichment: true,
        enrichment_cache_keys: [enrichCacheKey]
      },
      duplicate_notes: true,
      format: "markdown",
      output_path: outputPath
    });

    const written = await readFile(outputPath, "utf8");
    expect(written).toContain("External enrichment");
    expect(written).toContain("DOI: 10.1234/neko");
    expect(written).toContain("Enrichment confidence: high");
    expect(written).toContain(`Enrichment cache keys: ${enrichCacheKey}`);
  });

  it("requires explicit flags for external paths and existing files", async () => {
    const { baseDir, exportViewTool } = await createExportViewFixture([
      createSearchItem("ev-boundary", "境界テスト")
    ]);
    const externalDir = await createTempDir();
    const externalPath = path.join(externalDir, "external.json");
    const existingInternalPath = path.join(baseDir, "exports", "existing.json");
    const existingExternalPath = path.join(externalDir, "existing-external.json");
    const validInput = {
      view: "cache_list" as const,
      params: { tool: "jp_lit_search" as const },
      format: "json" as const
    };

    await expect(exportViewTool({
      ...validInput,
      output_path: path.join(baseDir, "exports", "..", "outside.json")
    })).rejects.toThrow(/allow_external_path/);
    await expect(exportViewTool({
      ...validInput,
      output_path: externalPath
    })).rejects.toThrow(/allow_external_path/);

    await mkdir(path.dirname(existingInternalPath), { recursive: true });
    await writeFile(existingInternalPath, "sentinel", "utf8");
    await expect(exportViewTool({
      ...validInput,
      output_path: existingInternalPath
    })).rejects.toThrow(/overwrite/);
    await expect(exportViewTool({
      ...validInput,
      output_path: existingInternalPath,
      overwrite: true
    })).resolves.toBeDefined();
    expect(await readFile(existingInternalPath, "utf8")).not.toBe("sentinel");

    await writeFile(existingExternalPath, "external sentinel", "utf8");
    await expect(exportViewTool({
      ...validInput,
      output_path: existingExternalPath,
      allow_external_path: true
    })).rejects.toThrow(/overwrite/);
    await expect(exportViewTool({
      ...validInput,
      output_path: existingExternalPath,
      allow_external_path: true,
      overwrite: true
    })).resolves.toBeDefined();
    expect(await readFile(existingExternalPath, "utf8")).not.toBe("external sentinel");
  });
});
