import { createCiniiArticlesAdapter } from "../../src/sources/ciniiResearch/adapter.js";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createFileCache } from "../../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../../src/lib/persistence/sessionStore.js";
import { createSearchService } from "../../src/services/searchService.js";
import { createJpLitSearchTool } from "../../src/tools/jpLitSearch.js";
import { mapCiniiSearchResponseForSource } from "../../src/sources/ciniiResearch/mapSearch.js";
import { UpstreamTimeoutError } from "../../src/lib/http.js";
import type { SourceAdapter } from "../../src/sources/types.js";

const dirs: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); for (const dir of dirs.splice(0))
  await rm(dir, {
    recursive: true,
    force: true
  }); });

function adapter(source: SourceAdapter["source"], count = 30): SourceAdapter {
  return {
    source,
    getRecord: async () => null,
    search: vi.fn(async () => ({
      total: 100,
      items: Array.from({
        length: count
      }, (_, i) => ({
        ...mapCiniiSearchResponseForSource({
          items: [{
              title: `title${i}`,
              "@id": `https://cir.nii.ac.jp/crid/${i}`
            }]
        }, "cinii_articles").items[0]!,
        source
      }))
    }))
  };
}
it("distinguishes fetched and included counts in registered cross order", async () => {
  const sources = ["cinii_books", "ndl_catalog", "jstage_articles"] as const;
  const adapters = sources.map(s => adapter(s));
  const result = await createSearchService(adapters).search({
    query: "q",
    page: 1
  });
  expect(result.items).toHaveLength(48);
  expect(result.sources.map(s => s.source)).toEqual(["ndl_catalog", "jstage_articles", "cinii_books"]);
  expect(result.sources.every(s => s.fetched_count === 30 && s.included_count === 16 && s.total_basis === "unknown" && s.request === null)).toBe(true);
  expect(result.total_semantics).toBe("sum_of_source_totals");
  expect(result.fetch_limit_per_source).toBe(30);
});
it("keeps timeout and fulfilled provider failures visible", async () => {
  const timeout = adapter("ndl_catalog");
  timeout.search = async () => { throw new UpstreamTimeoutError(1); };
  const failed = adapter("jstage_articles", 0);
  failed.search = async () => ({
    total: 0,
    items: [],
    summary: {
      outcome: "failed",
      reported_total: null,
      total_basis: "unknown"
    }
  });
  const result = await createSearchService([timeout, failed, adapter("cinii_books", 1)]).search({
    query: "q",
    page: 1
  });
  expect(result.sources[0]).toMatchObject({
    outcome: "failed",
    fetched_count: null,
    included_count: 0,
    error_category: "timeout"
  });
  expect(result.sources[1]).toMatchObject({
    outcome: "failed",
    fetched_count: null,
    error_category: "unknown"
  });
});
it("keeps per-session snapshots across shared-cache refresh and hits", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-method-"));
  dirs.push(dir);
  const cache = createFileCache(dir), sessions = createSessionStore(dir);
  const a = await sessions.startSession(), b = await sessions.startSession();
  const source = adapter("cinii_articles", 1);
  const tool = createJpLitSearchTool(createSearchService([source]), cache, sessions);
  const first = await tool({
    session_id: a.session_id,
    query: "A𠮷",
    source: "cinii_articles"
  });
  const saved = await sessions.readById(a.session_id);
  expect(saved.entries[0]?.method_snapshot).toMatchObject({
    cache_hit: false,
    returned_count: 1,
    context: {
      query_script: "mixed",
      schema_version: 1
    }
  });
  const hit = await tool({
    session_id: b.session_id,
    query: "A𠮷",
    source: "cinii_articles"
  });
  expect(source.search).toHaveBeenCalledTimes(1);
  expect(hit.structuredContent.search_context).toEqual(first.structuredContent.search_context);
  expect((await sessions.readById(b.session_id)).entries[0]?.method_snapshot).toMatchObject({
    cache_hit: true,
    result_saved_at: saved.entries[0]?.method_snapshot?.result_saved_at
  });
  await tool({
    session_id: b.session_id,
    query: "A𠮷",
    source: "cinii_articles",
    force_refresh: true
  });
  expect((await sessions.readById(a.session_id)).entries).toEqual(saved.entries);
});
it("keeps legacy cache context unrecorded", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-method-"));
  dirs.push(dir);
  const cache = createFileCache(dir), sessions = createSessionStore(dir), source = adapter("cinii_articles", 0);
  const session = await sessions.startSession();
  const tool = createJpLitSearchTool(createSearchService([source]), cache, sessions);
  const first = await tool({
    session_id: session.session_id,
    query: "q",
    source: "cinii_articles"
  });
  const key = first.structuredContent.cache!.cache_key;
  const envelope = await cache.read<any>("jp_lit_search", key);
  delete envelope!.structured_content.search_context;
  envelope!.saved_at = "2000-01-01T00:00:00.000Z";
  await cache.write("jp_lit_search", envelope!);
  const hit = await tool({
    session_id: session.session_id,
    query: "q",
    source: "cinii_articles"
  });
  expect(hit.structuredContent.search_context).toBeUndefined();
  expect((await sessions.readById(session.session_id)).entries[0]?.method_snapshot).toMatchObject({
    context: null,
    result_saved_at: envelope!.saved_at
  });
});
it("does not persist adapter credentials in context, cache or session", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-method-secret-"));
  dirs.push(dir);
  const cache = createFileCache(dir), sessions = createSessionStore(dir), session = await sessions.startSession();
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({
    items: [],
    "opensearch:totalResults": "0"
  }), {
    headers: {
      "content-type": "application/json"
    }
  }));
  const source = createCiniiArticlesAdapter({
    appId: "PRIVATE_SENTINEL",
    searchBaseUrl: "https://user:PRIVATE_SENTINEL@example.org/opensearch/articles?token=PRIVATE_SENTINEL"
  });
  const result = await createJpLitSearchTool(createSearchService([source]), cache, sessions)({
    session_id: session.session_id,
    query: "q",
    source: "cinii_articles"
  });
  const saved = await cache.read("jp_lit_search", result.structuredContent.cache!.cache_key);
  expect(JSON.stringify([result.structuredContent, saved, await sessions.readById(session.session_id)])).not.toContain("PRIVATE_SENTINEL");
});
