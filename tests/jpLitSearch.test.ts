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
    }
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
      source: "ndl_search",
      search: async () => ({
        total: 1,
        items: [createSearchItem("ndl_search", "1", "吾輩は猫である")]
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
      NDL_DIGITAL_BASE_URL: "https://digital.example.test/api/opensearch"
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
      ciniiResearch: {}
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
      ciniiResearch: {}
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
    const ndlSearchAdapter: SourceAdapter = {
      source: "ndl_search",
      search: async () => ({
        total: 2,
        items: [
          createSearchItem("ndl_search", "1", "吾輩は猫である"),
          createSearchItem("ndl_search", "2", "こころ")
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
    const service = createSearchService([ndlSearchAdapter, ndlDigitalAdapter]);

    const result = await service.search({
      query: "夏目漱石",
      limit: 2,
      page: 1
    });

    expect(result.total).toBe(3);
    expect(result.items).toEqual([
      createSearchItem("ndl_search", "1", "吾輩は猫である"),
      createSearchItem("ndl_search", "2", "こころ")
    ]);
  });

  it("横断検索で page が 2 以上なら InvalidRequestError を投げる", async () => {
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

    await expect(
      service.search({
        query: "夏目漱石",
        limit: 10,
        page: 2
      })
    ).rejects.toThrow(InvalidRequestError);
  });
});
