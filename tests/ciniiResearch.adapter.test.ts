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
        }
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
      publisher: null,
      issued_at: "1965",
      issued_at_label: "1965",
      issued_at_precision: "year",
      language: null,
      material_type: "Article",
      identifiers: {
        naid: "10019109559",
        data_source_cia: "10019109559"
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
      publication_date: "1965",
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
});
