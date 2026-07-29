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
        source_metadata: {
          source_uri: "https://kumadai.repo.nii.ac.jp/records/2001355",
          repository_name: "熊本大学",
          language: "jpn",
          record_updated_at: "2026-04-10",
          journal_issn: "1348-530X",
          journal_volume: "24",
          journal_number: null,
          starting_page: "210",
          ending_page: "191"
        },
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

  it("全国文化財総覧由来の IRDB Atom で provenance と公式 record URL を保持する", async () => {
    const xml = readFixture("search-sitereports-response.xml");
    const { mapIrdbSearchResponse } = await import("../src/sources/irdb/mapSearch.js");

    const result = mapIrdbSearchResponse(xml);

    expect(result.items[0]).toMatchObject({
      source: "irdb",
      source_id: "/01144/0000000001",
      summary: "縄文時代の竪穴建物と石器を確認した。",
      subjects: ["縄文", "石器"],
      source_metadata: {
        source_uri: "https://sitereports.nabunken.go.jp/12345",
        repository_name: "奈良文化財研究所",
        language: "jpn",
        record_updated_at: "2025-04-01",
        journal_volume: "12",
        sitereports: {
          record_id: "12345",
          record_url: "https://sitereports.nabunken.go.jp/12345",
          doi: null
        }
      }
    });
  });

  it("IRDB Atom の provenance は安全な absolute HTTP(S) URL だけを公開する", async () => {
    const xml = readFixture("search-unsafe-uri-response.xml");
    const { mapIrdbSearchResponse } = await import("../src/sources/irdb/mapSearch.js");

    const result = mapIrdbSearchResponse(xml);

    expect(result.items.map((item) => item.source_metadata)).toEqual([
      expect.objectContaining({
        source_uri: "https://example.test/record?next=/#metadata/"
      }),
      expect.objectContaining({ source_uri: null }),
      expect.objectContaining({ source_uri: null }),
      expect.objectContaining({ source_uri: null }),
      expect.objectContaining({ source_uri: null }),
      expect.objectContaining({ source_uri: null })
    ]);
    for (const item of result.items) {
      expect(item.source_metadata).not.toHaveProperty("sitereports");
    }
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
        uri: "https://kumadai.repo.nii.ac.jp/records/2001355",
        hdl: "http://hdl.handle.net/2298/0002001355",
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
      source_uri: "https://kumadai.repo.nii.ac.jp/records/2001355",
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

  it("内容注記が MIME type だけなら summary に採用しない", async () => {
    const html = `
      <table>
        <tr><th>内容注記</th><td><ul>
          <li><span class="label-field label-field__colon">Other</span>application/pdf</li>
        </ul></td></tr>
      </table>
    `;
    const { mapIrdbRecordResponse } = await import("../src/sources/irdb/mapRecord.js");

    const record = mapIrdbRecordResponse("/example/mime-only", html);

    expect(record.summary).toBeNull();
  });

  it("内容注記は HTML 上で en が先でも ja を優先する", async () => {
    const html = `
      <table>
        <tr><th>内容注記</th><td><ul>
          <li><span class="label-field label-field__colon">en</span>English abstract.</li>
          <li><span class="label-field label-field__colon">ja</span>日本語の摘要。</li>
        </ul></td></tr>
      </table>
    `;
    const { mapIrdbRecordResponse } = await import("../src/sources/irdb/mapRecord.js");

    const record = mapIrdbRecordResponse("/example/multilingual", html);

    expect(record.summary).toBe("日本語の摘要。");
  });

  it("全国文化財総覧由来の IRDB detail で DOI・複数 file・主題を保持し表示ラベルを除く", async () => {
    const html = readFixture("record-sitereports-response.html");
    const { mapIrdbRecordResponse } = await import("../src/sources/irdb/mapRecord.js");

    const record = mapIrdbRecordResponse("/01144/0000000001", html);

    expect(record).toMatchObject({
      publisher: "架空市教育委員会",
      summary: "縄文時代の竪穴建物と石器を確認した。",
      subjects: ["縄文", "石器"],
      identifiers: {
        uri: "https://sitereports.nabunken.go.jp/12345",
        doi: "10.24484/sitereports.12345",
        hdl: "https://hdl.handle.net/20.500.00000/12345"
      },
      content_access: {
        viewer_url: "https://sitereports.nabunken.go.jp/files/12345_1.pdf"
      },
      source_metadata: {
        source_uri: "https://sitereports.nabunken.go.jp/12345",
        file_url: "https://sitereports.nabunken.go.jp/files/12345_1.pdf",
        file_urls: [
          "https://sitereports.nabunken.go.jp/files/12345_1.pdf",
          "https://sitereports.nabunken.go.jp/files/12345_2.pdf",
          "https://sitereports.nabunken.go.jp/files/12345_3.xlsx"
        ],
        sitereports: {
          record_id: "12345",
          record_url: "https://sitereports.nabunken.go.jp/12345",
          doi: "10.24484/sitereports.12345"
        }
      }
    });
  });

  it("file link は HTML entity を復号し absolute HTTP(S) だけを公開する", async () => {
    const html = `
      <head>
        <meta name="og:url" content="https://irdb.nii.ac.jp/example/links">
      </head>
      <table>
        <tr><th>資源識別子</th><td>
          <span class="label-field label-field__colon">URI</span>
          <a href="https://example.test/record/1">record</a>
        </td></tr>
        <tr><th>ファイル</th><td><ul>
          <li><a href="javascript:alert(1)">unsafe script</a></li>
          <li><a href="https://example.test/download?first=1&amp;next=/">safe query file</a></li>
          <li><a href="https://example.test/report.pdf#section/">safe fragment file</a></li>
          <li><a href="file:///tmp/report.pdf">local file</a></li>
          <li><a href="/relative/report.pdf">relative file</a></li>
        </ul></td></tr>
      </table>
    `;
    const { mapIrdbRecordResponse } = await import("../src/sources/irdb/mapRecord.js");

    const record = mapIrdbRecordResponse("/example/links", html);

    expect(record.content_access.viewer_url).toBe(
      "https://example.test/download?first=1&next=/"
    );
    expect(record.source_metadata).toMatchObject({
      file_url: "https://example.test/download?first=1&next=/",
      file_urls: [
        "https://example.test/download?first=1&next=/",
        "https://example.test/report.pdf#section/"
      ]
    });
    expect(record.raw).toMatchObject({
      sections: {
        file: expect.stringContaining("javascript:alert(1)")
      }
    });
  });
});

