import { describe, expect, it } from "vitest";

import { createSearchService } from "../src/services/searchService.js";
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
});
