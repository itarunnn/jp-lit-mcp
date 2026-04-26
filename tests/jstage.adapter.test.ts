import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string) {
  return readFileSync(new URL(`./fixtures/jstage/${name}`, import.meta.url), "utf-8");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("J-STAGE mappers", () => {
  it("検索結果 XML を共通 SearchItem に正規化する", async () => {
    const xml = readFixture("search-response.xml");
    const { mapJstageSearchResponse } = await import(
      "../src/sources/jstage/mapSearch.js"
    );

    const result = mapJstageSearchResponse(xml);

    expect(result.total).toBe(143);
    expect(result.items).toEqual([
      {
        source: "jstage_articles",
        source_id: "/article/jeigakushi1969/1973/5/1973_5_81/_article/-char/ja/",
        title: "夏目漱石の熊本時代",
        subtitle: null,
        authors: [{ name: "大村 喜吉", role: "author" }],
        publisher: "J-STAGE",
        issued_at: "1972",
        issued_at_label: "1972",
        issued_at_precision: "year",
        summary: null,
        url: "https://www.jstage.jst.go.jp/article/jeigakushi1969/1973/5/1973_5_81/_article/-char/ja/",
        availability: {
          online: true,
          digital_collection: false
        },
        duplicate_key: null,
        duplicate_count: 1,
        related_records: []
      }
    ]);
  });

  it("記事ページ meta を共通 RecordItem に正規化する", async () => {
    const html = readFixture("record-response.html");
    const { mapJstageRecordResponse } = await import(
      "../src/sources/jstage/mapRecord.js"
    );

    const record = mapJstageRecordResponse(
      "/article/jeigakushi1969/1973/5/1973_5_81/_article/-char/ja/",
      html
    );

    expect(record).toMatchObject({
      source: "jstage_articles",
      source_id: "/article/jeigakushi1969/1973/5/1973_5_81/_article/-char/ja/",
      title: "夏目漱石の熊本時代",
      authors: [{ name: "大村 喜吉", role: "author" }],
      publisher: "日本英学史学会",
      issued_at: null,
      issued_at_label: "1972/04/30",
      issued_at_precision: "unknown",
      language: "ja",
      material_type: "article",
      identifiers: {
        doi: "10.5024/jeigakushi.1973.81",
        issn: "0386-9490",
        eissn: "1883-9282"
      },
      content_access: {
        has_page_images: false,
        has_text_coordinates: false,
        viewer_url:
          "https://www.jstage.jst.go.jp/article/jeigakushi1969/1973/5/1973_5_81/_pdf",
        access_note: "フリー"
      }
    });
  });
});

describe("createJstageArticlesAdapter", () => {
  it("search API XML と記事 HTML を組み立てて正規化する", async () => {
    const searchFixture = readFixture("search-response.xml");
    const recordFixture = readFixture("record-response.html");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type"
              ? "application/xml; charset=utf-8"
              : null;
          }
        },
        text: async () => searchFixture
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type"
              ? "text/html; charset=utf-8"
              : null;
          }
        },
        text: async () => recordFixture
      });
    vi.stubGlobal("fetch", fetch);

    const { createJstageArticlesAdapter } = await import(
      "../src/sources/jstage/adapter.js"
    );
    const adapter = createJstageArticlesAdapter();

    const searchResult = await adapter.search({
      query: "夏目漱石",
      limit: 5,
      page: 2
    });
    const record = await adapter.getRecord(
      "/article/jeigakushi1969/1973/5/1973_5_81/_article/-char/ja/"
    );

    expect(fetch).toHaveBeenCalledTimes(2);
    const searchUrl = new URL(fetch.mock.calls[0][0] as string);

    expect(searchUrl.origin + searchUrl.pathname).toBe(
      "https://api.jstage.jst.go.jp/searchapi/do"
    );
    expect(searchUrl.searchParams.get("service")).toBe("3");
    expect(searchUrl.searchParams.get("article")).toBe("夏目漱石");
    expect(searchUrl.searchParams.get("page")).toBe("2");
    expect(fetch.mock.calls[1][0]).toBe(
      "https://www.jstage.jst.go.jp/article/jeigakushi1969/1973/5/1973_5_81/_article/-char/ja/"
    );
    expect(searchResult.items[0]?.source).toBe("jstage_articles");
    expect(record?.source).toBe("jstage_articles");
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

    const { createJstageArticlesAdapter } = await import(
      "../src/sources/jstage/adapter.js"
    );
    const adapter = createJstageArticlesAdapter();

    await expect(
      adapter.getRecord("/article/missing/_article/-char/ja/")
    ).resolves.toBeNull();
  });
});

