import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { InvalidRequestError } from "../src/lib/errors.js";
import { searchInputSchema } from "../src/lib/schemas.js";
import { createSearchService } from "../src/services/searchService.js";
import { createServer, resolveAdapterOptionsFromEnv } from "../src/server.js";
import { createJpLitSearchTool } from "../src/tools/jpLitSearch.js";
import type { SearchItem } from "../src/lib/types.js";
import type { SourceAdapter } from "../src/sources/types.js";

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
      source: undefined,
      limit: 10,
      page: 1
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

  it("search 入力スキーマで cinii_research source を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "夏目漱石",
      source: "cinii_research"
    });

    expect(parsed.source).toBe("cinii_research");
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

  it("search 入力スキーマで jstage_articles source を受け付ける", () => {
    const parsed = searchInputSchema.parse({
      query: "夏目漱石",
      source: "jstage_articles"
    });

    expect(parsed.source).toBe("jstage_articles");
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
    const ndlSearchAdapter: SourceAdapter = {
      source: "ndl_search",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_search", "1", "吾輩は猫である")]
      }),
      getRecord: async () => null
    };
    const service = createSearchService([ndlSearchAdapter]);
    const tool = createJpLitSearchTool(service);

    const result = await tool({ query: "夏目漱石", source: "ndl_search" });

    expect(result.structuredContent).toEqual({
      query: "夏目漱石",
      source: "ndl_search",
      page: 1,
      limit: 10,
      total: 1,
      items: [createSearchItem("ndl_search", "1", "吾輩は猫である")]
    });
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify(result.structuredContent, null, 2)
      }
    ]);
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
      limit: 10,
      total: 1
    });
  });

  it("server 用の環境変数から adapter URL を解決する", () => {
    const config = resolveAdapterOptionsFromEnv({
      NDL_SEARCH_BASE_URL: "https://search.example.test/api/opensearch",
      NDL_DIGITAL_BASE_URL: "https://digital.example.test/api/opensearch",
      CINII_BOOKS_HOLDINGS_BASE_URL:
        "https://ci.example.test/books/opensearch/holder"
    });

    expect(config).toEqual({
      ndlSearch: {
        searchBaseUrl: "https://search.example.test/api/opensearch",
        recordBaseUrl: "https://search.example.test/api/bib/external/search"
      },
      ndlDigital: {
        searchBaseUrl: "https://digital.example.test/api/opensearch",
        recordBaseUrl: "https://digital.example.test/api/bib/external/search"
      },
      ciniiResearch: {
        holdingsBaseUrl: "https://ci.example.test/books/opensearch/holder"
      },
      jstage: {}
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
        searchBaseUrl: "https://search.example.test/prefix/api/opensearch",
        recordBaseUrl:
          "https://search.example.test/prefix/api/bib/external/search"
      },
      ndlDigital: {
        searchBaseUrl: "https://digital.example.test/custom/api/opensearch",
        recordBaseUrl:
          "https://digital.example.test/custom/api/bib/external/search"
      },
      ciniiResearch: {},
      jstage: {}
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

  it("横断検索では cinii_research alias を除外する", async () => {
    const ciniiResearchAdapter: SourceAdapter = {
      source: "cinii_research",
      search: async () => ({
        total: 1,
        items: [createSearchItem("cinii_research", "1", "alias result")]
      }),
      getRecord: async () => null
    };
    const ciniiArticlesAdapter: SourceAdapter = {
      source: "cinii_articles",
      search: async () => ({
        total: 1,
        items: [createSearchItem("cinii_articles", "2", "article result")]
      }),
      getRecord: async () => null
    };
    const service = createSearchService([
      ciniiResearchAdapter,
      ciniiArticlesAdapter
    ]);

    const result = await service.search({
      query: "夏目漱石",
      limit: 10,
      page: 1
    });

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      createSearchItem("cinii_articles", "2", "article result")
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
});
