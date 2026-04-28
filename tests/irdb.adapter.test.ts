import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string) {
  return readFileSync(new URL(`./fixtures/irdb/${name}`, import.meta.url), "utf-8");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("IRDB mappers", () => {
  it("Atom 検索結果を共通 SearchItem に正規化する", async () => {
    const xml = readFixture("search-response.xml");
    const { mapIrdbSearchResponse } = await import("../src/sources/irdb/mapSearch.js");

    const result = mapIrdbSearchResponse(xml);

    expect(result.total).toBe(899);
    expect(result.items).toEqual([
      {
        source: "irdb",
        source_id: "/01242/0007332690",
        title: "夏目漱石『虞美人草』における東洋的「水の女」 : 古典から読み解く",
        subtitle: null,
        title_reading: null,
        authors: [
          { name: "佐々, 優香", role: "author" },
          { name: "サッサ, ユウカ", role: "author" },
          { name: "Sassa, Yuka", role: "author" }
        ],
        publisher: "熊本大学大学院社会文化科学教育部",
        journal_title: "熊本大学社会文化研究",
        issued_at: "2026-03-24",
        issued_at_label: "2026-03-24",
        issued_at_precision: "day",
        summary: "In this paper, Sayoko, Itoko, and Fujio are reread as Oriental \"water women\".",
        url: "https://irdb.nii.ac.jp/01242/0007332690",
        availability: {
          online: true,
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

  it("IRDB 詳細 HTML を共通 RecordItem に正規化する", async () => {
    const html = readFixture("record-response.html");
    const { mapIrdbRecordResponse } = await import("../src/sources/irdb/mapRecord.js");

    const record = mapIrdbRecordResponse("/01242/0007332690", html);

    expect(record).toMatchObject({
      source: "irdb",
      source_id: "/01242/0007332690",
      title: "夏目漱石『虞美人草』における東洋的「水の女」 : 古典から読み解く",
      title_reading: "ナツメ ソウセキ 『グビジンソウ』 ニオケル トウヨウテキ 「ミズ ノ オンナ」 : コテン カラ ヨミトク",
      authors: [
        { name: "佐々 優香", role: "author" },
        { name: "サッサ ユウカ", role: "author" },
        { name: "Sassa Yuka", role: "author" }
      ],
      publisher: "熊本大学大学院社会文化科学教育部",
      journal_title: "熊本大学社会文化研究",
      issued_at: "2026-03-24",
      issued_at_label: "2026-03-24",
      issued_at_precision: "day",
      summary: "本稿においては、『虞美人草』の小夜子、糸子、藤尾の三人を東洋的「水の女」として読み直すことを試みた。",
      language: "jpn",
      material_type: "departmental bulletin paper",
      identifiers: {
        uri: "http://hdl.handle.net/2298/0002001355",
        pissn: "1348-530X",
        ncid: "AA11837081"
      },
      content_access: {
        has_page_images: false,
        has_text_coordinates: false,
        viewer_url: "https://kumadai.repo.nii.ac.jp/record/2001355/files/SB0024_210-191.pdf",
        access_note: "application/pdf"
      }
    });
    expect(record.source_metadata).toMatchObject({
      irname: "熊本大学",
      source_uri: "http://hdl.handle.net/2298/0002001355",
      journal_issn: "1348-530X",
      journal_ncid: "AA11837081",
      journal_volume: "24",
      starting_page: "210",
      ending_page: "191",
      file_url: "https://kumadai.repo.nii.ac.jp/record/2001355/files/SB0024_210-191.pdf",
      file_mime_type: "application/pdf",
      record_updated_at: "2026-04-10"
    });
  });
});

describe("createIrdbAdapter", () => {
  it("OpenSearch Atom と detail HTML を組み立てて正規化する", async () => {
    const searchFixture = readFixture("search-response.xml");
    const recordFixture = readFixture("record-response.html");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type"
              ? "application/atom+xml; charset=utf-8"
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

    const { createIrdbAdapter } = await import("../src/sources/irdb/adapter.js");
    const adapter = createIrdbAdapter();

    const searchResult = await adapter.search({
      query: "夏目漱石",
      limit: 5,
      page: 2
    });
    const record = await adapter.getRecord("/01242/0007332690");

    expect(fetch).toHaveBeenCalledTimes(2);
    const searchUrl = new URL(fetch.mock.calls[0][0] as string);

    expect(searchUrl.origin + searchUrl.pathname).toBe(
      "https://irdb.nii.ac.jp/opensearch/search"
    );
    expect(searchUrl.searchParams.get("q")).toBe("夏目漱石");
    expect(searchUrl.searchParams.get("count")).toBe("20");
    expect(searchUrl.searchParams.get("start")).toBe("6");
    expect(searchUrl.searchParams.get("format")).toBe("atom");
    expect(fetch.mock.calls[1][0]).toBe("https://irdb.nii.ac.jp/01242/0007332690");
    expect(searchResult.items).toHaveLength(1);
    expect(searchResult.items[0]?.source).toBe("irdb");
    expect(record?.source).toBe("irdb");
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

    const { createIrdbAdapter } = await import("../src/sources/irdb/adapter.js");
    const adapter = createIrdbAdapter();

    await expect(adapter.getRecord("/missing")).resolves.toBeNull();
  });

  it("filters.irdb.fulltext=true のとき URL に fulltext=1 が付く", async () => {
    const searchFixture = readFixture("search-response.xml");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/atom+xml; charset=utf-8" : null },
      text: async () => searchFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createIrdbAdapter } = await import("../src/sources/irdb/adapter.js");
    const adapter = createIrdbAdapter();

    await adapter.search({ query: "漱石", limit: 10, page: 1, filters: { irdb: { fulltext: true } } });

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.searchParams.get("fulltext")).toBe("1");
  });

  it("filters.irdb.fulltext 未指定のとき URL に fulltext パラメータが付かない", async () => {
    const searchFixture = readFixture("search-response.xml");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/atom+xml; charset=utf-8" : null },
      text: async () => searchFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createIrdbAdapter } = await import("../src/sources/irdb/adapter.js");
    const adapter = createIrdbAdapter();

    await adapter.search({ query: "漱石", limit: 10, page: 1 });

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.searchParams.get("fulltext")).toBeNull();
  });

  it("filters.irdb.fulltext=false のとき URL に fulltext パラメータが付かない", async () => {
    const searchFixture = readFixture("search-response.xml");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/atom+xml; charset=utf-8" : null },
      text: async () => searchFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createIrdbAdapter } = await import("../src/sources/irdb/adapter.js");
    const adapter = createIrdbAdapter();

    await adapter.search({ query: "漱石", limit: 10, page: 1, filters: { irdb: { fulltext: false } } });

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.searchParams.get("fulltext")).toBeNull();
  });

  it("filters.irdb.title/author のとき URL に対応パラメータが付く", async () => {
    const searchFixture = readFixture("search-response.xml");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/atom+xml; charset=utf-8" : null },
      text: async () => searchFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createIrdbAdapter } = await import("../src/sources/irdb/adapter.js");
    const adapter = createIrdbAdapter();

    await adapter.search({ query: "漱石", limit: 10, page: 1, filters: { irdb: { title: "こころ", author: "夏目漱石" } } });

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.searchParams.get("title")).toBe("こころ");
    expect(searchUrl.searchParams.get("author")).toBe("夏目漱石");
  });

  it("filters.irdb.keyword/journal/publisher のとき URL に対応パラメータが付く", async () => {
    const searchFixture = readFixture("search-response.xml");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/atom+xml; charset=utf-8" : null },
      text: async () => searchFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createIrdbAdapter } = await import("../src/sources/irdb/adapter.js");
    const adapter = createIrdbAdapter();

    await adapter.search({
      query: "漱石",
      limit: 10,
      page: 1,
      filters: { irdb: { keyword: "近代文学", journal: "文学研究", publisher: "東京大学" } }
    });

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.searchParams.get("keyword")).toBe("近代文学");
    expect(searchUrl.searchParams.get("journal")).toBe("文学研究");
    expect(searchUrl.searchParams.get("publisher")).toBe("東京大学");
  });
});
