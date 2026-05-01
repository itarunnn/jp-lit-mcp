import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { InvalidRequestError } from "../src/lib/errors.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { searchInputSchema } from "../src/lib/schemas.js";
import { createSearchService } from "../src/services/searchService.js";
import { createServer, resolveAdapterOptionsFromEnv } from "../src/server.js";
import { createJpLitSearchTool } from "../src/tools/jpLitSearch.js";
import type { SearchItem } from "../src/lib/types.js";
import type { SourceAdapter } from "../src/sources/types.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-search-tool-"));
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
    authors: [],
    publisher: null,
    issued_at: "1905",
    issued_at_label: "1905",
    issued_at_precision: "year",
    summary: null,
    url: null,
    availability: {
      online: source === "ndl_digital",
      digital_collection: true
    },
    journal_title: null,
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

describe("createSearchService", () => {
  it("search 入力スキーマで source 省略時に既定値を補完する", () => {
    const parsed = searchInputSchema.parse({ query: "夏目漱石" });

    expect(parsed).toEqual({
      query: "夏目漱石",
      page: 1,
      force_refresh: false
    });
  });

  it("search 入力スキーマで不正な source / limit / page を拒否する", () => {
    const parsed = searchInputSchema.safeParse({
      query: "夏目漱石",
      source: "unknown_source",
      limit: 0,
      page: 0
    });

    expect(parsed.success).toBe(false);
  });

  it("search 入力スキーマで cinii_articles / cinii_books source を受け付ける", () => {
    const articles = searchInputSchema.parse({
      query: "夏目漱石",
      source: "cinii_articles"
    });
    const books = searchInputSchema.parse({
      query: "夏目漱石",
      source: "cinii_books"
    });

    expect(articles.source).toBe("cinii_articles");
    expect(books.source).toBe("cinii_books");
  });

  it("search 入力スキーマで irdb source を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "夏目漱石",
      source: "irdb"
    });

    expect(parsed.source).toBe("irdb");
  });

  it("search 入力スキーマで jdcat source を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "全国就業実態パネル調査",
      source: "jdcat"
    });

    expect(parsed.source).toBe("jdcat");
  });

  it("search 入力スキーマで sort_by / sort_order を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "夏目漱石",
      source: "ndl_catalog",
      sort_by: "title",
      sort_order: "desc"
    });

    expect(parsed.sort_by).toBe("title");
    expect(parsed.sort_order).toBe("desc");
  });

  it("search 入力スキーマで issued_from / issued_to を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "夏目漱石",
      source: "ndl_catalog",
      issued_from: "1900",
      issued_to: "1945"
    });

    expect(parsed.issued_from).toBe("1900");
    expect(parsed.issued_to).toBe("1945");
  });

  it("search 入力スキーマで NDL 系 source + filters.ndl を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "書店",
      source: "ndl_catalog",
      filters: {
        ndl: {
          subject: "書籍商",
          ndc: "024.1",
          ndlc: "UE111"
        }
      }
    });

    expect(parsed.filters?.ndl).toEqual({
      subject: "書籍商",
      ndc: "024.1",
      ndlc: "UE111"
    });
  });

  it("search 入力スキーマで jstage_articles source を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "夏目漱石",
      source: "jstage_articles"
    });

    expect(parsed.source).toBe("jstage_articles");
  });

  it("search 入力スキーマで japan_search source を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "夏目漱石",
      source: "japan_search"
    });

    expect(parsed.source).toBe("japan_search");
  });

  it("search 入力スキーマで ndl_catalog / ndl_articles / ndl_articles_online source を受け付ける", () => {
    const catalog = searchInputSchema.parse({
      query: "夏目漱石",
      source: "ndl_catalog"
    });
    const articles = searchInputSchema.parse({
      query: "夏目漱石",
      source: "ndl_articles"
    });
    const articlesOnline = searchInputSchema.parse({
      query: "夏目漱石",
      source: "ndl_articles_online"
    });

    expect(catalog.source).toBe("ndl_catalog");
    expect(articles.source).toBe("ndl_articles");
    expect(articlesOnline.source).toBe("ndl_articles_online");
  });

  it("source 指定ありで単一 source 検索を返す", async () => {
    const ndlSearchAdapter: SourceAdapter = {
      source: "ndl_search",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_search", "1", "吾輩は猫である")]
      }),
      getRecord: async () => null
    };
    const ndlDigitalAdapter: SourceAdapter = {
      source: "ndl_digital",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_digital", "2", "坊っちゃん")]
      }),
      getRecord: async () => null
    };
    const service = createSearchService([ndlSearchAdapter, ndlDigitalAdapter]);

    const result = await service.search({
      query: "夏目漱石",
      source: "ndl_search",
      limit: 10,
      page: 1
    });

    expect(result).toEqual({
      total: 1,
      items: [createSearchItem("ndl_search", "1", "吾輩は猫である")]
    });
  });

  it("tool handler が schema を通して検索結果を structuredContent で返す", async () => {
    const baseDir = await createTempDir();
    const ndlSearchAdapter: SourceAdapter = {
      source: "ndl_search",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_search", "1", "吾輩は猫である")],
        facets: {
          providers: { R100000002: 1 },
          ndc: { "9": 1 },
          issued_years: { "1905": 1 }
        }
      }),
      getRecord: async () => null
    };
    const service = createSearchService([ndlSearchAdapter]);
    const tool = createJpLitSearchTool(
      service,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({
      query: "夏目漱石",
      source: "ndl_search",
      sort_by: "title",
      sort_order: "asc"
    });

    expect(result.structuredContent).toEqual({
      query: "夏目漱石",
      source: "ndl_search",
      page: 1,
      limit: 50,
      total: 1,
      items: [createSearchItem("ndl_search", "1", "吾輩は猫である")],
      facets: {
        providers: { R100000002: 1 },
        ndc: { "9": 1 },
        issued_years: { "1905": 1 }
      },
      cache: {
        hit: false,
        cache_key: expect.any(String),
        saved_at: expect.any(String),
        refresh_hint: null
      }
    });
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify(result.structuredContent, null, 2)
      }
    ]);

    await rm(baseDir, { recursive: true, force: true });
  });

  it("tool handler は issued_from / issued_to を searchService に渡す", async () => {
    const baseDir = await createTempDir();
    const search = vi.fn().mockResolvedValue({
      total: 0,
      items: []
    });
    const service = { search } as unknown as SearchService;
    const tool = createJpLitSearchTool(
      service,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await tool({
      query: "夏目漱石",
      source: "ndl_catalog",
      issued_from: "1900",
      issued_to: "1945"
    });

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        issued_from: "1900",
        issued_to: "1945"
      })
    );

    await rm(baseDir, { recursive: true, force: true });
  });

  it("tool handler は filters.ndl を searchService に渡す", async () => {
    const baseDir = await createTempDir();
    const search = vi.fn().mockResolvedValue({
      total: 0,
      items: []
    });
    const service = { search } as unknown as SearchService;
    const tool = createJpLitSearchTool(
      service,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await tool({
      query: "書店",
      source: "ndl_catalog",
      filters: {
        ndl: {
          subject: "書籍商",
          ndc: "024.1"
        }
      }
    });

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          ndl: {
            subject: "書籍商",
            ndc: "024.1"
          }
        }
      })
    );

    await rm(baseDir, { recursive: true, force: true });
  });

  it("tool handler は source 未指定でも query/source/page/limit を返す", async () => {
    const ndlSearchAdapter: SourceAdapter = {
      source: "ndl_catalog",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_catalog", "1", "吾輩は猫である")]
      }),
      getRecord: async () => null
    };
    const service = createSearchService([ndlSearchAdapter]);
    const tool = createJpLitSearchTool(service);

    const result = await tool({ query: "夏目漱石" });

    expect(result.structuredContent).toMatchObject({
      query: "夏目漱石",
      source: null,
      page: 1,
      limit: 48,
      total: 1
    });
  });

  it("同一入力の再実行時は cache.hit=true を返す", async () => {
    const baseDir = await createTempDir();
    const ndlSearchAdapter: SourceAdapter = {
      source: "ndl_search",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_search", "1", "吾輩は猫である")]
      }),
      getRecord: async () => null
    };
    const service = createSearchService([ndlSearchAdapter]);
    const tool = createJpLitSearchTool(
      service,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const first = await tool({ query: "夏目漱石", source: "ndl_search" });
    const second = await tool({ query: "夏目漱石", source: "ndl_search" });

    expect(first.structuredContent.cache?.hit).toBe(false);
    expect(second.structuredContent.cache?.hit).toBe(true);
    expect(second.structuredContent.cache?.refresh_hint).toContain("キャッシュ結果");
  });

  it("force_refresh=true のときはキャッシュがあっても再検索する", async () => {
    const baseDir = await createTempDir();
    const search = vi
      .fn()
      .mockResolvedValueOnce({
        total: 1,
        items: [createSearchItem("ndl_search", "1", "first")]
      })
      .mockResolvedValueOnce({
        total: 1,
        items: [createSearchItem("ndl_search", "2", "second")]
      });
    const service = { search } as unknown as SearchService;
    const tool = createJpLitSearchTool(
      service,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const first = await tool({ query: "夏目漱石", source: "ndl_search" });
    const second = await tool({
      query: "夏目漱石",
      source: "ndl_search",
      force_refresh: true
    });

    expect(search).toHaveBeenCalledTimes(2);
    expect(first.structuredContent.cache?.hit).toBe(false);
    expect(second.structuredContent.cache?.hit).toBe(false);
    expect(second.structuredContent.items[0]?.source_id).toBe("2");
  });

  it("tool handler は 0 件でも requested limit を維持して schema error にならない", async () => {
    const baseDir = await createTempDir();
    const kokkaiAdapter: SourceAdapter = {
      source: "kokkai_minutes",
      search: async () => ({
        total: 0,
        items: []
      }),
      getRecord: async () => null
    };
    const service = createSearchService([kokkaiAdapter]);
    const tool = createJpLitSearchTool(
      service,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({
      query: "存在しない語",
      source: "kokkai_minutes",
      limit: 3,
      page: 1
    });

    expect(result.structuredContent).toMatchObject({
      query: "存在しない語",
      source: "kokkai_minutes",
      page: 1,
      limit: 3,
      total: 0,
      items: []
    });

    await rm(baseDir, { recursive: true, force: true });
  });

  it("横断検索では facets を source 間で合算する", async () => {
    const ndlCatalogAdapter: SourceAdapter = {
      source: "ndl_catalog",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_catalog", "1", "吾輩は猫である")],
        facets: {
          providers: { R100000002: 2 },
          ndc: { "9": 1 },
          issued_years: { "1905": 1 }
        }
      }),
      getRecord: async () => null
    };
    const ndlDigitalAdapter: SourceAdapter = {
      source: "ndl_digital",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_digital", "2", "坊っちゃん")],
        facets: {
          providers: { R100000039: 3 },
          ndc: { "9": 2 },
          issued_years: { "1906": 1 }
        }
      }),
      getRecord: async () => null
    };
    const service = createSearchService([ndlCatalogAdapter, ndlDigitalAdapter]);

    const result = await service.search({
      query: "夏目漱石",
      limit: 10,
      page: 1
    });

    expect(result.facets).toEqual({
      providers: {
        R100000002: 2,
        R100000039: 3
      },
      ndc: {
        "9": 3
      },
      issued_years: {
        "1905": 1,
        "1906": 1
      }
    });
  });

  it("server 用の環境変数から adapter URL を解決し、legacy OpenSearch 入力も SRU へ正規化する", () => {
    const config = resolveAdapterOptionsFromEnv({
      NDL_SEARCH_BASE_URL: "https://search.example.test/api/opensearch",
      NDL_DIGITAL_BASE_URL: "https://digital.example.test/api/opensearch",
      CINII_BOOKS_HOLDINGS_BASE_URL:
        "https://ci.example.test/books/opensearch/holder"
    });

    expect(config).toEqual({
      ndlSearch: {
        searchBaseUrl: "https://search.example.test/api/sru",
        recordBaseUrl: "https://search.example.test/api/bib/external/search"
      },
      ndlDigital: {
        searchBaseUrl: "https://digital.example.test/api/sru",
        recordBaseUrl: "https://digital.example.test/api/bib/external/search"
      },
      ciniiResearch: {
        holdingsBaseUrl: "https://ci.example.test/books/opensearch/holder"
      },
      irdb: {},
      jdcat: {},
      jstage: {},
      japanSearch: {},
      kokkai: {},
      teikoku: {},
      nihuBridge: {}
    });
  });

  it("path prefix 付きの base URL でも adapter URL の prefix を保持する", () => {
    const config = resolveAdapterOptionsFromEnv({
      NDL_SEARCH_BASE_URL: "https://search.example.test/prefix/api/opensearch",
      NDL_DIGITAL_BASE_URL:
        "https://digital.example.test/custom/api/bib/external/search"
    });

    expect(config).toEqual({
      ndlSearch: {
        searchBaseUrl: "https://search.example.test/prefix/api/sru",
        recordBaseUrl:
          "https://search.example.test/prefix/api/bib/external/search"
      },
      ndlDigital: {
        searchBaseUrl: "https://digital.example.test/custom/api/sru",
        recordBaseUrl:
          "https://digital.example.test/custom/api/bib/external/search"
      },
      ciniiResearch: {},
      irdb: {},
      jdcat: {},
      jstage: {},
      japanSearch: {},
      kokkai: {},
      teikoku: {},
      nihuBridge: {}
    });
  });

  it("SRU URL を渡した場合はそのまま search / record URL を解決する", () => {
    const config = resolveAdapterOptionsFromEnv({
      NDL_SEARCH_BASE_URL: "https://search.example.test/prefix/api/sru",
      NDL_DIGITAL_BASE_URL: "https://digital.example.test/custom/api/sru"
    });

    expect(config).toEqual({
      ndlSearch: {
        searchBaseUrl: "https://search.example.test/prefix/api/sru",
        recordBaseUrl:
          "https://search.example.test/prefix/api/bib/external/search"
      },
      ndlDigital: {
        searchBaseUrl: "https://digital.example.test/custom/api/sru",
        recordBaseUrl:
          "https://digital.example.test/custom/api/bib/external/search"
      },
      ciniiResearch: {},
      irdb: {},
      jdcat: {},
      jstage: {},
      japanSearch: {},
      kokkai: {},
      teikoku: {},
      nihuBridge: {}
    });
  });

  it("createServer 経由で tools/list に outputSchema を公開する", async () => {
    const server = createServer();
    const client = new Client({
      name: "jp-lit-search-test-client",
      version: "1.0.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const { tools } = await client.listTools();
      const searchTool = tools.find((tool) => tool.name === "jp_lit_search");
      const recordTool = tools.find((tool) => tool.name === "jp_lit_get_record");

      expect(searchTool?.outputSchema?.properties).toMatchObject({
        query: { type: "string" },
        source: {},
        page: { type: "integer" },
        limit: { type: "integer" },
        total: { type: "integer" },
        items: { type: "array" }
      });
      expect(recordTool?.outputSchema?.properties).toMatchObject({
        source: {},
        source_id: { type: "string" },
        title: { type: "string" },
        content_access: { type: "object" }
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("source 未指定では全 source を横断検索して件数を合算する", async () => {
    const ndlCatalogAdapter: SourceAdapter = {
      source: "ndl_catalog",
      search: async () => ({
        total: 2,
        items: [
          createSearchItem("ndl_catalog", "1", "吾輩は猫である"),
          createSearchItem("ndl_catalog", "2", "こころ")
        ]
      }),
      getRecord: async () => null
    };
    const ndlDigitalAdapter: SourceAdapter = {
      source: "ndl_digital",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_digital", "3", "坊っちゃん")]
      }),
      getRecord: async () => null
    };
    const service = createSearchService([ndlCatalogAdapter, ndlDigitalAdapter]);

    const result = await service.search({
      query: "夏目漱石",
      limit: 2,
      page: 1
    });

    expect(result.total).toBe(3);
    expect(result.items).toEqual([
      createSearchItem("ndl_catalog", "1", "吾輩は猫である"),
      createSearchItem("ndl_digital", "3", "坊っちゃん")
    ]);
  });

  it("横断検索では source ごとにラウンドロビンで結果を混在させる", async () => {
    const ndlCatalogAdapter: SourceAdapter = {
      source: "ndl_catalog",
      search: async () => ({
        total: 3,
        items: [
          createSearchItem("ndl_catalog", "1", "ndl-1"),
          createSearchItem("ndl_catalog", "2", "ndl-2"),
          createSearchItem("ndl_catalog", "3", "ndl-3")
        ]
      }),
      getRecord: async () => null
    };
    const ndlDigitalAdapter: SourceAdapter = {
      source: "ndl_digital",
      search: async () => ({
        total: 2,
        items: [
          createSearchItem("ndl_digital", "4", "digital-1"),
          createSearchItem("ndl_digital", "5", "digital-2")
        ]
      }),
      getRecord: async () => null
    };
    const ndlArticlesOnlineAdapter: SourceAdapter = {
      source: "ndl_articles_online",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_articles_online", "8", "online-1")]
      }),
      getRecord: async () => null
    };
    const ciniiBooksAdapter: SourceAdapter = {
      source: "cinii_books",
      search: async () => ({
        total: 2,
        items: [
          createSearchItem("cinii_books", "6", "book-1"),
          createSearchItem("cinii_books", "7", "book-2")
        ]
      }),
      getRecord: async () => null
    };
    const jstageArticlesAdapter: SourceAdapter = {
      source: "jstage_articles",
      search: async () => ({
        total: 1,
        items: [createSearchItem("jstage_articles", "9", "jstage-1")]
      }),
      getRecord: async () => null
    };
    const service = createSearchService([
      ndlCatalogAdapter,
      ndlDigitalAdapter,
      ndlArticlesOnlineAdapter,
      jstageArticlesAdapter,
      ciniiBooksAdapter
    ]);

    const result = await service.search({
      query: "夏目漱石",
      limit: 6,
      page: 1
    });

    expect(result.total).toBe(9);
    expect(result.items).toEqual([
      createSearchItem("ndl_catalog", "1", "ndl-1"),
      createSearchItem("ndl_digital", "4", "digital-1"),
      createSearchItem("ndl_articles_online", "8", "online-1"),
      createSearchItem("jstage_articles", "9", "jstage-1"),
      createSearchItem("cinii_books", "6", "book-1"),
      createSearchItem("ndl_catalog", "2", "ndl-2")
    ]);
  });

  it("横断検索では複数 source に跨る同一候補へ duplicate 情報を付ける", async () => {
    const ndlCatalogAdapter: SourceAdapter = {
      source: "ndl_catalog",
      search: async () => ({
        total: 1,
        items: [
          {
            ...createSearchItem("ndl_catalog", "1", "吾輩は猫である"),
            authors: [{ name: "夏目漱石", role: "author" }],
            issued_at: "1905"
          }
        ]
      }),
      getRecord: async () => null
    };
    const ciniiBooksAdapter: SourceAdapter = {
      source: "cinii_books",
      search: async () => ({
        total: 1,
        items: [
          {
            ...createSearchItem("cinii_books", "2", "吾輩は猫である"),
            authors: [{ name: "夏目 漱石", role: "author" }],
            issued_at: "1905"
          }
        ]
      }),
      getRecord: async () => null
    };
    const service = createSearchService([ndlCatalogAdapter, ciniiBooksAdapter]);

    const result = await service.search({
      query: "夏目漱石",
      limit: 10,
      page: 1
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      source: "ndl_catalog",
      duplicate_count: 2,
      related_records: [
        {
          source: "cinii_books",
          source_id: "2",
          title: "吾輩は猫である",
          url: null
        }
      ]
    });
    expect(result.items[1]).toMatchObject({
      source: "cinii_books",
      duplicate_count: 2,
      related_records: [
        {
          source: "ndl_catalog",
          source_id: "1",
          title: "吾輩は猫である",
          url: null
        }
      ]
    });
    expect(result.items[0]?.duplicate_key).toBeTruthy();
    expect(result.items[0]?.duplicate_key).toBe(result.items[1]?.duplicate_key);
  });

  it("単一 source 検索では duplicate 情報を既定値のまま返す", async () => {
    const ndlSearchAdapter: SourceAdapter = {
      source: "ndl_search",
      search: async () => ({
        total: 1,
        items: [
          {
            ...createSearchItem("ndl_search", "1", "吾輩は猫である"),
            duplicate_key: "unexpected",
            duplicate_count: 99
          }
        ]
      }),
      getRecord: async () => null
    };
    const service = createSearchService([ndlSearchAdapter]);

    const result = await service.search({
      query: "夏目漱石",
      source: "ndl_search",
      limit: 10,
      page: 1
    });

    expect(result.items).toEqual([createSearchItem("ndl_search", "1", "吾輩は猫である")]);
  });

  it("横断検索で page が 2 以上なら InvalidRequestError を投げる", async () => {
    const ndlCatalogAdapter: SourceAdapter = {
      source: "ndl_catalog",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_catalog", "1", "吾輩は猫である")]
      }),
      getRecord: async () => null
    };
    const ndlSearchAdapter: SourceAdapter = {
      source: "ndl_search",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_search", "9", "all-result")]
      }),
      getRecord: async () => null
    };
    const ndlDigitalAdapter: SourceAdapter = {
      source: "ndl_digital",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_digital", "2", "坊っちゃん")]
      }),
      getRecord: async () => null
    };
    const service = createSearchService([
      ndlCatalogAdapter,
      ndlSearchAdapter,
      ndlDigitalAdapter
    ]);

    await expect(
      service.search({
        query: "夏目漱石",
        limit: 10,
        page: 2
      })
    ).rejects.toThrow(InvalidRequestError);
  });

  it("横断検索の既定 source から ndl_search は除外する", async () => {
    const ndlSearchAdapter: SourceAdapter = {
      source: "ndl_search",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_search", "9", "all-result")]
      }),
      getRecord: async () => null
    };
    const ndlCatalogAdapter: SourceAdapter = {
      source: "ndl_catalog",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_catalog", "1", "catalog-result")]
      }),
      getRecord: async () => null
    };
    const service = createSearchService([ndlSearchAdapter, ndlCatalogAdapter]);

    const result = await service.search({
      query: "夏目漱石",
      limit: 10,
      page: 1
    });

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      createSearchItem("ndl_catalog", "1", "catalog-result")
    ]);
  });

  it("search 入力スキーマで source=irdb + filters.irdb を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "夏目漱石",
      source: "irdb",
      filters: { irdb: { fulltext: true, title: "こころ", author: "夏目漱石" } }
    });
    expect(parsed.source).toBe("irdb");
    expect(parsed.filters?.irdb?.fulltext).toBe(true);
    expect(parsed.filters?.irdb?.title).toBe("こころ");
    expect(parsed.filters?.irdb?.author).toBe("夏目漱石");
  });

  it("search 入力スキーマで source=irdb + filters なしを受け付ける", () => {
    const parsed = searchInputSchema.parse({ query: "夏目漱石", source: "irdb" });
    expect(parsed.filters).toBeUndefined();
  });

  it("search 入力スキーマで source=ndl_catalog + filters.irdb を reject する", () => {
    const result = searchInputSchema.safeParse({
      query: "夏目漱石",
      source: "ndl_catalog",
      filters: { irdb: { fulltext: true } }
    });
    expect(result.success).toBe(false);
  });

  it("search 入力スキーマで source なし + filters.irdb を reject する", () => {
    const result = searchInputSchema.safeParse({
      query: "夏目漱石",
      filters: { irdb: { author: "夏目漱石" } }
    });
    expect(result.success).toBe(false);
  });

  it("search 入力スキーマで nihu_bridge source を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "源氏物語",
      source: "nihu_bridge"
    });
    expect(parsed.source).toBe("nihu_bridge");
  });

  it("search 入力スキーマで source=nihu_bridge + filters.nihu_bridge を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "源氏物語",
      source: "nihu_bridge",
      filters: {
        nihu_bridge: {
          institute: ["nijl"],
          normalize: false,
          period_from: "1185",
          period_to: "1600",
          bbox: { lat1: 35.02, lon1: 135.68, lat2: 34.94, lon2: 135.79 }
        }
      }
    });
    expect(parsed.source).toBe("nihu_bridge");
    expect(parsed.filters?.nihu_bridge?.institute).toEqual(["nijl"]);
    expect(parsed.filters?.nihu_bridge?.normalize).toBe(false);
    expect(parsed.filters?.nihu_bridge?.bbox?.lat1).toBeCloseTo(35.02);
  });

  it("search 入力スキーマで source=ndl_catalog + filters.nihu_bridge を reject する", () => {
    const result = searchInputSchema.safeParse({
      query: "源氏物語",
      source: "ndl_catalog",
      filters: { nihu_bridge: { institute: ["nijl"] } }
    });
    expect(result.success).toBe(false);
  });

  it("search 入力スキーマで source なし + filters.nihu_bridge を reject する", () => {
    const result = searchInputSchema.safeParse({
      query: "源氏物語",
      filters: { nihu_bridge: { institute: ["nijl"] } }
    });
    expect(result.success).toBe(false);
  });

  it("search 入力スキーマで NDL 系以外の source + filters.ndl を reject する", () => {
    const result = searchInputSchema.safeParse({
      query: "書店",
      source: "cinii_books",
      filters: { ndl: { subject: "書籍商" } }
    });

    expect(result.success).toBe(false);
  });
});
