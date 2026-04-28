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

function readSruFixture(name: string): string {
  return readFileSync(
    new URL(`./fixtures/ndl-sru/${name}`, import.meta.url),
    "utf-8"
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NDL Digital mappers", () => {
  it("legacy RSS/XML をデジコレ用 SearchItem に正規化する", async () => {
    const xml = readTextFixture("search-response.xml");
    const { projectNdlSearchLegacyRssXml } = await import(
      "../src/sources/ndlSearch/projectOpenSearch.js"
    );
    const { mapNdlDigitalSearchResponse } = await import(
      "../src/sources/ndlDigital/mapSearch.js"
    );

    const projected = projectNdlSearchLegacyRssXml(xml);
    const result = mapNdlDigitalSearchResponse(projected);

    expect(result.total).toBe(92);
    expect(result.items).toEqual([
      {
        source: "ndl_digital",
        source_id: "R100000039-I1012769",
        title: "国立国会図書館年報",
        subtitle: "昭和63年度",
        title_reading: null,
        authors: [{ name: "国立国会図書館", role: "author" }],
        publisher: "国立国会図書館",
        journal_title: null,
        issued_at: "1989-12-22",
        issued_at_label: "1989-12-22",
        issued_at_precision: "day",
        summary: null,
        url: "https://ndlsearch.ndl.go.jp/books/R100000039-I1012769",
        availability: {
          online: false,
          digital_collection: true
        },
        material_type: "雑誌",
        subjects: [],
        table_of_contents: [],
        duplicate_key: null,
        duplicate_count: 1,
        related_records: []
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
        title_reading: null,
        authors: [{ name: "国立国会図書館", role: "author" }],
        publisher: "国立国会図書館",
        journal_title: null,
        issued_at: "1989-12-22",
        issued_at_label: "1989-12-22",
        issued_at_precision: "day",
        summary: null,
        url: "https://ndlsearch.ndl.go.jp/books/R100000039-I1012769",
        availability: {
          online: false,
          digital_collection: true
        },
        material_type: null,
        subjects: [],
        table_of_contents: [],
        duplicate_key: null,
        duplicate_count: 1,
        related_records: []
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
    const { projectNdlSearchDetailXml } = await import(
      "../src/sources/ndlSearch/projectOpenSearch.js"
    );
    const { mapNdlDigitalRecordResponse } = await import(
      "../src/sources/ndlDigital/mapRecord.js"
    );

    const record = mapNdlDigitalRecordResponse(projectNdlSearchDetailXml(xml));

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
      journal_title: null,
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
    const searchFixture = readSruFixture("search-ndl-digital.xml");
    const recordFixture = readFixture("record-response.json");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => searchFixture
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
        json: async () => ({ id: "1000732", title: "国立国会図書館年報" })
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

    expect(fetch).toHaveBeenCalledTimes(3);
    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    const recordUrl = new URL(fetch.mock.calls[1][0] as string);

    expect(searchUrl.origin + searchUrl.pathname).toBe(
      "https://ndlsearch.ndl.go.jp/api/sru"
    );
    expect(searchUrl.searchParams.get("operation")).toBe("searchRetrieve");
    expect(searchUrl.searchParams.get("recordSchema")).toBe("dcndl");
    expect(searchUrl.searchParams.get("recordPacking")).toBe("xml");
    expect(searchUrl.searchParams.get("maximumRecords")).toBe("5");
    expect(searchUrl.searchParams.get("startRecord")).toBe("6");
    expect(searchUrl.searchParams.get("query")).toContain("dpid=ndl-dl");
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
    const searchXml = readSruFixture("search-ndl-digital.xml");
    const recordXml = readTextFixture("record-response.xml");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
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
        json: async () => ({ id: "1000732" })
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

    expect(searchResult.total).toBe(5112380);
    expect(searchResult.items[0]).toMatchObject({
      source: "ndl_digital",
      source_id: "R100000002-I000001268385"
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
    ).rejects.toThrow(/searchRetrieveResponse|SRU XML/i);
  });

  it("search は SRU endpoint に dpid=ndl-dl を含む CQL query を送る", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => readSruFixture("search-ndl-digital.xml")
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();

    await adapter.search({ query: "漱石", limit: 5, page: 1 });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/api/sru");
    expect(calledUrl.searchParams.get("operation")).toBe("searchRetrieve");
    expect(calledUrl.searchParams.get("recordSchema")).toBe("dcndl");
    expect(calledUrl.searchParams.get("recordPacking")).toBe("xml");
    expect(calledUrl.searchParams.get("query")).toContain("dpid=ndl-dl");
    expect(calledUrl.searchParams.get("query")).toContain('anywhere="漱石"');
  });

  it("ndl_digital でも sort_by / sort_order を sortBy に変換する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => readSruFixture("search-ndl-digital.xml")
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();

    await adapter.search({
      query: "漱石",
      limit: 5,
      page: 1,
      sort_by: "issued_date",
      sort_order: "asc"
    });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("sortBy")).toBe(
      "issued_date/sort.ascending"
    );
  });
});

describe("ndl_digital bridge: next_digital_library", () => {
  function makeBookApiMock(payload: unknown) {
    return {
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === "content-type"
            ? "application/json; charset=utf-8"
            : null;
        }
      },
      json: async () => payload
    };
  }

  function makeRecordApiMock(payload: unknown) {
    return {
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === "content-type"
            ? "application/json; charset=utf-8"
            : null;
        }
      },
      json: async () => payload
    };
  }

  it("PID が解決でき Book API が成功すれば next_digital_library.available=true になる", async () => {
    const recordFixture = readFixture("record-response.json");
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(makeRecordApiMock(recordFixture))
        .mockResolvedValueOnce(makeBookApiMock({ id: "1000732", title: "国立国会図書館年報" }))
    );

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();
    const record = await adapter.getRecord("R100000039-I1000732");

    expect(record?.source_metadata.next_digital_library).toMatchObject({
      pid: "1000732",
      available: true,
      reason: null,
      book_api_url: "https://lab.ndl.go.jp/dl/api/book/1000732"
    });
  });

  it("Book API が null を返せば next_digital_library.available=false になる", async () => {
    const recordFixture = readFixture("record-response.json");
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(makeRecordApiMock(recordFixture))
        .mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" })
    );

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();
    const record = await adapter.getRecord("R100000039-I1000732");

    expect(record?.source_metadata.next_digital_library).toMatchObject({
      pid: "1000732",
      available: false,
      reason: "not_indexed_in_next_digital_library",
      book_api_url: "https://lab.ndl.go.jp/dl/api/book/1000732"
    });
  });

  it("PID が解決できなければ next_digital_library=null になる", async () => {
    const recordFixture = {
      ...(readFixture("record-response.json") as Record<string, unknown>),
      identifiers: {},
      viewerUrl: null,
      url: "https://example.test/no-pid"
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(makeRecordApiMock(recordFixture))
    );

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();
    const record = await adapter.getRecord("R100000039-I1000732");

    expect(record?.source_metadata.next_digital_library).toBeNull();
  });

  it("Book API のネットワークエラーは getRecord から伝播する", async () => {
    const recordFixture = readFixture("record-response.json");
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(makeRecordApiMock(recordFixture))
        .mockRejectedValueOnce(new TypeError("fetch failed"))
    );

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();

    await expect(adapter.getRecord("R100000039-I1000732")).rejects.toBeInstanceOf(TypeError);
  });

  it("Book API のレスポンスから total_page / public_domain / online_pdf が next_digital_library に含まれる", async () => {
    const recordFixture = readFixture("record-response.json");
    const bookFixture = readFixture("../next-digital-library/book-response.json");
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(makeRecordApiMock(recordFixture))
        .mockResolvedValueOnce(makeBookApiMock(bookFixture))
    );

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();
    const record = await adapter.getRecord("R100000039-I1000732");

    expect(record?.source_metadata.next_digital_library).toEqual({
      pid: "1000732",
      available: true,
      reason: null,
      book_api_url: "https://lab.ndl.go.jp/dl/api/book/1000732",
      total_page: 12,
      public_domain: true,
      online_pdf: false
    });
  });

  it("Book API が null を返せば total_page / public_domain / online_pdf はすべて null になる", async () => {
    const recordFixture = readFixture("record-response.json");
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(makeRecordApiMock(recordFixture))
        .mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" })
    );

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter();
    const record = await adapter.getRecord("R100000039-I1000732");

    expect(record?.source_metadata.next_digital_library).toEqual({
      pid: "1000732",
      available: false,
      reason: "not_indexed_in_next_digital_library",
      book_api_url: "https://lab.ndl.go.jp/dl/api/book/1000732",
      total_page: null,
      public_domain: null,
      online_pdf: null
    });
  });

  it("Book API URL は nextDlBaseUrl オプションに従う", async () => {
    const recordFixture = readFixture("record-response.json");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeRecordApiMock(recordFixture))
      .mockResolvedValueOnce(makeBookApiMock({ id: "1000732" }));
    vi.stubGlobal("fetch", fetchMock);

    const { createNdlDigitalAdapter } = await import(
      "../src/sources/ndlDigital/adapter.js"
    );
    const adapter = createNdlDigitalAdapter({
      nextDlBaseUrl: "http://localhost:9999/dl/api"
    });
    const record = await adapter.getRecord("R100000039-I1000732");

    const bookApiCallUrl = fetchMock.mock.calls[1]?.[0] as string;
    expect(bookApiCallUrl).toBe("http://localhost:9999/dl/api/book/1000732");
    expect(record?.source_metadata.next_digital_library).toMatchObject({
      pid: "1000732",
      book_api_url: "http://localhost:9999/dl/api/book/1000732"
    });
  });

  it("目次あり resource で table_of_contents が t35050 から抽出される", async () => {
    const recordFixture = readFixture("record-toc.json");
    const { mapNdlDigitalRecordResponse } = await import(
      "../src/sources/ndlDigital/mapRecord.js"
    );

    const record = mapNdlDigitalRecordResponse(recordFixture);

    expect(record?.table_of_contents).toEqual([
      "標題紙",
      "帝国図書館沿革略 (1)",
      "帝国図書館官制 (3)",
      "古版及古写本類 (94)"
    ]);
  });

  it("目次行ヘッダ（v=目次）は table_of_contents から除外される", async () => {
    const recordFixture = readFixture("record-toc.json");
    const { mapNdlDigitalRecordResponse } = await import(
      "../src/sources/ndlDigital/mapRecord.js"
    );

    const record = mapNdlDigitalRecordResponse(recordFixture);

    expect(record?.table_of_contents).not.toContain("目次");
  });
});
