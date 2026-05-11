import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string) {
  return readFileSync(new URL(`./fixtures/nijl-articles/${name}`, import.meta.url), "utf-8");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("nijlArticles mapper / adapter", () => {
  it("検索 HTML と詳細 HTML を共通形式に正規化する", async () => {
    const { mapNijlArticlesSearchResponse } = await import(
      "../src/sources/nijlArticles/mapSearch.js"
    );
    const { mapNijlArticlesRecordResponse } = await import(
      "../src/sources/nijlArticles/mapRecord.js"
    );

    const search = mapNijlArticlesSearchResponse(readFixture("search-response.html"));
    const record = mapNijlArticlesRecordResponse(
      "00000002",
      readFixture("record-response.html")
    );

    expect(search.total).toBe(23551);
    expect(search.items).toHaveLength(2);
    expect(search.items[0]).toMatchObject({
      source: "nijl_articles",
      source_id: "00000002",
      title: "源氏物語のモデル",
      authors: [{ name: "手塚昇", role: "author" }],
      journal_title: "国語と国文学",
      issued_at: "1924",
      url: "https://ronbun.nijl.ac.jp/kokubun/00000002",
      subjects: ["中古文学", "物語"],
      source_metadata: {
        nijl_article_id: "00000002",
        volume: "1-1",
        nijl_call_number: "ｺ00820",
        opac_url: "https://opac.nijl.ac.jp/opac/opac_search/?kywd=%EF%BD%BA00820",
        english_title: "The Model of Genji"
      }
    });
    expect(record).toMatchObject({
      source: "nijl_articles",
      source_id: "00000002",
      title: "源氏物語のモデル",
      authors: [{ name: "手塚昇", role: "author" }],
      journal_title: "国語と国文学",
      issued_at: null,
      issued_at_label: "1924-05-00",
      issued_at_precision: "unknown",
      language: "jpn",
      url: "https://ronbun.nijl.ac.jp/kokubun/00000002",
      content_access: {
        has_page_images: false,
        has_text_coordinates: false,
        viewer_url: "https://ronbun.nijl.ac.jp/kokubun/00000002"
      },
      source_metadata: {
        nijl_article_id: "00000002",
        volume: "1-1",
        period_classification: "中古文学",
        field: "物語",
        nijl_call_number: "ｺ00820",
        opac_url: "https://opac.nijl.ac.jp/opac/opac_search/?kywd=%EF%BD%BA00820"
      }
    });
  });

  it("adapter は検索 URL と詳細 URL を組み立て、404 詳細は null を返す", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => readFixture("search-response.html")
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => readFixture("record-response.html")
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found"
      });
    vi.stubGlobal("fetch", fetch);

    const { createNijlArticlesAdapter } = await import(
      "../src/sources/nijlArticles/adapter.js"
    );
    const adapter = createNijlArticlesAdapter();

    const search = await adapter.search({ query: "源氏物語", limit: 1, page: 2 });
    const record = await adapter.getRecord("00000002");
    const missing = await adapter.getRecord("99999999");

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.origin + searchUrl.pathname).toBe(
      "https://ronbun.nijl.ac.jp/search/books"
    );
    expect(searchUrl.searchParams.get("q")).toBe("源氏物語");
    expect(searchUrl.searchParams.get("page")).toBe("2");
    expect(search.items).toHaveLength(1);
    expect(fetch.mock.calls[1][0]).toBe("https://ronbun.nijl.ac.jp/kokubun/00000002");
    expect(record?.source_id).toBe("00000002");
    expect(missing).toBeNull();
  });

  it("baseUrl に path prefix がある場合も検索・詳細 URL で保持する", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => readFixture("search-response.html")
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => readFixture("record-response.html")
      });
    vi.stubGlobal("fetch", fetch);

    const { createNijlArticlesAdapter } = await import(
      "../src/sources/nijlArticles/adapter.js"
    );
    const adapter = createNijlArticlesAdapter({
      baseUrl: "https://proxy.example.test/ronbun/"
    });

    await adapter.search({ query: "源氏物語", limit: 1, page: 1 });
    await adapter.getRecord("00000002");

    expect(new URL(fetch.mock.calls[0][0] as string).pathname).toBe(
      "/ronbun/search/books"
    );
    expect(new URL(fetch.mock.calls[1][0] as string).pathname).toBe(
      "/ronbun/kokubun/00000002"
    );
  });
});
