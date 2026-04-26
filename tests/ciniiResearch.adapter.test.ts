import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`./fixtures/cinii-research/${name}`, import.meta.url),
      "utf-8"
    )
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CiNii Research mappers", () => {
  it("検索結果を共通 SearchItem に正規化する", async () => {
    const fixture = readFixture("search-response.json");
    const { mapCiniiResearchSearchResponse } = await import(
      "../src/sources/ciniiResearch/mapSearch.js"
    );

    const result = mapCiniiResearchSearchResponse(fixture);

    expect(result.total).toBe(3903);
    expect(result.items).toEqual([
      {
        source: "cinii_research",
        source_id: "1573387450265380480",
        title: "行人",
        subtitle: null,
        authors: [{ name: "夏目漱石", role: "author" }],
        publisher: null,
        issued_at: "1965",
        issued_at_label: "1965",
        issued_at_precision: "year",
        summary: null,
        url: "https://cir.nii.ac.jp/crid/1573387450265380480",
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

  it("詳細結果を共通 RecordItem に正規化する", async () => {
    const fixture = readFixture("record-response.json");
    const { mapCiniiResearchRecordResponse } = await import(
      "../src/sources/ciniiResearch/mapRecord.js"
    );

    const record = mapCiniiResearchRecordResponse(fixture);

    expect(record).toMatchObject({
      source: "cinii_research",
      source_id: "1573387450265380480",
      title: "行人",
      authors: [{ name: "夏目漱石", role: "author" }],
      publisher: "岩波書店",
      issued_at: "1965",
      issued_at_label: "1965",
      issued_at_precision: "year",
      language: null,
      material_type: "図書(book)",
      summary: "夏目漱石による作品。",
      subjects: ["日本文学"],
      identifiers: {
        naid: "10019109559",
        data_source_cia: "10019109559",
        data_source_irdb: "oai:irdb.example/123"
      },
      table_of_contents: [],
      content_access: {
        has_page_images: false,
        has_text_coordinates: false,
        viewer_url: null,
        access_note: null
      }
    });
    expect(record.source_metadata).toMatchObject({
      publication_name: "行人",
      publication_publisher: "岩波書店",
      publication_date: "1965",
      volume: "1",
      number: "2",
      starting_page: "1",
      ending_page: "250",
      urls: ["https://example.test/cinii/1573387450265380480"],
      related_count: 1
    });
  });
});

describe("createCiniiResearchAdapter", () => {
  it("OpenSearch と detail endpoint を組み立てて fixture を正規化する", async () => {
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
        text: async () => JSON.stringify(searchFixture)
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
        text: async () => JSON.stringify(recordFixture)
      });
    vi.stubGlobal("fetch", fetch);

    const { createCiniiResearchAdapter } = await import(
      "../src/sources/ciniiResearch/adapter.js"
    );
    const adapter = createCiniiResearchAdapter({
      appId: "dummy-app-id"
    });

    const searchResult = await adapter.search({
      query: "夏目漱石",
      limit: 5,
      page: 2
    });
    const record = await adapter.getRecord("1573387450265380480");

    expect(fetch).toHaveBeenCalledTimes(2);
    const searchUrl = new URL(fetch.mock.calls[0][0] as string);

    expect(searchUrl.origin + searchUrl.pathname).toBe(
      "https://cir.nii.ac.jp/opensearch/articles"
    );
    expect(searchUrl.searchParams.get("q")).toBe("夏目漱石");
    expect(searchUrl.searchParams.get("count")).toBe("5");
    expect(searchUrl.searchParams.get("start")).toBe("6");
    expect(searchUrl.searchParams.get("format")).toBe("json");
    expect(searchUrl.searchParams.get("appid")).toBe("dummy-app-id");
    expect(fetch.mock.calls[1][0]).toBe(
      "https://cir.nii.ac.jp/crid/1573387450265380480.json"
    );
    expect(searchResult.items[0]?.source).toBe("cinii_research");
    expect(record?.source).toBe("cinii_research");
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

    const { createCiniiResearchAdapter } = await import(
      "../src/sources/ciniiResearch/adapter.js"
    );
    const adapter = createCiniiResearchAdapter();

    await expect(adapter.getRecord("missing-crid")).resolves.toBeNull();
  });

  it("cinii_articles source を articles 検索として公開できる", async () => {
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
      text: async () => JSON.stringify(searchFixture)
    });
    vi.stubGlobal("fetch", fetch);

    const { createCiniiArticlesAdapter } = await import(
      "../src/sources/ciniiResearch/adapter.js"
    );
    const adapter = createCiniiArticlesAdapter();

    const result = await adapter.search({
      query: "夏目漱石",
      limit: 2,
      page: 1
    });

    expect(adapter.source).toBe("cinii_articles");
    expect(result.items[0]?.source).toBe("cinii_articles");
    expect(fetch.mock.calls[0][0]).toContain("/opensearch/articles");
  });

  it("cinii_books source を books 検索として公開できる", async () => {
    const bookFixture = {
      "@id": "https://cir.nii.ac.jp/opensearch/books?q=%E5%A4%8F%E7%9B%AE%E6%BC%B1%E7%9F%B3&count=1&format=json",
      "@type": "channel",
      "opensearch:totalResults": 2792,
      items: [
        {
          "@id": "https://cir.nii.ac.jp/crid/1971993809689508364",
          title: "我是猫",
          link: {
            "@id": "https://cir.nii.ac.jp/crid/1971993809689508364"
          },
          "dc:creator": ["于雷", "夏目漱石"],
          "dc:publisher": "译林出版社",
          "dc:type": "Book",
          "prism:publicationDate": "2001",
          "dc:identifier": [
            {
              "@type": "cir:NCID",
              "@value": "BA83739643"
            },
            {
              "@type": "cir:ISBN",
              "@value": "7806572856"
            }
          ]
        }
      ]
    };
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get(name: string) {
          return name.toLowerCase() === "content-type"
            ? "application/json; charset=utf-8"
            : null;
        }
      },
      text: async () => JSON.stringify(bookFixture)
    });
    vi.stubGlobal("fetch", fetch);

    const { createCiniiBooksAdapter } = await import(
      "../src/sources/ciniiResearch/adapter.js"
    );
    const adapter = createCiniiBooksAdapter();

    const result = await adapter.search({
      query: "夏目漱石",
      limit: 1,
      page: 1
    });

    expect(adapter.source).toBe("cinii_books");
    expect(result.items[0]).toMatchObject({
      source: "cinii_books",
      source_id: "1971993809689508364",
      title: "我是猫",
      publisher: "译林出版社"
    });
    expect(fetch.mock.calls[0][0]).toContain("/opensearch/books");
  });

  it("cinii_books の詳細取得では holdings を source_metadata に載せる", async () => {
    const recordFixture = readFixture("book-record-response.json");
    const holdingsFixture = readFixture("holdings-response.json");
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
        text: async () => JSON.stringify(recordFixture)
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
        text: async () => JSON.stringify(holdingsFixture)
      });
    vi.stubGlobal("fetch", fetch);

    const { createCiniiBooksAdapter } = await import(
      "../src/sources/ciniiResearch/adapter.js"
    );
    const adapter = createCiniiBooksAdapter();

    const record = await adapter.getRecord("1971993809689508364");

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain(
      "https://ci.nii.ac.jp/books/opensearch/holder?ncid=BA83739643&format=json"
    );
    expect(record).toMatchObject({
      source: "cinii_books",
      identifiers: {
        ncid: "BA83739643",
        isbn: "7806572856"
      },
      source_metadata: {
        holdings: [
          {
            library_name: "北京日本学研究センター 図書資料館",
            library_url: "https://ci.nii.ac.jp/library/FA018360",
            library_json_url: "https://ci.nii.ac.jp/library/FA018360.json"
          }
        ],
        holding_count: 1
      }
    });
  });

  it("cinii_books の holdings 取得が失敗しても書誌 detail は返す", async () => {
    const recordFixture = readFixture("book-record-response.json");
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
        text: async () => JSON.stringify(recordFixture)
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable"
      });
    vi.stubGlobal("fetch", fetch);

    const { createCiniiBooksAdapter } = await import(
      "../src/sources/ciniiResearch/adapter.js"
    );
    const adapter = createCiniiBooksAdapter();

    const record = await adapter.getRecord("1971993809689508364");

    expect(record).toMatchObject({
      source: "cinii_books",
      source_id: "1971993809689508364"
    });
    expect(record?.source_metadata).toMatchObject({
      holding_count: null,
      holdings: []
    });
  });
});
