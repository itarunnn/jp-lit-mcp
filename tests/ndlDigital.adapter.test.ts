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

function readTextFixture(name: string): string {
  return readFileSync(
    new URL(`./fixtures/ndl-digital/${name}`, import.meta.url),
    "utf-8"
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NDL Digital mappers", () => {
  it("OpenSearch XML をデジコレ用 SearchItem に正規化する", async () => {
    const xml = readTextFixture("search-response.xml");
    const { projectNdlSearchOpenSearchXml } = await import(
      "../src/sources/ndlSearch/projectOpenSearch.js"
    );
    const { mapNdlDigitalSearchResponse } = await import(
      "../src/sources/ndlDigital/mapSearch.js"
    );

    const projected = projectNdlSearchOpenSearchXml(xml);
    const result = mapNdlDigitalSearchResponse(projected);

    expect(result.total).toBe(92);
    expect(result.items).toEqual([
      {
        source: "ndl_digital",
        source_id: "R100000039-I1012769",
        title: "国立国会図書館年報",
        subtitle: "昭和63年度",
        authors: [{ name: "国立国会図書館", role: "author" }],
        publisher: "国立国会図書館",
        issued_at: "1989-12-22",
        issued_at_label: "1989-12-22",
        issued_at_precision: "day",
        summary: null,
        url: "https://ndlsearch.ndl.go.jp/books/R100000039-I1012769",
        availability: {
          online: false,
          digital_collection: true
        }
      }
    ]);
  });

  it("検索結果を共通 SearchItem に正規化する", async () => {
    const searchFixture = readFixture("search-response.json");
    const { mapNdlDigitalSearchResponse } = await import(
      "../src/sources/ndlDigital/mapSearch.js"
    );

    const result = mapNdlDigitalSearchResponse(searchFixture);

    expect(result.total).toBe(92);
    expect(result.items).toEqual([
      {
        source: "ndl_digital",
        source_id: "R100000039-I1012769",
        title: "国立国会図書館年報",
        subtitle: "昭和63年度",
        authors: [{ name: "国立国会図書館", role: "author" }],
        publisher: "国立国会図書館",
        issued_at: "1989-12-22",
        issued_at_label: "1989-12-22",
        issued_at_precision: "day",
        summary: null,
        url: "https://ndlsearch.ndl.go.jp/books/R100000039-I1012769",
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

  it("record XML 投影でも providerName を使ってデジコレ判定できる", async () => {
    const xml = readTextFixture("record-response.xml");
    const { projectNdlSearchOpenSearchXml } = await import(
      "../src/sources/ndlSearch/projectOpenSearch.js"
    );
    const { mapNdlDigitalRecordResponse } = await import(
      "../src/sources/ndlDigital/mapRecord.js"
    );

    const record = mapNdlDigitalRecordResponse(projectNdlSearchOpenSearchXml(xml));

    expect(record).toMatchObject({
      source: "ndl_digital",
      source_id: "R100000039-I1000732",
      title: "国立国会図書館年報",
      content_access: {
        has_page_images: true,
        has_text_coordinates: false,
        viewer_url: "https://dl.ndl.go.jp/pid/1000732",
        access_note: "インターネット公開"
      }
    });
    expect(record?.source_metadata).toMatchObject({
      provider_id: null,
      provider_name: "国立国会図書館デジタルコレクション"
    });
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
      title: "国立国会図書館年報",
      authors: [{ name: "国立国会図書館総務部", role: "author" }],
      publisher: "国立国会図書館",
      issued_at: null,
      issued_at_precision: "unknown",
      alternative_titles: ["Annual report of the National Diet Library"],
      publication_place: "日本",
      language: "jpn",
      material_type: "電子書籍・電子雑誌",
      extent: null,
      subjects: [],
      identifiers: {
        issn: "1349-0621",
        issnl: "0385-325X",
        ndljp: "info:ndljp/pid/1000732"
      },
      table_of_contents: [],
      content_access: {
        has_page_images: true,
        has_text_coordinates: false,
        viewer_url: "https://dl.ndl.go.jp/pid/1000732",
        access_note: "インターネット公開"
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

  it("providerId が無くても providerName だけで雑に通さず digitalCollection も要求する", async () => {
    const recordFixture = {
      ...(readFixture("record-response.json") as Record<string, unknown>),
      providerId: undefined,
      providerName: "国立国会図書館デジタルコレクション",
      digitalCollection: false
    };
    const { mapNdlDigitalRecordResponse } = await import(
      "../src/sources/ndlDigital/mapRecord.js"
    );

    expect(mapNdlDigitalRecordResponse(recordFixture)).toBeNull();
  });

  it("providerId が無く providerName が別事業者なら digitalCollection=true でも弾く", async () => {
    const recordFixture = {
      ...(readFixture("record-response.json") as Record<string, unknown>),
      providerId: undefined,
      providerName: "他機関デジタルアーカイブ",
      digitalCollection: true
    };
    const { mapNdlDigitalRecordResponse } = await import(
      "../src/sources/ndlDigital/mapRecord.js"
    );

    expect(mapNdlDigitalRecordResponse(recordFixture)).toBeNull();
  });

  it("live JSON detail で複数 items がある場合は digital item を選んで ndl_digital に正規化する", async () => {
    const sourceId = "R100000002-I000001061332";
    const payload = {
      list: [
        {
          id: sourceId,
          meta: {
            t02451: [{ v: "ああ八月十五日 : 終戦の思い出. 第2集" }],
            t0245c: [{ v: "八幡師友会" }],
            t02600: [{ v: "八幡師友会", l: "北九州" }],
            k00410: [{ v: "jpn" }],
            k09022: [{ v: "図書" }],
            t02604: [{ v: "1964" }]
          },
          items: [
            {
              id: sourceId,
              type: ["ndl"],
              meta: {
                k80404: [{ v: "国立国会図書館サーチ" }]
              }
            },
            {
              id: sourceId,
              type: ["ndl", "digital", "accessible"],
              meta: {
                k39020: [{ v: "インターネット公開" }],
                k39022: [{ v: "デジタル" }],
                k30012: [{ v: "https://dl.ndl.go.jp/pid/1234567" }],
                k80404: [{ v: "国立国会図書館デジタルコレクション" }],
                k31000: [
                  {
                    v: "info:ndljp/pid/1234567",
                    i: "https://dl.ndl.go.jp/pid/1234567"
                  }
                ]
              }
            }
          ]
        }
      ]
    };
    const { mapNdlDigitalRecordResponse } = await import(
      "../src/sources/ndlDigital/mapRecord.js"
    );

    const record = mapNdlDigitalRecordResponse(payload);

    expect(record).toMatchObject({
      source: "ndl_digital",
      source_id: sourceId,
      content_access: {
        has_page_images: true,
        viewer_url: "https://dl.ndl.go.jp/pid/1234567",
        access_note: "インターネット公開"
      },
      source_metadata: {
        provider_id: null,
        provider_name: "国立国会図書館デジタルコレクション"
      }
    });
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

  it("search() / getRecord() は XML payload を live fallback で正規化する", async () => {
    const searchXml = readTextFixture("search-response.xml");
    const recordXml = readTextFixture("record-response.xml");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type"
              ? "application/rss+xml; charset=utf-8"
              : null;
          }
        },
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
        text: async () => searchXml
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type"
              ? "application/rss+xml; charset=utf-8"
              : null;
          }
        },
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
        text: async () => recordXml
      });
    vi.stubGlobal("fetch", fetch);

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();

    const searchResult = await adapter.search({
      query: "国立国会図書館年報",
      limit: 3,
      page: 1
    });
    const record = await adapter.getRecord("R100000039-I1000732");

    expect(searchResult.total).toBe(92);
    expect(searchResult.items[0]).toMatchObject({
      source: "ndl_digital",
      source_id: "R100000039-I1012769"
    });
    expect(record).toMatchObject({
      source: "ndl_digital",
      source_id: "R100000039-I1000732",
      source_metadata: {
        provider_id: null,
        provider_name: "国立国会図書館デジタルコレクション"
      },
      content_access: {
        viewer_url: "https://dl.ndl.go.jp/pid/1000732",
        access_note: "インターネット公開"
      }
    });
  });

  it("XML でも JSON でもない search payload は UnsupportedPayloadError を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type"
              ? "text/html; charset=utf-8"
              : null;
          }
        },
        text: async () => "<html><body>bad payload</body></html>"
      })
    );

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();

    await expect(
      adapter.search({
        query: "夏目漱石",
        limit: 10,
        page: 1
      })
    ).rejects.toThrow(/payload required/i);
  });
});
