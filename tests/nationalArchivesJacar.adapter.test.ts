import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { searchInputSchema } from "../src/lib/schemas.js";
import { validateSourceId } from "../src/lib/sourceId.js";
import { createSearchService } from "../src/services/searchService.js";
import { resolveAdapterOptionsFromEnv } from "../src/server.js";
import type { SearchItem } from "../src/lib/types.js";
import type { SourceAdapter } from "../src/sources/types.js";

function readFixture(dir: "national-archives" | "jacar", name: string) {
  return readFileSync(new URL(`./fixtures/${dir}/${name}`, import.meta.url), "utf-8");
}

function createSearchItem(source: SearchItem["source"], sourceId: string): SearchItem {
  return {
    source,
    source_id: sourceId,
    title: `${source}:${sourceId}`,
    subtitle: null,
    title_reading: null,
    authors: [],
    publisher: null,
    journal_title: null,
    issued_at: null,
    issued_at_label: null,
    issued_at_precision: "unknown",
    summary: null,
    url: null,
    availability: { online: true, digital_collection: false },
    material_type: null,
    subjects: [],
    table_of_contents: [],
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("national_archives / jacar source schema", () => {
  it("明示 source として受け付ける", () => {
    expect(searchInputSchema.parse({ query: "太政官", source: "national_archives" }).source)
      .toBe("national_archives");
    expect(searchInputSchema.parse({ query: "台湾総督府", source: "jacar" }).source)
      .toBe("jacar");
  });

  it("server 用の環境変数から base URL override を解決する", () => {
    const config = resolveAdapterOptionsFromEnv({
      NATIONAL_ARCHIVES_BASE_URL: "https://archives.example.test/root/",
      JACAR_BASE_URL: "https://jacar.example.test/root/"
    });

    expect(config.nationalArchives).toEqual({
      baseUrl: "https://archives.example.test/root/"
    });
    expect(config.jacar).toEqual({
      baseUrl: "https://jacar.example.test/root/"
    });
  });

  it("source 未指定の既定横断には含めない", async () => {
    const adapters: SourceAdapter[] = [
      {
        source: "ndl_catalog",
        search: async () => ({ total: 1, items: [createSearchItem("ndl_catalog", "1")] }),
        getRecord: async () => null
      },
      {
        source: "national_archives",
        search: async () => ({ total: 1, items: [createSearchItem("national_archives", "2")] }),
        getRecord: async () => null
      },
      {
        source: "jacar",
        search: async () => ({ total: 1, items: [createSearchItem("jacar", "3")] }),
        getRecord: async () => null
      }
    ];

    const result = await createSearchService(adapters).search({
      query: "太政官",
      limit: 10,
      page: 1
    });

    expect(result.items.map((item) => item.source)).toEqual(["ndl_catalog"]);
  });

  it("source_id の形式を source ごとに検証する", () => {
    expect(validateSourceId("national_archives", " 3148544 ")).toBe("3148544");
    expect(validateSourceId("jacar", " A01000012800 ")).toBe("A01000012800");
    expect(validateSourceId("cinii_dissertations", " 1910848250911873152 ")).toBe("1910848250911873152");
    expect(validateSourceId("nijl_articles", " 12345678 ")).toBe("12345678");
    expect(validateSourceId("kokusho", " 100001234 ")).toBe("100001234");
    expect(validateSourceId("ninjal_bibliography", " BUN12345 ")).toBe("BUN12345");
    expect(() => validateSourceId("national_archives", "A01000012800"))
      .toThrow("national_archives の source_id 形式が不正です");
    expect(() => validateSourceId("jacar", "3148544"))
      .toThrow("jacar の source_id 形式が不正です");
    expect(() => validateSourceId("cinii_dissertations", "https://cir.nii.ac.jp/crid/1910848250911873152"))
      .toThrow("cinii_dissertations の source_id 形式が不正です");
    expect(() => validateSourceId("nijl_articles", "https://example.test/1"))
      .toThrow("nijl_articles の source_id 形式が不正です");
    expect(() => validateSourceId("nijl_articles", "BUN12345"))
      .toThrow("nijl_articles の source_id 形式が不正です");
  });
});

describe("nationalArchives mapper / adapter", () => {
  it("検索 HTML と RDF/CSV 詳細を共通形式に正規化する", async () => {
    const { mapNationalArchivesSearchResponse } = await import(
      "../src/sources/nationalArchives/mapSearch.js"
    );
    const { mapNationalArchivesRecordResponse } = await import(
      "../src/sources/nationalArchives/mapRecord.js"
    );

    const search = mapNationalArchivesSearchResponse(
      readFixture("national-archives", "search-response.html")
    );
    const record = mapNationalArchivesRecordResponse(
      "3148544",
      readFixture("national-archives", "record-response.rdf"),
      readFixture("national-archives", "record-response.csv")
    );

    expect(search.total).toBe(123);
    expect(search.items[0]).toMatchObject({
      source: "national_archives",
      source_id: "3148544",
      title: "太政官布告・第一号",
      url: "https://www.digital.archives.go.jp/file/3148544.html",
      source_metadata: {
        call_number: "太00001100",
        hierarchy: "公文録"
      }
    });
    expect(record).toMatchObject({
      source: "national_archives",
      source_id: "3148544",
      title: "太政官布告・第一号",
      authors: [{ name: "太政官", role: "creator" }],
      publisher: "国立公文書館",
      material_type: "特定歴史公文書等",
      content_access: {
        has_page_images: true,
        has_text_coordinates: false,
        viewer_url: "https://www.digital.archives.go.jp/file/3148544.html"
      },
      source_metadata: {
        image_count: 3,
        has_images: true,
        call_number: "太00001100",
        access_restriction: "公開"
      }
    });
  });

  it("BOM 付き CSV でもヘッダを認識して詳細を補強する", async () => {
    const { mapNationalArchivesRecordResponse } = await import(
      "../src/sources/nationalArchives/mapRecord.js"
    );
    const csv = "\uFEFF\"資料名\",\"階層\",\"請求番号\",\"作成年月日\",\"所蔵館\",\"画像数\"\n" +
      "\"CSV由来タイトル\",\"公文録\",\"太00001100\",\"明治元年\",\"国立公文書館\",\"3\"\n";
    const record = mapNationalArchivesRecordResponse(
      "3148544",
      readFixture("national-archives", "record-response.rdf"),
      csv
    );

    expect(record.title).toBe("CSV由来タイトル");
    expect(record.source_metadata.call_number).toBe("太00001100");
    expect(record.source_metadata.image_count).toBe(3);
  });

  it("adapter は検索 URL と RDF/CSV URL を組み立て、403 はネットワーク制限の可能性を示す", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => readFixture("national-archives", "search-response.html")
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/rdf+xml" },
        text: async () => readFixture("national-archives", "record-response.rdf")
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/csv; charset=UTF-8" },
        text: async () => readFixture("national-archives", "record-response.csv")
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden"
      });
    vi.stubGlobal("fetch", fetch);

    const { createNationalArchivesAdapter } = await import(
      "../src/sources/nationalArchives/adapter.js"
    );
    const adapter = createNationalArchivesAdapter();

    await adapter.search({ query: "太政官", limit: 20, page: 2 });
    const record = await adapter.getRecord("3148544");

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.origin + searchUrl.pathname).toBe("https://www.digital.archives.go.jp/search");
    expect(searchUrl.searchParams.get("kw0")).toBe("太政官");
    expect(searchUrl.searchParams.get("ks0")).toBe("kw_all");
    expect(searchUrl.searchParams.get("kl0")).toBe("AND");
    expect(searchUrl.searchParams.get("rows")).toBe("20");
    expect(searchUrl.searchParams.get("page")).toBe("2");
    expect(fetch.mock.calls[1][0]).toBe("https://www.digital.archives.go.jp/file/3148544.rdf");
    expect((fetch.mock.calls[2][1] as RequestInit).method).toBe("POST");
    expect(record?.source_id).toBe("3148544");

    await expect(adapter.search({ query: "VPN", limit: 1, page: 1 }))
      .rejects.toThrow("VPN・ネットワーク制限の可能性");
  });

  it("検索 rows は上流が受け付ける値に丸め、返却件数は requested limit に絞る", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () => readFixture("national-archives", "search-response.html")
    });
    vi.stubGlobal("fetch", fetch);

    const { createNationalArchivesAdapter } = await import(
      "../src/sources/nationalArchives/adapter.js"
    );
    const adapter = createNationalArchivesAdapter();
    const result = await adapter.search({ query: "太政官", limit: 1, page: 1 });

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.searchParams.get("rows")).toBe("20");
    expect(result.items).toHaveLength(1);
  });

  it("baseUrl に path prefix がある場合も検索・詳細 URL で保持する", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => readFixture("national-archives", "search-response.html")
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/rdf+xml" },
        text: async () => readFixture("national-archives", "record-response.rdf")
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/csv; charset=UTF-8" },
        text: async () => readFixture("national-archives", "record-response.csv")
      });
    vi.stubGlobal("fetch", fetch);

    const { createNationalArchivesAdapter } = await import(
      "../src/sources/nationalArchives/adapter.js"
    );
    const adapter = createNationalArchivesAdapter({
      baseUrl: "https://proxy.example.test/archives/"
    });

    await adapter.search({ query: "太政官", limit: 1, page: 1 });
    await adapter.getRecord("3148544");

    expect(new URL(fetch.mock.calls[0][0] as string).pathname).toBe("/archives/search");
    expect(new URL(fetch.mock.calls[1][0] as string).pathname).toBe("/archives/file/3148544.rdf");
    expect(new URL(fetch.mock.calls[2][0] as string).pathname).toBe("/archives/download");
  });

  it("CSV 補強が失敗しても RDF 詳細だけで record を返す", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/rdf+xml" },
        text: async () => readFixture("national-archives", "record-response.rdf")
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error"
      });
    vi.stubGlobal("fetch", fetch);

    const { createNationalArchivesAdapter } = await import(
      "../src/sources/nationalArchives/adapter.js"
    );
    const adapter = createNationalArchivesAdapter();

    const record = await adapter.getRecord("3148544");

    expect(record).toMatchObject({
      source: "national_archives",
      source_id: "3148544",
      title: "太政官布告・第一号"
    });
  });
});

