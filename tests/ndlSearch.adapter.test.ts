import { readFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";

function readFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`./fixtures/ndl-search/${name}`, import.meta.url),
      "utf-8"
    )
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NDL Search mappers", () => {
  it("検索結果を共通 SearchItem に正規化する", async () => {
    const searchFixture = readFixture("search-response.json");
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const result = mapNdlSearchSearchResponse(searchFixture);

    expect(result.total).toBe(2);
    expect(result.items[0]).toEqual({
      source: "ndl_search",
      source_id: "R100000039-I1000732",
      title: "吾輩は猫である",
      subtitle: "初版",
      authors: [{ name: "夏目 漱石", role: "author" }],
      publisher: "大倉書店",
      issued_at: "1905",
      issued_at_label: "1905",
      issued_at_precision: "year",
      summary: "長編小説。",
      url: "https://ndlsearch.ndl.go.jp/books/R100000039-I1000732",
      availability: {
        online: false,
        digital_collection: true
      }
    });
  });

  it("詳細結果を共通 RecordItem に正規化する", async () => {
    const recordFixture = readFixture("record-response.json");
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    const record = mapNdlSearchRecordResponse(recordFixture);

    expect(record).toMatchObject({
      source: "ndl_search",
      source_id: "R100000039-I1000732",
      title: "吾輩は猫である",
      issued_at: "1905",
      issued_at_precision: "year",
      alternative_titles: ["我輩は猫である"],
      publication_place: "東京",
      language: "jpn",
      material_type: "book",
      extent: "390p",
      subjects: ["日本小説", "明治文学"],
      identifiers: {
        jpno: "43017703",
        ndlBibId: "000000000001"
      },
      table_of_contents: ["上篇", "中篇", "下篇"],
      content_access: {
        has_page_images: true,
        has_text_coordinates: false,
        viewer_url: "https://dl.ndl.go.jp/pid/1234567",
        access_note: "国立国会図書館内限定"
      }
    });
    expect(record.source_metadata).toMatchObject({
      provider_id: "ndl-dl",
      provider_name: "国立国会図書館デジタルコレクション"
    });
    expect(record.raw).toEqual(recordFixture);
  });
});

describe("createNdlSearchAdapter", () => {
  it("OpenSearch と record endpoint を組み立てて fixture を正規化する", async () => {
    const searchFixture = readFixture("search-response.json");
    const recordFixture = readFixture("record-response.json");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => searchFixture
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => recordFixture
      });
    vi.stubGlobal("fetch", fetch);

    const { createNdlSearchAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlSearchAdapter();

    const searchResult = await adapter.search({
      query: "夏目漱石",
      limit: 5,
      page: 2
    });
    const record = await adapter.getRecord("R100000039-I1000732");

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://ndlsearch.ndl.go.jp/api/opensearch?any=%E5%A4%8F%E7%9B%AE%E6%BC%B1%E7%9F%B3&cnt=5&idx=6"
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://ndlsearch.ndl.go.jp/api/bib/external/search?cs=bib&f-token=R100000039-I1000732"
    );
    expect(searchResult.items[0]?.source_id).toBe("R100000039-I1000732");
    expect(record?.source_id).toBe("R100000039-I1000732");
  });

  it("upstream 404 の詳細取得は null を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found"
      })
    );

    const { createNdlSearchAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlSearchAdapter();

    await expect(adapter.getRecord("missing-token")).resolves.toBeNull();
  });

  it("upstream エラーは search で例外を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable"
      })
    );

    const { createNdlSearchAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlSearchAdapter();

    await expect(
      adapter.search({
        query: "夏目漱石",
        limit: 10,
        page: 1
      })
    ).rejects.toThrow("Upstream request failed: 503 Service Unavailable");
  });
});
