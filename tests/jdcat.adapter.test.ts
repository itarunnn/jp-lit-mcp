import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/jdcat/${name}`, import.meta.url), "utf-8")
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("JDCat mappers", () => {
  it("検索結果 JSON を共通 SearchItem に正規化する", async () => {
    const fixture = readFixture("search-response.json");
    const { mapJdcatSearchResponse } = await import("../src/sources/jdcat/mapSearch.js");

    const result = mapJdcatSearchResponse(fixture);

    expect(result.total).toBe(19);
    expect(result.items).toEqual([
      {
        source: "jdcat",
        source_id: "43488",
        title: "全国就業実態パネル調査，2019",
        subtitle: null,
        title_reading: null,
        authors: [
          { name: "リクルートワークス研究所，実査は株式会社インテージ", role: "author" }
        ],
        publisher: "SSJ データアーカイブ",
        journal_title: null,
        issued_at: "2026-04-17",
        issued_at_label: "2026-04-17",
        issued_at_precision: "day",
        summary: "全国就業実態パネル調査（JPSED; Japanese Panel Study of Employment Dynamics）は，調査前年1年間の個人の就業状態，所得，仕事の状況などを，毎年追跡して調査を行い，Works Indexを作成・公表するとともに，日本における就業状態の変化，所得の変化を把握することを目的とする。",
        url: "https://jdcat.jsps.go.jp/records/43488",
        availability: {
          online: true,
          digital_collection: false
        },
        material_type: "dataset",
        subjects: ["量的調査: ミクロデータ", "日本"],
        table_of_contents: [],
        duplicate_key: null,
        duplicate_count: 1,
        related_records: []
      }
    ]);
  });

  it("detail JSON を共通 RecordItem に正規化する", async () => {
    const fixture = readFixture("record-response.json");
    const { mapJdcatRecordResponse } = await import("../src/sources/jdcat/mapRecord.js");

    const record = mapJdcatRecordResponse(fixture);

    expect(record).toMatchObject({
      source: "jdcat",
      source_id: "43494",
      title: "全国就業実態パネル調査，2020",
      authors: [
        { name: "リクルートワークス研究所，実査は株式会社インテージ", role: "author" }
      ],
      publisher: "SSJデータアーカイブ",
      issued_at: "2026-04-17",
      issued_at_label: "2026-04-17",
      issued_at_precision: "day",
      summary: "全国就業実態パネル調査（JPSED; Japanese Panel Study of Employment Dynamics）は，調査前年1年間の個人の就業状態，所得，仕事の状況などを，毎年追跡して調査を行い，Works Indexを作成・公表するとともに，日本における就業状態の変化，所得の変化を把握することを目的とする。",
      language: "jpn",
      material_type: "dataset",
      subjects: ["雇用"],
      identifiers: {
        jdcat_id: "43494",
        oai_id: "oai:jdcat.jsps.go.jp:00043494",
        control_number: "43494",
        doi: "10.34500/SSJDA.1349",
        study_id: "1349"
      },
      content_access: {
        has_page_images: false,
        has_text_coordinates: false,
        viewer_url: "https://ssjda.iss.u-tokyo.ac.jp/Direct/gaiyo.php?eid=1349",
        access_note: "制約付きアクセス"
      }
    });
    expect(record.source_metadata).toMatchObject({
      distributor: "SSJ データアーカイブ",
      distributor_uri: "https://csrda.iss.u-tokyo.ac.jp/ssjda/",
      source_uri: "https://ssjda.iss.u-tokyo.ac.jp/Direct/gaiyo.php?eid=1349",
      access_right: "制約付きアクセス",
      rights: "https://csrda.iss.u-tokyo.ac.jp/access/condition/",
      data_type: "量的調査: ミクロデータ",
      temporal_coverage: "2019 - 2019",
      spatial_coverage: "日本",
      version: "2"
    });
  });
});

describe("createJdcatAdapter", () => {
  it("search API と detail API を組み立てて正規化する", async () => {
    const searchFixture = readFixture("search-response.json");
    const recordFixture = readFixture("record-response.json");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get() {
            return "application/json; charset=utf-8";
          }
        },
        json: async () => searchFixture
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get() {
            return "application/json; charset=utf-8";
          }
        },
        json: async () => recordFixture
      });
    vi.stubGlobal("fetch", fetch);

    const { createJdcatAdapter } = await import("../src/sources/jdcat/adapter.js");
    const adapter = createJdcatAdapter();

    const searchResult = await adapter.search({
      query: "全国就業実態パネル調査",
      limit: 5,
      page: 2
    });
    const record = await adapter.getRecord("43494");

    expect(fetch).toHaveBeenCalledTimes(2);
    const searchUrl = new URL(fetch.mock.calls[0][0] as string);

    expect(searchUrl.origin + searchUrl.pathname).toBe("https://jdcat.jsps.go.jp/api/records/");
    expect(searchUrl.searchParams.get("q")).toBe("全国就業実態パネル調査");
    expect(searchUrl.searchParams.get("size")).toBe("5");
    expect(searchUrl.searchParams.get("page")).toBe("2");
    expect(fetch.mock.calls[1][0]).toBe("https://jdcat.jsps.go.jp/api/records/43494");
    expect(searchResult.items[0]?.source).toBe("jdcat");
    expect(record?.source).toBe("jdcat");
  });
});
