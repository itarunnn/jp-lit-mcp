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

describe("NDL Search mappers", () => {
  it("legacy RSS/XML を mapper が読める shape に投影できる", async () => {
    const xml = readTextFixture("search-response.xml");
    const { projectNdlSearchLegacyRssXml } = await import(
      "../src/sources/ndlSearch/projectOpenSearch.js"
    );
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const projected = projectNdlSearchLegacyRssXml(xml);
    const result = mapNdlSearchSearchResponse(projected);

    expect(result.total).toBe(542);
    expect(result.items).toEqual([
      {
        source: "ndl_search",
        source_id: "R100000039-I1000732",
        title: "国立国会図書館年報",
        subtitle: null,
        title_reading: null,
        authors: [{ name: "国立国会図書館総務部", role: "author" }],
        publisher: "国立国会図書館",
        journal_title: null,
        issued_at: null,
        issued_at_label: null,
        issued_at_precision: "unknown",
        summary: null,
        url: "https://ndlsearch.ndl.go.jp/books/R100000039-I1000732",
        availability: {
          online: false,
          digital_collection: true
        },
        material_type: "電子書籍・電子雑誌",
        subjects: [],
        table_of_contents: [],
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
        title_reading: null,
        authors: [{ name: "国立国会図書館総務部", role: "author" }],
        publisher: "国立国会図書館",
        journal_title: null,
        issued_at: null,
        issued_at_label: null,
        issued_at_precision: "unknown",
        summary: null,
        url: "https://ndlsearch.ndl.go.jp/books/R100000039-I1000732",
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
    const { projectNdlSearchDetailXml } = await import(
      "../src/sources/ndlSearch/projectOpenSearch.js"
    );
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    const record = mapNdlSearchRecordResponse(projectNdlSearchDetailXml(xml));

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
        title_reading: null,
        authors: [
          { name: "夏目 漱石", role: "author" },
          { name: "校訂者A", role: "author" }
        ],
        publisher: "岩波書店",
        journal_title: null,
        issued_at: "1914",
        issued_at_label: "1914",
        issued_at_precision: "year",
        summary: "長編小説。",
        url: "https://ndlsearch.ndl.go.jp/books/R100000002-I000000001",
        availability: {
          online: false,
          digital_collection: false
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
        title_reading: null,
        authors: [{ name: "著者1", role: "author" }],
        publisher: "版元A",
        journal_title: null,
        issued_at: null,
        issued_at_label: null,
        issued_at_precision: "unknown",
        summary: null,
        url: "https://ndlsearch.ndl.go.jp/books/R100000002-I000000123",
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
      },
      {
        source: "ndl_search",
        source_id: "R100000002-I000000124",
        title: "多属性テスト2",
        subtitle: null,
        title_reading: null,
        authors: [{ name: "著者2", role: "author" }],
        publisher: null,
        journal_title: null,
        issued_at: null,
        issued_at_label: null,
        issued_at_precision: "unknown",
        summary: "抄録B",
        url: "https://ndlsearch.ndl.go.jp/books/R100000002-I000000124",
        availability: {
          online: false,
          digital_collection: false
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

  it("ndl_articles の dc:description から掲載誌名を journal_title に抽出する", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:openSearch="http://a9.com/-/spec/opensearchrss/1.0/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
     xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <channel>
    <openSearch:totalResults>1</openSearch:totalResults>
    <item>
      <title>知識表現と推論</title>
      <link>https://ndlsearch.ndl.go.jp/books/R000000004-I001234567</link>
      <dc:title>知識表現と推論</dc:title>
      <dc:description>掲載誌：人工知能学会誌 = Journal of the Japanese Society for AI p.712～716</dc:description>
    </item>
  </channel>
</rss>`;
    const { projectNdlSearchLegacyRssXml } = await import(
      "../src/sources/ndlSearch/projectOpenSearch.js"
    );
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const projected = projectNdlSearchLegacyRssXml(xml);
    const result = mapNdlSearchSearchResponse(projected);

    expect(result.items[0]?.journal_title).toBe("人工知能学会誌");
  });

  it("dc:description の掲載誌： が '/' 区切りの場合も誌名を抽出する", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:openSearch="http://a9.com/-/spec/opensearchrss/1.0/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <channel>
    <openSearch:totalResults>1</openSearch:totalResults>
    <item>
      <title>対話処理の研究</title>
      <link>https://ndlsearch.ndl.go.jp/books/R000000004-I001234568</link>
      <dc:title>対話処理の研究</dc:title>
      <dc:description>掲載誌：言語・音声理解と対話処理研究会 / 人工知能学会 [編] p.57～62</dc:description>
    </item>
  </channel>
</rss>`;
    const { projectNdlSearchLegacyRssXml } = await import(
      "../src/sources/ndlSearch/projectOpenSearch.js"
    );
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const projected = projectNdlSearchLegacyRssXml(xml);
    const result = mapNdlSearchSearchResponse(projected);

    expect(result.items[0]?.journal_title).toBe("言語・音声理解と対話処理研究会");
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
    const searchFixture = readSruFixture("search-ndl-catalog-dcndl-xml.xml");
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
      "https://ndlsearch.ndl.go.jp/api/sru"
    );
    expect(searchUrl.searchParams.get("operation")).toBe("searchRetrieve");
    expect(searchUrl.searchParams.get("recordSchema")).toBe("dcndl");
    expect(searchUrl.searchParams.get("recordPacking")).toBe("xml");
    expect(searchUrl.searchParams.get("maximumRecords")).toBe("5");
    expect(searchUrl.searchParams.get("startRecord")).toBe("6");
    expect(recordUrl.origin + recordUrl.pathname).toBe(
      "https://ndlsearch.ndl.go.jp/api/bib/external/search"
    );
    expect(recordUrl.searchParams.get("cs")).toBe("bib");
    expect(recordUrl.searchParams.get("f-token")).toBe("R100000039-I1000732");
    expect(searchResult.items[0]?.source_id).toBe("R100000002-I000001268385");
    expect(record?.source_id).toBe("R100000039-I1000732");
  });

  it("ndl_catalog source は iss-ndl-opac を付けて検索し source 名を固定する", async () => {
    const searchFixture = readSruFixture("search-ndl-catalog-dcndl-xml.xml");
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
    expect(searchUrl.searchParams.get("query")).toContain("dpid=iss-ndl-opac");
    expect(searchResult.items[0]?.source).toBe("ndl_catalog");
    expect(record?.source).toBe("ndl_catalog");
  });

  it("ndl_articles source は zassaku を付けて検索し source 名を固定する", async () => {
    const searchFixture = readSruFixture("search-ndl-articles.xml");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => searchFixture
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
    expect(searchUrl.searchParams.get("query")).toContain("dpid=zassaku");
    expect(result.items[0]?.source).toBe("ndl_articles");
  });

  it("ndl_articles_online source は zassaku-online を付けて検索し source 名を固定する", async () => {
    const searchFixture = readSruFixture("search-ndl-articles-online.xml");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => searchFixture
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
    expect(searchUrl.searchParams.get("query")).toContain("dpid=zassaku-online");
    expect(result.items[0]?.source).toBe("ndl_articles_online");
  });

  it("search() / getRecord() は XML payload を live fallback で正規化する", async () => {
    const searchXml = readSruFixture("search-ndl-catalog-dcndl-xml.xml");
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

    expect(searchResult.total).toBe(4997098);
    expect(searchResult.items[0]?.source_id).toBe("R100000002-I000001268385");
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

  it("ndl_articles CiNii 由来レコードの search は crid: source_id を返す", async () => {
    const ciniiXml = readSruFixture("search-ndl-articles.xml");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => ciniiXml
    }));

    const { createNdlArticlesAdapter } = await import("../src/sources/ndlSearch/adapter.js");
    const adapter = createNdlArticlesAdapter();
    const result = await adapter.search({ query: "漱石", limit: 5, page: 1 });

    expect(result.items[0]?.source_id).toBe("crid:1520009409428206720");
    expect(result.items[0]?.source).toBe("ndl_articles");
  });

  it("ndl_articles getRecord の crid: source_id は CiNii API を呼んでレコードを返す", async () => {
    const ciniiRecord = {
      "@id": "https://cir.nii.ac.jp/crid/1520009409428206720.json",
      "@type": "Article",
      "dc:title": [{ "@value": "漱石論文テスト" }],
      creator: [{ "@type": "Researcher", "foaf:name": [{ "@language": "ja", "@value": "著者A" }] }],
      publication: { "prism:publicationDate": "2023", "prism:publicationName": [{ "@value": "英学史研究" }] }
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (n: string) => n === "content-type" ? "application/json" : null },
      text: async () => JSON.stringify(ciniiRecord)
    }));

    const { createNdlArticlesAdapter } = await import("../src/sources/ndlSearch/adapter.js");
    const adapter = createNdlArticlesAdapter();
    const record = await adapter.getRecord("crid:1520009409428206720");

    expect(record?.source).toBe("ndl_articles");
    expect(record?.title).toBe("漱石論文テスト");
    expect(record?.source_id).toBe("crid:1520009409428206720");
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
    ).rejects.toThrow(/searchRetrieveResponse|SRU XML/i);
  });

  it("search は SRU endpoint に CQL query を送る", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => readSruFixture("search-ndl-catalog-dcndl-xml.xml")
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createNdlCatalogAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlCatalogAdapter();

    await adapter.search({ query: "夏目漱石", limit: 5, page: 2 });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/api/sru");
    expect(calledUrl.searchParams.get("operation")).toBe("searchRetrieve");
    expect(calledUrl.searchParams.get("version")).toBe("1.2");
    expect(calledUrl.searchParams.get("recordSchema")).toBe("dcndl");
    expect(calledUrl.searchParams.get("recordPacking")).toBe("xml");
    expect(calledUrl.searchParams.get("maximumRecords")).toBe("5");
    expect(calledUrl.searchParams.get("startRecord")).toBe("6");
    expect(calledUrl.searchParams.get("query")).toContain("dpid=iss-ndl-opac");
    expect(calledUrl.searchParams.get("query")).toContain('anywhere="夏目漱石"');
  });

  it("ndl_articles source は zassaku を CQL に含める", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => readSruFixture("search-ndl-articles.xml")
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createNdlArticlesAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlArticlesAdapter();

    await adapter.search({ query: "漱石", limit: 5, page: 1 });

    const query = new URL(fetchMock.mock.calls[0][0] as string).searchParams.get("query") ?? "";
    expect(query).toContain("dpid=zassaku");
    expect(query).toContain('anywhere="漱石"');
  });

  it("sort_by と sort_order を sortBy パラメータに変換する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => readSruFixture("search-ndl-catalog-dcndl-xml.xml")
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createNdlCatalogAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlCatalogAdapter();

    await adapter.search({
      query: "漱石",
      limit: 5,
      page: 1,
      sort_by: "title",
      sort_order: "desc"
    });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("sortBy")).toBe("title/sort.descending");
  });

  it("目次あり resource で table_of_contents が t35050 から抽出される", async () => {
    const recordFixture = readFixture("record-toc.json");
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    const record = mapNdlSearchRecordResponse(recordFixture);

    expect(record?.table_of_contents).toEqual([
      "金剛石",
      "月下の陣",
      "羅生門 (七五)"
    ]);
  });

  it("目次行ヘッダ（v=目次）は table_of_contents から除外される", async () => {
    const recordFixture = readFixture("record-toc.json");
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    const record = mapNdlSearchRecordResponse(recordFixture);

    expect(record?.table_of_contents).not.toContain("目次");
  });

  it("t35050 が無い resource では table_of_contents は空配列のまま", async () => {
    const recordFixture = readFixture("record-response.json") as Record<string, unknown>;
    const liveRecordFixture = (recordFixture._fixture as { liveResponseExtract: unknown })
      .liveResponseExtract;
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    const record = mapNdlSearchRecordResponse(liveRecordFixture);

    expect(record?.table_of_contents).toEqual([]);
  });

  it("SRU 検索結果で dcterms:subject の rdf:Description テキストが SearchItem.subjects に反映される", async () => {
    const xml = readSruFixture("search-ndl-catalog-sort-title.xml");
    const { projectNdlSruSearchResponse } = await import(
      "../src/sources/ndlSearch/parseSru.js"
    );
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const projected = projectNdlSruSearchResponse(xml);
    const result = mapNdlSearchSearchResponse(projected);

    // Record 3 has dcterms:subject with rdf:Description rdf:value="経営"
    expect(result.items[2]?.subjects).toEqual(["経営"]);
    // Records 1 and 2 have only rdf:resource URI subjects → empty
    expect(result.items[0]?.subjects).toEqual([]);
    expect(result.items[1]?.subjects).toEqual([]);
  });

  it("SRU 検索結果に dcterms:tableOfContents がある場合 SearchItem.table_of_contents に反映される", async () => {
    const xml = readSruFixture("search-toc.xml");
    const { projectNdlSruSearchResponse } = await import(
      "../src/sources/ndlSearch/parseSru.js"
    );
    const { mapNdlSearchSearchResponse } = await import(
      "../src/sources/ndlSearch/mapSearch.js"
    );

    const projected = projectNdlSruSearchResponse(xml);
    const result = mapNdlSearchSearchResponse(projected);

    expect(result.items[0]?.table_of_contents).toEqual(["金剛石", "月下の陣", "羅生門"]);
  });

  it("t35052 が非優先 item にある場合でも table_of_contents に集約される", async () => {
    const recordFixture = readFixture("record-toc-cross-item.json");
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    const record = mapNdlSearchRecordResponse(recordFixture);

    expect(record?.table_of_contents).toEqual([
      "プロローグ",
      "１ 菊池寛と永田雅一",
      "２ 二人三脚",
      "エピローグ"
    ]);
  });

  it("t35200 が非優先 item にある場合でも summary に集約される", async () => {
    const recordFixture = readFixture("record-toc-cross-item.json");
    const { mapNdlSearchRecordResponse } = await import(
      "../src/sources/ndlSearch/mapRecord.js"
    );

    const record = mapNdlSearchRecordResponse(recordFixture);

    expect(record?.summary).toBe("初代大映社長に就任した菊池寛と永田雅一の二人の軌跡を追う。");
  });
});
