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

function readTextFixture(name: string): string {
  return readFileSync(
    new URL(`./fixtures/ndl-search/${name}`, import.meta.url),
    "utf-8"
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NDL Search mappers", () => {
  it("OpenSearch XML を mapper が読める shape に投影できる", async () => {
    const xml = readTextFixture("search-response.xml");
    const { projectNdlSearchOpenSearchXml } = await import(
      "../src/sources/ndlSearch/projectOpenSearch.js"
    );
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const projected = projectNdlSearchOpenSearchXml(xml);
    const result = mapNdlSearchSearchResponse(projected);

    expect(result.total).toBe(542);
    expect(result.items).toEqual([
      {
        source: "ndl_search",
        source_id: "R100000039-I1000732",
        title: "国立国会図書館年報",
        subtitle: null,
        authors: [{ name: "国立国会図書館総務部", role: "author" }],
        publisher: "国立国会図書館",
        issued_at: null,
        issued_at_label: null,
        issued_at_precision: "unknown",
        summary: null,
        url: "https://ndlsearch.ndl.go.jp/books/R100000039-I1000732",
        availability: {
          online: false,
          digital_collection: true
        },
        duplicate_key: null,
        duplicate_count: 1,
        related_records: []
      }
    ]);
    expect(projected.items[0]).toMatchObject({
      providerId: null,
      viewerUrl: "https://dl.ndl.go.jp/pid/1000732",
      hasPageImages: true,
      digitalCollection: true
    });
  });

  it("検索結果を共通 SearchItem に正規化する", async () => {
    const searchFixture = readFixture("search-response.json");
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const result = mapNdlSearchSearchResponse(searchFixture);

    expect(result.total).toBe(542);
    expect(result.items).toEqual([
      {
        source: "ndl_search",
        source_id: "R100000039-I1000732",
        title: "国立国会図書館年報",
        subtitle: null,
        authors: [{ name: "国立国会図書館総務部", role: "author" }],
        publisher: "国立国会図書館",
        issued_at: null,
        issued_at_label: null,
        issued_at_precision: "unknown",
        summary: null,
        url: "https://ndlsearch.ndl.go.jp/books/R100000039-I1000732",
        availability: {
          online: false,
          digital_collection: true
        },
        duplicate_key: null,
        duplicate_count: 1,
        related_records: []
      }
    ]);
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

  it("detail endpoint の live JSON shape を共通 RecordItem に正規化する", async () => {
    const recordFixture = readFixture("record-response.json") as Record<
      string,
      unknown
    >;
    const liveRecordFixture = (recordFixture._fixture as { liveResponseExtract: unknown })
      .liveResponseExtract;
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    const record = mapNdlSearchRecordResponse(liveRecordFixture);

    expect(record).toMatchObject({
      source: "ndl_search",
      source_id: "R100000039-I1000732",
      title: "国立国会図書館年報",
      authors: [{ name: "国立国会図書館総務部", role: "author" }],
      publisher: "国立国会図書館",
      alternative_titles: ["Annual report of the National Diet Library"],
      publication_place: "日本",
      language: "jpn",
      material_type: "電子書籍・電子雑誌",
      identifiers: {
        issn: "1349-0621",
        issnl: "0385-325X",
        ndljp: "info:ndljp/pid/1000732"
      },
      content_access: {
        has_page_images: true,
        has_text_coordinates: false,
        viewer_url: "https://dl.ndl.go.jp/pid/1000732",
        access_note: "インターネット公開"
      }
    });
    expect(record.source_metadata).toMatchObject({
      provider_id: null,
      provider_name: "国立国会図書館デジタルコレクション"
    });
  });

  it("k30012 欠落時は k31000.i を安全に viewer_url fallback として使う", async () => {
    const recordFixture = readFixture("record-response.json") as Record<
      string,
      unknown
    >;
    const liveRecordFixture = JSON.parse(
      JSON.stringify((recordFixture._fixture as { liveResponseExtract: unknown }).liveResponseExtract)
    ) as {
      list?: Array<{
        items?: Array<{
          meta?: Record<string, unknown>;
        }>;
      }>;
    };
    const itemMeta = liveRecordFixture.list?.[0]?.items?.[0]?.meta;
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    expect(itemMeta).toBeTruthy();
    delete itemMeta?.k30012;

    const record = mapNdlSearchRecordResponse(liveRecordFixture);

    expect(record.availability).toMatchObject({
      online: true,
      digital_collection: true
    });
    expect(record.content_access).toMatchObject({
      has_page_images: true,
      viewer_url: "https://dl.ndl.go.jp/pid/1000732"
    });
  });

  it("k30012 も k31000.i も無い場合は viewer 判定を立てない", async () => {
    const recordFixture = readFixture("record-response.json") as Record<
      string,
      unknown
    >;
    const liveRecordFixture = JSON.parse(
      JSON.stringify((recordFixture._fixture as { liveResponseExtract: unknown }).liveResponseExtract)
    ) as {
      list?: Array<{
        items?: Array<{
          meta?: Record<string, unknown>;
        }>;
      }>;
    };
    const itemMeta = liveRecordFixture.list?.[0]?.items?.[0]?.meta;
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    expect(itemMeta).toBeTruthy();
    delete itemMeta?.k30012;
    delete itemMeta?.k39020;
    itemMeta!.k31000 = [
      {
        v: "info:ndljp/pid/1000732"
      }
    ];

    const record = mapNdlSearchRecordResponse(liveRecordFixture);

    expect(record.availability).toMatchObject({
      online: false,
      digital_collection: true
    });
    expect(record.content_access).toMatchObject({
      has_page_images: false,
      viewer_url: null,
      access_note: null
    });
  });

  it("live JSON detail で複数 items がある場合は digital item を優先して content_access を拾う", async () => {
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
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    const record = mapNdlSearchRecordResponse(payload);

    expect(record).toMatchObject({
      source_id: sourceId,
      availability: {
        online: true,
        digital_collection: true
      },
      content_access: {
        has_page_images: true,
        viewer_url: "https://dl.ndl.go.jp/pid/1234567",
        access_note: "インターネット公開"
      },
      source_metadata: {
        provider_name: "国立国会図書館デジタルコレクション"
      }
    });
  });

  it("record XML を mapper が読める shape に投影できる", async () => {
    const xml = readTextFixture("record-response.xml");
    const { projectNdlSearchOpenSearchXml } = await import(
      "../src/sources/ndlSearch/projectOpenSearch.js"
    );
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    const record = mapNdlSearchRecordResponse(projectNdlSearchOpenSearchXml(xml));

    expect(record).toMatchObject({
      source: "ndl_search",
      source_id: "R100000039-I1000732",
      title: "国立国会図書館年報",
      authors: [{ name: "国立国会図書館総務部", role: "author" }],
      publisher: "国立国会図書館",
      alternative_titles: ["Annual report of the National Diet Library"],
      publication_place: "日本",
      language: "jpn",
      material_type: "電子書籍・電子雑誌",
      identifiers: {
        issn: "1349-0621",
        issnl: "0385-325X",
        ndljp: "info:ndljp/pid/1000732"
      },
      content_access: {
        has_page_images: true,
        has_text_coordinates: false,
        viewer_url: "https://dl.ndl.go.jp/pid/1000732",
        access_note: "インターネット公開"
      }
    });
    expect(record.source_metadata).toMatchObject({
      provider_id: null,
      provider_name: "国立国会図書館デジタルコレクション"
    });
  });

  it("channel.item が単体 object でも namespaced/nested 値を読める", async () => {
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const result = mapNdlSearchSearchResponse({
      channel: {
        totalResults: "1",
        item: {
          link: "https://ndlsearch.ndl.go.jp/books/R100000002-I000000001",
          "dc:title": {
            "rdf:Description": {
              "rdf:value": "こころ"
            }
          },
          "dc:creator": [
            {
              "rdf:Description": {
                "rdf:value": "夏目 漱石"
              }
            },
            "校訂者A"
          ],
          "dcterms:publisher": {
            name: "岩波書店"
          },
          "dcterms:issued": {
            "rdf:Description": {
              "rdf:value": "1914"
            }
          },
          "dcterms:abstract": {
            "rdf:Description": {
              "rdf:value": "長編小説。"
            }
          },
          dpid: "iss-ndl-opac"
        }
      }
    });

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      {
        source: "ndl_search",
        source_id: "R100000002-I000000001",
        title: "こころ",
        subtitle: null,
        authors: [
          { name: "夏目 漱石", role: "author" },
          { name: "校訂者A", role: "author" }
        ],
        publisher: "岩波書店",
        issued_at: "1914",
        issued_at_label: "1914",
        issued_at_precision: "year",
        summary: "長編小説。",
        url: "https://ndlsearch.ndl.go.jp/books/R100000002-I000000001",
        availability: {
          online: false,
          digital_collection: false
        },
        duplicate_key: null,
        duplicate_count: 1,
        related_records: []
      }
    ]);
  });

  it("rss.channel 形の payload でも検索結果と total を拾える", async () => {
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const result = mapNdlSearchSearchResponse({
      rss: {
        channel: {
          "openSearch:totalResults": "1",
          item: {
            link: "https://ndlsearch.ndl.go.jp/books/R100000002-I000000099",
            "dc:title": "坊っちゃん",
            "dc:creator": "夏目 漱石",
            "dcterms:issued": "1906"
          }
        }
      }
    });

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        source: "ndl_search",
        source_id: "R100000002-I000000099",
        title: "坊っちゃん",
        authors: [{ name: "夏目 漱石", role: "author" }],
        issued_at: "1906",
        issued_at_label: "1906",
        issued_at_precision: "year",
        url: "https://ndlsearch.ndl.go.jp/books/R100000002-I000000099"
      })
    ]);
  });

  it("複数 item と複数属性ノードでも許可された属性だけを値として読む", async () => {
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const result = mapNdlSearchSearchResponse({
      channel: {
        totalResults: "2",
        item: [
          {
            "rdfs:seeAlso": [
              {
                "@_xml:lang": "ja",
                "@_rdf:resource":
                  "https://ndlsearch.ndl.go.jp/books/R100000002-I000000123"
              }
            ],
            "dc:title": "多属性テスト1",
            "dc:creator": [{ "#text": "著者1" }],
            "dcterms:publisher": [
              {
                "@_xml:lang": "ja",
                "@_xsi:type": "ignored"
              },
              {
                "#text": "版元A"
              }
            ],
            category: ["デジタル"]
          },
          {
            link: "https://ndlsearch.ndl.go.jp/books/R100000002-I000000124",
            "dc:title": "多属性テスト2",
            "dc:creator": [
              {
                "@_role": "ignored",
                "#text": "著者2"
              }
            ],
            "dcterms:abstract": [
              {
                "@_xml:lang": "ja"
              },
              {
                "#text": "抄録B"
              }
            ]
          }
        ]
      }
    });

    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      {
        source: "ndl_search",
        source_id: "R100000002-I000000123",
        title: "多属性テスト1",
        subtitle: null,
        authors: [{ name: "著者1", role: "author" }],
        publisher: "版元A",
        issued_at: null,
        issued_at_label: null,
        issued_at_precision: "unknown",
        summary: null,
        url: "https://ndlsearch.ndl.go.jp/books/R100000002-I000000123",
        availability: {
          online: false,
          digital_collection: true
        },
        duplicate_key: null,
        duplicate_count: 1,
        related_records: []
      },
      {
        source: "ndl_search",
        source_id: "R100000002-I000000124",
        title: "多属性テスト2",
        subtitle: null,
        authors: [{ name: "著者2", role: "author" }],
        publisher: null,
        issued_at: null,
        issued_at_label: null,
        issued_at_precision: "unknown",
        summary: "抄録B",
        url: "https://ndlsearch.ndl.go.jp/books/R100000002-I000000124",
        availability: {
          online: false,
          digital_collection: false
        },
        duplicate_key: null,
        duplicate_count: 1,
        related_records: []
      }
    ]);
  });

  it("source_id が取れない場合は異なる長文 payload でも fallback が衝突しにくい", async () => {
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const sharedPrefix = "shared-prefix-".repeat(8);
    const first = mapNdlSearchSearchResponse({
      items: [
        {
          "dc:title": "タイトルのみ",
          "dc:creator": `${sharedPrefix}author-a`,
          "dcterms:issued": "1910"
        }
      ]
    });
    const second = mapNdlSearchSearchResponse({
      items: [
        {
          "dc:title": "タイトルのみ",
          "dc:creator": `${sharedPrefix}author-b`,
          "dcterms:issued": "1910"
        }
      ]
    });

    expect(first.items[0]?.source_id).toMatch(/^fallback:/);
    expect(second.items[0]?.source_id).toMatch(/^fallback:/);
    expect(first.items[0]?.source_id).not.toBe(second.items[0]?.source_id);
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

    expect(fetch).toHaveBeenCalledTimes(2);
    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    const recordUrl = new URL(fetch.mock.calls[1][0] as string);

    expect(searchUrl.origin + searchUrl.pathname).toBe(
      "https://ndlsearch.ndl.go.jp/api/opensearch"
    );
    expect(searchUrl.searchParams.get("any")).toBe("夏目漱石");
    expect(searchUrl.searchParams.get("cnt")).toBe("5");
    expect(searchUrl.searchParams.get("idx")).toBe("6");
    expect(recordUrl.origin + recordUrl.pathname).toBe(
      "https://ndlsearch.ndl.go.jp/api/bib/external/search"
    );
    expect(recordUrl.searchParams.get("cs")).toBe("bib");
    expect(recordUrl.searchParams.get("f-token")).toBe("R100000039-I1000732");
    expect(searchResult.items[0]?.source_id).toBe("R100000039-I1000732");
    expect(record?.source_id).toBe("R100000039-I1000732");
  });

  it("ndl_catalog source は iss-ndl-opac を付けて検索し source 名を固定する", async () => {
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

    const { createNdlCatalogAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlCatalogAdapter();

    const searchResult = await adapter.search({
      query: "夏目漱石",
      limit: 5,
      page: 1
    });
    const record = await adapter.getRecord("R100000039-I1000732");

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(adapter.source).toBe("ndl_catalog");
    expect(searchUrl.searchParams.get("dpid")).toBe("iss-ndl-opac");
    expect(searchResult.items[0]?.source).toBe("ndl_catalog");
    expect(record?.source).toBe("ndl_catalog");
  });

  it("ndl_articles source は zassaku を付けて検索し source 名を固定する", async () => {
    const searchFixture = readFixture("search-response.json");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === "content-type"
            ? "application/json; charset=utf-8"
            : null;
        }
      },
      json: async () => searchFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createNdlArticlesAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlArticlesAdapter();

    const result = await adapter.search({
      query: "夏目漱石",
      limit: 5,
      page: 1
    });

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(adapter.source).toBe("ndl_articles");
    expect(searchUrl.searchParams.get("dpid")).toBe("zassaku");
    expect(result.items[0]?.source).toBe("ndl_articles");
  });

  it("ndl_articles_online source は zassaku-online を付けて検索し source 名を固定する", async () => {
    const searchFixture = readFixture("search-response.json");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === "content-type"
            ? "application/json; charset=utf-8"
            : null;
        }
      },
      json: async () => searchFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createNdlArticlesOnlineAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlArticlesOnlineAdapter();

    const result = await adapter.search({
      query: "夏目漱石",
      limit: 5,
      page: 1
    });

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(adapter.source).toBe("ndl_articles_online");
    expect(searchUrl.searchParams.get("dpid")).toBe("zassaku-online");
    expect(result.items[0]?.source).toBe("ndl_articles_online");
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

    const { createNdlSearchAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlSearchAdapter();

    const searchResult = await adapter.search({
      query: "国立国会図書館年報",
      limit: 3,
      page: 1
    });
    const record = await adapter.getRecord("R100000039-I1000732");

    expect(searchResult.total).toBe(542);
    expect(searchResult.items[0]?.source_id).toBe("R100000039-I1000732");
    expect(record).toMatchObject({
      source_id: "R100000039-I1000732",
      content_access: {
        viewer_url: "https://dl.ndl.go.jp/pid/1000732",
        access_note: "インターネット公開"
      }
    });
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
    ).rejects.toThrow(/payload required/i);
  });
});
