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
        }
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
        }
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

  it("OpenSearch が XML を返した場合は未実装を明示した例外を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
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
        }
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
    ).rejects.toThrow(/OpenSearch XML parsing is not implemented/i);
  });
});
