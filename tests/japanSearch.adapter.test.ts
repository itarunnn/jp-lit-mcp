import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`./fixtures/japan-search/${name}`, import.meta.url),
      "utf-8"
    )
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Japan Search mappers", () => {
  it("検索結果 JSON を共通 SearchItem に正規化する", async () => {
    const fixture = readFixture("search-response.json");
    const { mapJapanSearchSearchResponse } = await import(
      "../src/sources/japanSearch/mapSearch.js"
    );

    const result = mapJapanSearchSearchResponse(fixture);

    expect(result.total).toBe(9306);
    expect(result.items).toEqual([
      {
        source: "japan_search",
        source_id: "ukansai-R100000114_I000002469_00",
        title: "[夏目漱石書簡]",
        subtitle: null,
        title_reading: "ナツメ ソウセキ ショカン",
        authors: [
          { name: "夏目漱石", role: "author" },
          { name: "夏目漱石著.--[自筆].", role: "author" }
        ],
        publisher: null,
        journal_title: null,
        issued_at: null,
        issued_at_label: null,
        issued_at_precision: "unknown",
        summary: null,
        url: "https://www.iiif.ku-orcas.kansai-u.ac.jp/books/207849153",
        availability: {
          online: true,
          digital_collection: true
        },
        material_type: "古書・古文書",
        subjects: ["古書・古文書"],
        table_of_contents: [],
        duplicate_key: null,
        duplicate_count: 1,
        related_records: []
      }
    ]);
  });

  it("item detail JSON を共通 RecordItem に正規化する", async () => {
    const fixture = readFixture("record-response.json");
    const { mapJapanSearchRecordResponse } = await import(
      "../src/sources/japanSearch/mapRecord.js"
    );

    const record = mapJapanSearchRecordResponse(fixture);

    expect(record).toMatchObject({
      source: "japan_search",
      source_id: "ukansai-R100000114_I000002469_00",
      title: "[夏目漱石書簡]",
      journal_title: null,
      summary: "コレクション : 関西大学東アジアデジタルアーカイブ",
      material_type: "古書・古文書",
      extent: "手紙：20.2㎝×199.5㎝封筒：21.6㎝×16.7㎝",
      subjects: ["古書・古文書"],
      content_access: {
        has_page_images: true,
        has_text_coordinates: false,
        viewer_url: "https://www.iiif.ku-orcas.kansai-u.ac.jp/iiif/books/207849153/manifest.json",
        access_note: "pdm"
      }
    });
  });
});

describe("Japan Search mapSearch fallback URL", () => {
  it("linkUrl がない場合は jpsearch.go.jp/item/{source_id} を url に使う", async () => {
    const { mapJapanSearchSearchEntry } = await import(
      "../src/sources/japanSearch/mapSearch.js"
    );

    const entry = {
      id: "test-12345",
      common: {
        id: "test-12345",
        title: "テスト資料",
        contentsAccess: "closed"
      }
    };

    const item = mapJapanSearchSearchEntry(entry);

    expect(item.source_id).toBe("test-12345");
    expect(item.url).toBe("https://jpsearch.go.jp/item/test-12345");
  });

  it("linkUrl がある場合は linkUrl を優先する", async () => {
    const { mapJapanSearchSearchEntry } = await import(
      "../src/sources/japanSearch/mapSearch.js"
    );

    const entry = {
      id: "test-12345",
      common: {
        id: "test-12345",
        title: "テスト資料",
        contentsAccess: "internet",
        linkUrl: "https://example.com/resource/12345"
      }
    };

    const item = mapJapanSearchSearchEntry(entry);

    expect(item.url).toBe("https://example.com/resource/12345");
  });

  it("source_id も取れない場合は url は null になる", async () => {
    const { mapJapanSearchSearchEntry } = await import(
      "../src/sources/japanSearch/mapSearch.js"
    );

    const item = mapJapanSearchSearchEntry({});

    expect(item.source_id).toBe("missing-jps-id");
    expect(item.url).toBeNull();
  });
});

describe("createJapanSearchAdapter", () => {
  it("検索 API と item API を組み立てて正規化する", async () => {
    const searchFixture = readFixture("search-response.json");
    const recordFixture = readFixture("record-response.json");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get() {
            return "application/json; charset=utf-8";
          }
        },
        json: async () => searchFixture
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get() {
            return "application/json; charset=utf-8";
          }
        },
        json: async () => recordFixture
      });
    vi.stubGlobal("fetch", fetch);

    const { createJapanSearchAdapter } = await import(
      "../src/sources/japanSearch/adapter.js"
    );
    const adapter = createJapanSearchAdapter();

    const searchResult = await adapter.search({
      query: "夏目漱石",
      limit: 5,
      page: 2
    });
    const record = await adapter.getRecord("ukansai-R100000114_I000002469_00");

    expect(fetch).toHaveBeenCalledTimes(2);
    const searchUrl = new URL(fetch.mock.calls[0][0] as string);

    expect(searchUrl.origin + searchUrl.pathname).toBe(
      "https://jpsearch.go.jp/api/item/search/jps-cross"
    );
    expect(searchUrl.searchParams.get("keyword")).toBe("夏目漱石");
    expect(searchUrl.searchParams.get("size")).toBe("5");
    expect(searchUrl.searchParams.get("from")).toBe("5");
    expect(fetch.mock.calls[1][0]).toBe(
      "https://jpsearch.go.jp/api/item/ukansai-R100000114_I000002469_00"
    );
    expect(searchResult.items[0]?.source).toBe("japan_search");
    expect(record?.source).toBe("japan_search");
  });
});
