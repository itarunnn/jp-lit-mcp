import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`./fixtures/ndl-digital/${name}`, import.meta.url),
      "utf-8"
    )
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NDL Digital mappers", () => {
  it("検索結果を共通 SearchItem に正規化する", async () => {
    const searchFixture = readFixture("search-response.json");
    const { mapNdlDigitalSearchResponse } = await import(
      "../src/sources/ndlDigital/mapSearch.js"
    );

    const result = mapNdlDigitalSearchResponse(searchFixture);

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      {
        source: "ndl_digital",
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
      }
    ]);
  });

  it("検索 total は digital filter 後の件数に潰さず upstream total を保持する", async () => {
    const { mapNdlDigitalSearchResponse } = await import(
      "../src/sources/ndlDigital/mapSearch.js"
    );

    const result = mapNdlDigitalSearchResponse({
      totalResults: 10,
      items: [
        {
          id: "digital-item",
          title: "デジタル資料",
          digitalCollection: true,
          providerId: "ndl-dl"
        },
        {
          id: "other-item",
          title: "他 provider 資料",
          digitalCollection: false,
          providerId: "other-provider"
        }
      ]
    });

    expect(result.total).toBe(10);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.source_id).toBe("digital-item");
  });

  it("詳細結果を共通 RecordItem に正規化し content_access を埋める", async () => {
    const recordFixture = readFixture("record-response.json");
    const { mapNdlDigitalRecordResponse } = await import(
      "../src/sources/ndlDigital/mapRecord.js"
    );

    const record = mapNdlDigitalRecordResponse(recordFixture);

    expect(record).toMatchObject({
      source: "ndl_digital",
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
      table_of_contents: [],
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

  it("providerId が明示的に ndl-dl 以外なら null を返す", async () => {
    const recordFixture = {
      ...(readFixture("record-response.json") as Record<string, unknown>),
      providerId: "other-provider"
    };
    const { mapNdlDigitalRecordResponse } = await import(
      "../src/sources/ndlDigital/mapRecord.js"
    );

    expect(mapNdlDigitalRecordResponse(recordFixture)).toBeNull();
  });

  it("digitalCollection が欠落していたら安全側で null を返す", async () => {
    const recordFixture = {
      ...(readFixture("record-response.json") as Record<string, unknown>)
    };
    delete recordFixture.digitalCollection;
    const { mapNdlDigitalRecordResponse } = await import(
      "../src/sources/ndlDigital/mapRecord.js"
    );

    expect(mapNdlDigitalRecordResponse(recordFixture)).toBeNull();
  });

  it("viewerUrl がなくても dl.ndl.go.jp の URL から fallback する", async () => {
    const recordFixture = {
      ...(readFixture("record-response.json") as Record<string, unknown>),
      viewerUrl: undefined,
      url: "https://dl.ndl.go.jp/pid/7654321"
    };
    const { mapNdlDigitalRecordResponse } = await import(
      "../src/sources/ndlDigital/mapRecord.js"
    );

    const record = mapNdlDigitalRecordResponse(recordFixture);

    expect(record).not.toBeNull();
    expect(record?.content_access.viewer_url).toBe(
      "https://dl.ndl.go.jp/pid/7654321"
    );
  });
});

describe("createNdlDigitalAdapter", () => {
  it("NDL Search API に dpid=ndl-dl を付けて fixture を正規化する", async () => {
    const searchFixture = readFixture("search-response.json");
    const recordFixture = readFixture("record-response.json");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type"
              ? "application/json; charset=utf-8"
              : null;
          }
        },
        json: async () => searchFixture
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type"
              ? "application/json; charset=utf-8"
              : null;
          }
        },
        json: async () => recordFixture
      });
    vi.stubGlobal("fetch", fetch);

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();

    const searchResult = await adapter.search({
      query: "夏目漱石",
      limit: 5,
      page: 2
    });
    const record = await adapter.getRecord("R100000039-I1000732");

    expect(fetch).toHaveBeenCalledTimes(2);
    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    const recordUrl = new URL(fetch.mock.calls[1][0] as string);

    expect(searchUrl.origin + searchUrl.pathname).toBe(
      "https://ndlsearch.ndl.go.jp/api/opensearch"
    );
    expect(searchUrl.searchParams.get("any")).toBe("夏目漱石");
    expect(searchUrl.searchParams.get("cnt")).toBe("5");
    expect(searchUrl.searchParams.get("idx")).toBe("6");
    expect(searchUrl.searchParams.get("dpid")).toBe("ndl-dl");
    expect(recordUrl.origin + recordUrl.pathname).toBe(
      "https://ndlsearch.ndl.go.jp/api/bib/external/search"
    );
    expect(recordUrl.searchParams.get("cs")).toBe("bib");
    expect(recordUrl.searchParams.get("f-token")).toBe("R100000039-I1000732");
    expect(searchResult.items[0]?.source).toBe("ndl_digital");
    expect(record?.source).toBe("ndl_digital");
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

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();

    await expect(adapter.getRecord("missing-token")).resolves.toBeNull();
  });

  it("search() は upstream 500 をそのまま失敗として返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: {
          get() {
            return "application/json; charset=utf-8";
          }
        }
      })
    );

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();

    await expect(
      adapter.search({
        query: "夏目漱石",
        limit: 5,
        page: 1
      })
    ).rejects.toMatchObject({
      name: "UpstreamHttpError",
      status: 500
    });
  });
});