describe("jacar mapper / adapter", () => {
  it("検索 HTML と詳細 HTML/CSV を共通形式に正規化する", async () => {
    const { mapJacarSearchResponse } = await import("../src/sources/jacar/mapSearch.js");
    const { mapJacarRecordResponse } = await import("../src/sources/jacar/mapRecord.js");

    const search = mapJacarSearchResponse(readFixture("jacar", "search-response.html"));
    const record = mapJacarRecordResponse(
      "A01000012800",
      readFixture("jacar", "record-response.html"),
      readFixture("jacar", "record-response.csv")
    );

    expect(search.total).toBe(456);
    expect(search.items[0]).toMatchObject({
      source: "jacar",
      source_id: "A01000012800",
      title: "御署名原本・明治元年・太政官布告第一号",
      url: "https://www.jacar.archives.go.jp/das/meta/A01000012800",
      source_metadata: {
        reference_code: "A01000012800",
        hierarchy: "国立公文書館 / 太政官"
      }
    });
    expect(record).toMatchObject({
      source: "jacar",
      source_id: "A01000012800",
      title: "御署名原本・明治元年・太政官布告第一号",
      publisher: "国立公文書館",
      content_access: {
        has_page_images: true,
        has_text_coordinates: false,
        viewer_url: "https://www.jacar.archives.go.jp/das/meta/A01000012800"
      },
      source_metadata: {
        reference_code: "A01000012800",
        image_count: 2,
        has_images: true,
        call_number: "御00100100"
      }
    });
  });

  it("BOM 付き CSV でもヘッダを認識して詳細を補強する", async () => {
    const { mapJacarRecordResponse } = await import("../src/sources/jacar/mapRecord.js");
    const csv = "\uFEFF\"レファレンスコード\",\"件名標題\",\"階層\",\"請求番号\",\"所蔵館\"\n" +
      "\"B01000012800\",\"CSV由来JACARタイトル\",\"階層\",\"御00100100\",\"国立公文書館\"\n";
    const record = mapJacarRecordResponse(
      "A01000012800",
      readFixture("jacar", "record-response.html"),
      csv
    );

    expect(record.source_id).toBe("B01000012800");
    expect(record.title).toBe("CSV由来JACARタイトル");
    expect(record.publisher).toBe("国立公文書館");
    expect(record.source_metadata.call_number).toBe("御00100100");
  });

  it("adapter は検索 URL と詳細/CSV URL を組み立てる", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => readFixture("jacar", "search-response.html")
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => readFixture("jacar", "record-response.html")
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/csv; charset=UTF-8" },
        text: async () => readFixture("jacar", "record-response.csv")
      });
    vi.stubGlobal("fetch", fetch);

    const { createJacarAdapter } = await import("../src/sources/jacar/adapter.js");
    const adapter = createJacarAdapter();

    await adapter.search({ query: "台湾総督府", limit: 50, page: 1 });
    const record = await adapter.getRecord("A01000012800");

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.origin + searchUrl.pathname).toBe("https://www.jacar.archives.go.jp/aj/search");
    expect(searchUrl.searchParams.get("kw0")).toBe("台湾総督府");
    expect(searchUrl.searchParams.get("rows")).toBe("50");
    expect(fetch.mock.calls[1][0]).toBe("https://www.jacar.archives.go.jp/das/meta/A01000012800");
    expect((fetch.mock.calls[2][1] as RequestInit).method).toBe("POST");
    expect(record?.source_id).toBe("A01000012800");
  });

  it("検索 rows は上流が受け付ける値に丸め、返却件数は requested limit に絞る", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () => readFixture("jacar", "search-response.html")
    });
    vi.stubGlobal("fetch", fetch);

    const { createJacarAdapter } = await import("../src/sources/jacar/adapter.js");
    const adapter = createJacarAdapter();
    const result = await adapter.search({ query: "台湾総督府", limit: 1, page: 1 });

    const searchUrl = new URL(fetch.mock.calls[0][0] as string);
    expect(searchUrl.searchParams.get("rows")).toBe("20");
    expect(result.items).toHaveLength(1);
  });

  it("baseUrl に path prefix がある場合も検索・詳細 URL で保持する", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => readFixture("jacar", "search-response.html")
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => readFixture("jacar", "record-response.html")
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/csv; charset=UTF-8" },
        text: async () => readFixture("jacar", "record-response.csv")
      });
    vi.stubGlobal("fetch", fetch);

    const { createJacarAdapter } = await import("../src/sources/jacar/adapter.js");
    const adapter = createJacarAdapter({
      baseUrl: "https://proxy.example.test/jacar/"
    });

    await adapter.search({ query: "台湾総督府", limit: 1, page: 1 });
    await adapter.getRecord("A01000012800");

    expect(new URL(fetch.mock.calls[0][0] as string).pathname).toBe("/jacar/aj/search");
    expect(new URL(fetch.mock.calls[1][0] as string).pathname).toBe("/jacar/das/meta/A01000012800");
    expect(new URL(fetch.mock.calls[2][0] as string).pathname).toBe("/jacar/aj/download");
  });

  it("CSV 補強が失敗しても HTML 詳細だけで record を返す", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => readFixture("jacar", "record-response.html")
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error"
      });
    vi.stubGlobal("fetch", fetch);

    const { createJacarAdapter } = await import("../src/sources/jacar/adapter.js");
    const adapter = createJacarAdapter();

    const record = await adapter.getRecord("A01000012800");

    expect(record).toMatchObject({
      source: "jacar",
      source_id: "A01000012800",
      title: "御署名原本・明治元年・太政官布告第一号"
    });
  });
});
