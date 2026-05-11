import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string) {
  return readFileSync(new URL(`./fixtures/ninjal-bibliography/${name}`, import.meta.url), "utf-8");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ninjalBibliography mapper / adapter", () => {
  it("検索 HTML と詳細 HTML を共通形式に正規化する", async () => {
    const { mapNinjalBibliographySearchResponse } = await import(
      "../src/sources/ninjalBibliography/mapSearch.js"
    );
    const { mapNinjalBibliographyRecordResponse } = await import(
      "../src/sources/ninjalBibliography/mapRecord.js"
    );

    const search = mapNinjalBibliographySearchResponse(readFixture("search-response.html"));
    const record = mapNinjalBibliographyRecordResponse(
      "102025006447",
      readFixture("record-response.html")
    );

    expect(search.total).toBe(18535);
    expect(search.items[0]).toMatchObject({
      source: "ninjal_bibliography",
      source_id: "102025006447",
      title: "感動詞としてとらえるフィラーー「えー」と「えっ」の違いを意識する—",
      authors: [{ name: "小西 円", role: "author" }],
      issued_at: "2025-12",
      url: "https://bibdb.ninjal.ac.jp/bunken/ja/article/102025006447",
      source_metadata: {
        bibliography_id: "102025006447"
      }
    });
    expect(record).toMatchObject({
      source: "ninjal_bibliography",
      source_id: "102025006447",
      title: "感動詞としてとらえるフィラーー「えー」と「えっ」の違いを意識する—",
      authors: [{ name: "小西 円", role: "author" }],
      publisher: "明治書院",
      journal_title: "日本語学 特集：声から考える日本語，フィラーの働き",
      issued_at: "2025-12",
      material_type: "雑誌",
      extent: "44-04 / pp.140-149",
      subjects: ["コミュニケーション", "日本語教育", "フィラー", "感動詞"],
      identifiers: {
        issn: "02880822"
      },
      content_access: {
        has_page_images: false,
        has_text_coordinates: false,
        viewer_url: "https://example.test/fulltext.pdf"
      },
      source_metadata: {
        bibliography_id: "102025006447",
        db_kind: "雑誌",
        library_call_number: "N77",
        volume: "44-04",
        pages: "pp.140-149",
        fulltext_links: ["https://example.test/fulltext.pdf"]
      }
    });
  });

  it("adapter は検索 URL と詳細 URL を組み立て、404 詳細は null を返す", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=UTF-8" },
        text: async () => readFixture("search-response.html")
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=UTF-8" },
        text: async () => readFixture("record-response.html")
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found"
      });
    vi.stubGlobal("fetch", fetch);

    const { createNinjalBibliographyAdapter } = await import(
      "../src/sources/ninjalBibliography/adapter.js"
    );
    const adapter = createNinjalBibliographyAdapter();

    const search = await adapter.search({ query: "日本語教育", limit: 1, page: 2 });
    const record = await adapter.getRecord("102025006447");
    const missing = await adapter.getRecord("999999999999");

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.origin + searchUrl.pathname).toBe(
      "https://bibdb.ninjal.ac.jp/bunken/ja/result"
    );
    expect(searchUrl.searchParams.get("r_freeWord_search")).toBe("日本語教育");
    expect(searchUrl.searchParams.get("lop")).toBe("and");
    expect(searchUrl.searchParams.get("per")).toBe("20");
    expect(searchUrl.searchParams.get("disp")).toBe("snipet");
    expect(searchUrl.searchParams.get("skip")).toBe("20");
    expect(search.items).toHaveLength(1);
    expect(fetch.mock.calls[1][0]).toBe(
      "https://bibdb.ninjal.ac.jp/bunken/ja/article/102025006447"
    );
    expect(record?.source_id).toBe("102025006447");
    expect(missing).toBeNull();
  });
});
