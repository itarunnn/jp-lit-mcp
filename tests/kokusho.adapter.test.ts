import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string) {
  return readFileSync(new URL(`./fixtures/kokusho/${name}`, import.meta.url), "utf-8");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("kokusho mapper / adapter", () => {
  it("検索 JSON と詳細 JSON を共通形式に正規化する", async () => {
    const { mapKokushoSearchResponse } = await import("../src/sources/kokusho/mapSearch.js");
    const { mapKokushoRecordResponse } = await import("../src/sources/kokusho/mapRecord.js");

    const search = mapKokushoSearchResponse(JSON.parse(readFixture("search-response.json")));
    const record = mapKokushoRecordResponse(JSON.parse(readFixture("record-response.json")));

    expect(search.total).toBe(2);
    expect(search.items[0]).toMatchObject({
      source: "kokusho",
      source_id: "100335909",
      title: "伊勢物語",
      title_reading: "いせものがたり",
      authors: [{ name: "秋元／安民", role: "author" }],
      issued_at: "1783",
      url: "https://kokusho.nijl.ac.jp/biblio/100335909",
      availability: {
        online: true,
        digital_collection: true
      },
      material_type: "古典籍",
      subjects: ["国学"],
      source_metadata: {
        bid: "100335909",
        wid: "92648",
        record_kind: "bibliographic_record",
        work_title: "伊勢の浜荻",
        collection: "九大春日",
        call_number: "DIG-KYUS-00720",
        kansha: "刊",
        volumes: "３冊",
        has_images: true,
        shubetsu: "M"
      }
    });
    expect(record).toMatchObject({
      source: "kokusho",
      source_id: "100335909",
      title: "伊勢物語（いせものがたり）（Isemonogatari），Ａ",
      authors: [{ name: "［秋元／安民］ ［著］", role: "author" }],
      publisher: "九州大学中央図書館，春日政治・和男文庫，春日文庫/31",
      material_type: "古典籍",
      extent: "上中下 / ３冊",
      url: "https://kokusho.nijl.ac.jp/biblio/100335909",
      availability: {
        online: true,
        digital_collection: true
      },
      subjects: ["国学"],
      content_access: {
        has_page_images: true,
        has_text_coordinates: false,
        viewer_url: "https://kokusho.nijl.ac.jp/biblio/100335909"
      },
      source_metadata: {
        bid: "100335909",
        record_kind: "bibliographic_record",
        work_title: "伊勢の浜荻",
        call_number: "DIG-KYUS-00720，208，Y",
        manifest_url: "https://kokusho.nijl.ac.jp/biblio/100335909/manifest",
        license_url: "https://creativecommons.org/licenses/by-sa/4.0/deed.ja",
        has_images: true
      }
    });
  });

  it("adapter は検索 URL と詳細 URL を組み立て、404 詳細は null を返す", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json;charset=UTF-8" },
        json: async () => JSON.parse(readFixture("search-response.json"))
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json;charset=UTF-8" },
        json: async () => JSON.parse(readFixture("record-response.json"))
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found"
      });
    vi.stubGlobal("fetch", fetch);

    const { createKokushoAdapter } = await import("../src/sources/kokusho/adapter.js");
    const adapter = createKokushoAdapter();

    const search = await adapter.search({ query: "伊勢物語", limit: 1, page: 1 });
    const record = await adapter.getRecord("100335909");
    const missing = await adapter.getRecord("999999999");

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.origin + searchUrl.pathname).toBe(
      "https://kokusho.nijl.ac.jp/api/biblioSimpleSearch"
    );
    expect(searchUrl.searchParams.get("searchkbn")).toBe("simple");
    expect(searchUrl.searchParams.get("keyword")).toBe("伊勢物語");
    expect(search.items).toHaveLength(1);
    expect(fetch.mock.calls[1][0]).toBe(
      "https://kokusho.nijl.ac.jp/api/biblioDetail/100335909"
    );
    expect(record?.source_id).toBe("100335909");
    expect(missing).toBeNull();
  });

  it("client は書誌・詳細・全文・画像タグ URL を組み立てる", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json;charset=UTF-8" },
      json: async () => ({ ok: true })
    });
    vi.stubGlobal("fetch", fetch);

    const { createKokushoClient } = await import("../src/sources/kokusho/client.js");
    const client = createKokushoClient({ baseUrl: "https://kokusho.example.test/" });

    await client.searchBiblios("伊勢物語");
    await client.getBiblioDetail("100335909");
    await client.searchFulltext("春");
    await client.searchImageTags("桜", 2);

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.origin + searchUrl.pathname).toBe(
      "https://kokusho.example.test/api/biblioSimpleSearch"
    );
    expect(searchUrl.searchParams.get("searchkbn")).toBe("simple");
    expect(searchUrl.searchParams.get("keyword")).toBe("伊勢物語");
    expect(fetch.mock.calls[1][0]).toBe(
      "https://kokusho.example.test/api/biblioDetail/100335909"
    );

    const fulltextUrl = new URL(fetch.mock.calls[2][0] as string);
    expect(fulltextUrl.origin + fulltextUrl.pathname).toBe(
      "https://kokusho.example.test/api/fulltextSearch"
    );
    expect(fulltextUrl.searchParams.get("keyword")).toBe("春");

    const tagUrl = new URL(fetch.mock.calls[3][0] as string);
    expect(tagUrl.origin + tagUrl.pathname).toBe(
      "https://kokusho.example.test/api/tagSearch"
    );
    expect(tagUrl.searchParams.get("searchkbn")).toBe("simple");
    expect(tagUrl.searchParams.get("keyword")).toBe("桜");
    expect(tagUrl.searchParams.get("page")).toBe("2");
  });
});
