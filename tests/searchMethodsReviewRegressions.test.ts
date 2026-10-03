import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { mapCiniiSearchResponseForSource } from "../src/sources/ciniiResearch/mapSearch.js";
import { mapJstageSearchResponse } from "../src/sources/jstage/mapSearch.js";
import { mapNdlSearchSearchResponse } from "../src/sources/ndlSearch/mapSearch.js";
import { projectNdlSruSearchResponse } from "../src/sources/ndlSearch/parseSru.js";
import { createCiniiArticlesAdapter } from "../src/sources/ciniiResearch/adapter.js";
import { createJstageArticlesAdapter } from "../src/sources/jstage/adapter.js";
import { createSearchService } from "../src/services/searchService.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitSearchTool } from "../src/tools/jpLitSearch.js";
import { buildSearchMethodsManifest } from "../src/lib/persistence/searchMethods.js";

const dirs: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); for (const dir of dirs.splice(0))
  await rm(dir, {
    recursive: true,
    force: true
  }); });
it.each([null, ""])('keeps CiNii coerced legacy total unknown: %s', raw => {
  const result = mapCiniiSearchResponseForSource({
    "opensearch:totalResults": raw,
    items: [{
        title: "one",
        "@id": "https://cir.nii.ac.jp/crid/1"
      }]
  }, "cinii_articles");
  expect(result.total).toBe(0);
  expect(result.items).toHaveLength(1);
  expect(result.summary).toMatchObject({
    reported_total: null,
    total_basis: "unknown"
  });
});
it("distinguishes genuine CiNii item fallback from numeric coercion", () => {
  const payload = {
    items: [{
        title: "one",
        "@id": "https://cir.nii.ac.jp/crid/1"
      }]
  };
  expect(mapCiniiSearchResponseForSource(payload, "cinii_articles")).toMatchObject({
    total: 1,
    summary: {
      total_basis: "returned_count"
    }
  });
  expect(mapCiniiSearchResponseForSource({
    ...payload,
    "opensearch:totalResults": -1
  }, "cinii_articles")).toMatchObject({
    total: -1,
    summary: {
      reported_total: null,
      total_basis: "unknown"
    }
  });
});
it.each(["", '<opensearch:totalResults/>'])("keeps J-STAGE and NDL empty totals distinct from item fallback: %s", total => {
  const jstage = mapJstageSearchResponse(`<feed><result><status>0</status></result>${total}<entry><title>one</title></entry></feed>`);
  expect(jstage).toMatchObject({
    total: 0,
    summary: {
      reported_total: null,
      total_basis: "unknown"
    }
  });
  expect(jstage.items).toHaveLength(1);
  const ndl = mapNdlSearchSearchResponse({
    items: [{
        title: "one"
      }]
  });
  expect(ndl).toMatchObject({
    total: 0,
    summary: {
      reported_total: null,
      total_basis: "unknown"
    }
  });
  expect(ndl.items).toHaveLength(1);
});
it.each(["", "invalid"])("preserves raw SRU missing/invalid count provenance: %s", raw => {
  const xml = readFileSync("tests/fixtures/ndl-sru/search-ndl-catalog-dcndl-xml.xml", "utf8").replace(/<numberOfRecords>.*?<\/numberOfRecords>/, raw ? `<numberOfRecords>${raw}</numberOfRecords>` : "");
  const result = mapNdlSearchSearchResponse(projectNdlSruSearchResponse(xml));
  expect(result.total).toBe(0);
  expect(result.items.length).toBeGreaterThan(0);
  expect(result.summary).toMatchObject({
    reported_total: null,
    total_basis: "unknown"
  });
});
it("keeps corrected total provenance in response, session snapshot and methods", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-review-"));
  dirs.push(dir);
  const sessions = createSessionStore(dir), cache = createFileCache(dir), session = await sessions.startSession();
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({
    "opensearch:totalResults": null,
    items: [{
        title: "one",
        "@id": "https://cir.nii.ac.jp/crid/1"
      }]
  }), {
    headers: {
      "content-type": "application/json"
    }
  }));
  const result = await createJpLitSearchTool(createSearchService([createCiniiArticlesAdapter()]), cache, sessions)({
    session_id: session.session_id,
    source: "cinii_articles",
    query: "q"
  });
  expect(result.structuredContent).toMatchObject({
    total: 0,
    search_context: {
      total_semantics: "unknown",
      sources: [{
          total_basis: "unknown",
          fetched_count: 1
        }]
    }
  });
  const saved = await sessions.readById(session.session_id);
  expect(saved.entries[0]!.method_snapshot?.context?.total_semantics).toBe("unknown");
  expect(buildSearchMethodsManifest(saved, new Map(), new Date().toISOString()).methods[0]!.sources[0]!.total_basis).toBe("unknown");
});
it("preserves cross partial success when failed request description throws", async () => {
  const healthy = {
    source: "cinii_books" as const,
    getRecord: async () => null,
    search: async () => ({
      total: 1,
      items: mapCiniiSearchResponseForSource({
        items: [{
            title: "one",
            "@id": "https://cir.nii.ac.jp/crid/1"
          }]
      }, "cinii_books").items
    })
  };
  const result = await createSearchService([healthy, createJstageArticlesAdapter({
      searchBaseUrl: "not-a-url"
    })]).search({
    query: "q",
    page: 1
  });
  expect(result.items).toHaveLength(1);
  expect(result.source_errors).toMatchObject([{
      source: "jstage_articles",
      category: "unknown"
    }]);
  expect(result.sources[0]).toMatchObject({
    source: "jstage_articles",
    outcome: "failed",
    request: null,
    error_category: "unknown",
    fetched_count: null,
    included_count: 0
  });
});
it("preserves successful items even if optional request description throws", async () => {
  const result = await createSearchService([{
      source: "cinii_books",
      getRecord: async () => null,
      search: async () => ({
        total: 0,
        items: [],
        summary: {
          outcome: "completed",
          reported_total: 0,
          total_basis: "source_reported"
        }
      }),
      describeSearch: () => { throw Error("bad description"); }
    }]).search({
    source: "cinii_books",
    query: "q",
    page: 1
  });
  expect(result.sources[0]).toMatchObject({
    outcome: "completed",
    reported_total: 0,
    request: null,
    error_category: null
  });
});
