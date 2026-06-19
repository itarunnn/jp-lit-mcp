import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createExternalWorkEnricher } from "../src/sources/externalWork/enrichRecord.js";
import { createOpenAlexClient } from "../src/sources/externalWork/openalexClient.js";
import { createJpLitEnrichRecordTool } from "../src/tools/jpLitEnrichRecord.js";
import type { ExternalLookupResult } from "../src/sources/externalWork/types.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-enrich-record-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_enrich_record", () => {
  it("normalizes DOI before caching and does not include force_refresh in the cache key", async () => {
    const service = {
      enrich: vi.fn().mockResolvedValue({
        query: {
          doi: "10.1234/genji",
          title: null,
          authors: [],
          issued_year: null
        },
        providers: {
          crossref: { status: "ok", item_count: 1, note: null },
          openalex: { status: "skipped", item_count: 0, note: "OPENALEX_API_KEY is not set." }
        },
        matches: [
          {
            provider: "crossref",
            id: "10.1234/genji",
            doi: "10.1234/genji",
            title: "源氏物語研究",
            authors: ["山田 太郎"],
            issued_year: "2020",
            url: "https://doi.org/10.1234/genji",
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
      })
    };
    const baseDir = await createTempDir();
    const tool = createJpLitEnrichRecordTool(
      service,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const first = await tool({ doi: "https://doi.org/10.1234/GENJI", force_refresh: true });
    const second = await tool({ doi: "doi:10.1234/genji" });

    expect(service.enrich).toHaveBeenCalledTimes(1);
    expect(service.enrich).toHaveBeenCalledWith({
      doi: "10.1234/genji",
      title: null,
      authors: [],
      issued_year: null,
      providers: ["crossref", "openalex"]
    });
    expect(first.structuredContent.cache?.hit).toBe(false);
    expect(second.structuredContent.cache?.hit).toBe(true);
    expect(second.structuredContent.query.doi).toBe("10.1234/genji");
  });

  it("keeps OpenAlex skipped in the default provider set when api key is missing", async () => {
    const crossrefResult: ExternalLookupResult = {
      provider: "crossref",
      status: "not_found",
      note: null,
      item_count: 0,
      items: []
    };
    const crossrefClient = {
      lookup: vi.fn().mockResolvedValue(crossrefResult)
    };
    const openAlexFetcher = vi.fn();
    const service = createExternalWorkEnricher({
      crossrefClient,
      openalexClient: createOpenAlexClient({
        apiKey: "",
        fetcher: openAlexFetcher
      })
    });
    const baseDir = await createTempDir();
    const tool = createJpLitEnrichRecordTool(
      service,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ title: "源氏物語研究" });

    expect(crossrefClient.lookup).toHaveBeenCalledTimes(1);
    expect(openAlexFetcher).not.toHaveBeenCalled();
    expect(result.structuredContent.providers.openalex).toMatchObject({
      status: "skipped",
      item_count: 0
    });
    expect(result.structuredContent.matches).toEqual([]);
  });

  it("separates cache entries by OpenAlex key presence without storing the key value", async () => {
    const baseDir = await createTempDir();
    const firstService = {
      enrich: vi.fn().mockResolvedValue({
        query: {
          doi: null,
          title: "源氏物語研究",
          authors: [],
          issued_year: null
        },
        providers: {
          crossref: { status: "not_found", item_count: 0, note: null },
          openalex: { status: "skipped", item_count: 0, note: "OPENALEX_API_KEY is not set." }
        },
        matches: [],
        caution: "Crossref/OpenAlex の一致は書誌確認の補助で、本文到達性や重要度を保証しません。"
      })
    };
    const secondService = {
      enrich: vi.fn().mockResolvedValue({
        query: {
          doi: null,
          title: "源氏物語研究",
          authors: [],
          issued_year: null
        },
        providers: {
          crossref: { status: "not_found", item_count: 0, note: null },
          openalex: { status: "ok", item_count: 0, note: null }
        },
        matches: [],
        caution: "Crossref/OpenAlex の一致は書誌確認の補助で、本文到達性や重要度を保証しません。"
      })
    };
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const withoutKey = createJpLitEnrichRecordTool(firstService, cache, sessions, {
      openalexKeyPresent: false
    });
    const withKey = createJpLitEnrichRecordTool(secondService, cache, sessions, {
      openalexKeyPresent: true
    });

    const first = await withoutKey({ title: "源氏物語研究" });
    const second = await withKey({ title: "源氏物語研究" });

    expect(firstService.enrich).toHaveBeenCalledTimes(1);
    expect(secondService.enrich).toHaveBeenCalledTimes(1);
    expect(first.structuredContent.cache?.hit).toBe(false);
    expect(second.structuredContent.cache?.hit).toBe(false);
    expect(first.structuredContent.cache?.cache_key).not.toBe(second.structuredContent.cache?.cache_key);
    expect(first.structuredContent.cache?.cache_key).not.toContain("OPENALEX");
    expect(second.structuredContent.cache?.cache_key).not.toContain("OPENALEX");
  });

  it("requires either DOI or title", async () => {
    const service = { enrich: vi.fn() };
    const tool = createJpLitEnrichRecordTool(service);

    await expect(tool({ authors: ["山田太郎"] })).rejects.toThrow(/doi|title/);
  });
});