describe("IRDB 全国文化財総覧 URL helpers", () => {
  it("exact host の HTTP record URL を HTTPS の公式参照へ変換する", async () => {
    const {
      deriveSitereportsReference,
      normalizeSitereportsUrl
    } = await import("../src/sources/irdb/sitereports.js");

    expect(normalizeSitereportsUrl("http://sitereports.nabunken.go.jp/12345"))
      .toBe("https://sitereports.nabunken.go.jp/12345");
    expect(normalizeSitereportsUrl(
      "http://sitereports.nabunken.go.jp/12345?next=/#metadata/"
    )).toBe(
      "https://sitereports.nabunken.go.jp/12345?next=/#metadata/"
    );
    expect(deriveSitereportsReference(
      "https://sitereports.nabunken.go.jp/12345?lang=ja#metadata"
    )).toEqual({
      record_id: "12345",
      record_url: "https://sitereports.nabunken.go.jp/12345",
      doi: null
    });
  });

  it.each([
    "https://sitereports.nabunken.go.jp.evil.test/12345",
    "javascript://sitereports.nabunken.go.jp/12345",
    "https://user@sitereports.nabunken.go.jp/12345",
    "https://sitereports.nabunken.go.jp:8443/12345",
    "https://sitereports.nabunken.go.jp/records/12345"
  ])("unsafe または非公式形式の URL を公式参照にしない: %s", async (value) => {
    const { deriveSitereportsReference } = await import(
      "../src/sources/irdb/sitereports.js"
    );

    expect(deriveSitereportsReference(value)).toBeNull();
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
