import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/nihu-bridge/${name}`, import.meta.url), "utf-8")
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("nihuBridge mappers", () => {
  it("検索レスポンスを SearchItem に正規化する（title の || 区切りと creator の <ID> マークアップを除去）", async () => {
    const fixture = readFixture("search-response.json");
    const { mapNihuBridgeSearchResponse } = await import(
      "../src/sources/nihuBridge/mapSearch.js"
    );
    const result = mapNihuBridgeSearchResponse(fixture);

    expect(result.total).toBe(4621);
    expect(result.items).toHaveLength(1);
    const item = result.items[0]!;
    expect(item.source).toBe("nihu_bridge");
    expect(item.source_id).toBe("100000123");
    expect(item.title).toBe("武家百人一首");
    expect(item.title_reading).toBe("ブケヒャクニンイッシュ");
    expect(item.authors).toEqual([{ name: "源義経", role: "author" }]);
    expect(item.publisher).toBe("国文学研究資料館");
    expect(item.url).toBe("https://bridge.nihu.jp/integrated_searchresults_detail/100000123");
    expect(item.availability.online).toBe(true);
    expect(item.material_type).toBe("古典籍");
    expect(item.subjects).toEqual(["和歌", "百人一首"]);
    expect(item.summary).toContain("武家による百人一首集");
    expect(item.issued_at).toBe("1600-01-01");
  });

  it("取得レスポンス（researchResource）を RecordItem に正規化する", async () => {
    const fixture = readFixture("record-response.json");
    const { mapNihuBridgeRecordResponse } = await import(
      "../src/sources/nihuBridge/mapRecord.js"
    );
    const record = mapNihuBridgeRecordResponse(fixture);

    expect(record).not.toBeNull();
    expect(record!.source).toBe("nihu_bridge");
    expect(record!.source_id).toBe("100000123");
    expect(record!.title).toBe("武家百人一首");
    expect(record!.title_reading).toBe("ブケヒャクニンイッシュ");
    expect(record!.authors).toEqual([{ name: "源義経", role: "author" }]);
    expect(record!.publisher).toBe("国文学研究資料館");
    expect(record!.alternative_titles).toContain("武家百人一首抄");
    expect(record!.subjects).toEqual(["和歌", "百人一首"]);
    expect(record!.language).toBe("jpn");
    expect(record!.material_type).toBe("古典籍");
    expect(record!.url).toBe(
      "https://bridge.nihu.jp/integrated_searchresults_detail/100000123"
    );
    expect(record!.identifiers).toMatchObject({
      research_resource_id: "100000123",
      database_id: "nijl_nihonkotenseki",
      original_ids: ["nijl-12345"]
    });
    expect(record!.source_metadata).toMatchObject({
      database_id: "nijl_nihonkotenseki",
      research_resource_id: "100000123",
      license: "CC BY 4.0"
    });
    expect(record!.issued_at).toBe("1600-01-01");
  });

  it("dateCreated に [刊行年月] エントリがある場合は temporal より優先して issued_at に使う", async () => {
    const { mapNihuBridgeSearchResponse } = await import(
      "../src/sources/nihuBridge/mapSearch.js"
    );

    const payload = {
      info: { statusCode: 0, total: 1 },
      hits: [
        {
          database: "nijl_test",
          id: "999",
          fields: [
            { field: "title", value: ["テスト資料"] },
            { field: "dateCreated", value: ["[刊行年月]1889-02", "[登録日]2020-01-01"] },
            { field: "temporal", value: [{ description: ["明治時代"], date: "1868-01-01T00:00:00+09:00,1912-07-30T00:00:00+09:00" }] },
            { field: "datePublished", value: "2020-01-01" }
          ]
        }
      ]
    };

    const result = mapNihuBridgeSearchResponse(payload);
    expect(result.items[0]!.issued_at).toBe("1889-02");
    expect(result.items[0]!.issued_at_precision).toBe("month");
  });

  it("dateCreated に [刊行年月] がなければ temporal を使う", async () => {
    const { mapNihuBridgeSearchResponse } = await import(
      "../src/sources/nihuBridge/mapSearch.js"
    );

    const payload = {
      info: { statusCode: 0, total: 1 },
      hits: [
        {
          database: "nijl_test",
          id: "998",
          fields: [
            { field: "title", value: ["テスト資料"] },
            { field: "dateCreated", value: ["[登録日]2020-01-01"] },
            { field: "temporal", value: [{ description: ["江戸時代"], date: "1600-01-01T00:00:00+09:00,1868-12-31T00:00:00+09:00" }] },
            { field: "datePublished", value: "2020-01-01" }
          ]
        }
      ]
    };

    const result = mapNihuBridgeSearchResponse(payload);
    expect(result.items[0]!.issued_at).toBe("1600-01-01");
  });

  it("datePublished は登録日のため issued_at に使わない", async () => {
    const { mapNihuBridgeSearchResponse } = await import(
      "../src/sources/nihuBridge/mapSearch.js"
    );

    const payload = {
      info: { statusCode: 0, total: 1 },
      hits: [
        {
          database: "nijl_test",
          id: "997",
          fields: [
            { field: "title", value: ["テスト資料"] },
            { field: "datePublished", value: "2022-07-20" }
          ]
        }
      ]
    };

    const result = mapNihuBridgeSearchResponse(payload);
    expect(result.items[0]!.issued_at).toBeNull();
  });

  it("link フィールドの有無に関わらず bridge.nihu.jp 詳細 URL を使う", async () => {
    const { mapNihuBridgeSearchResponse } = await import(
      "../src/sources/nihuBridge/mapSearch.js"
    );

    const payload = {
      info: { statusCode: 0, total: 1 },
      hits: [
        {
          database: "nijl_nihonkotenseki",
          id: "16497093",
          fields: [
            { field: "title", value: ["テスト資料"] },
            { field: "link", value: [{ type: "原本", link: "https://kotenseki.nijl.ac.jp/biblio/16497093" }] }
          ]
        }
      ]
    };

    const result = mapNihuBridgeSearchResponse(payload);
    expect(result.items[0]!.url).toBe(
      "https://bridge.nihu.jp/integrated_searchresults_detail/16497093"
    );
    expect(result.items[0]!.availability.online).toBe(true);
  });

  it("researchResource が無いレスポンスでは null を返す", async () => {
    const { mapNihuBridgeRecordResponse } = await import(
      "../src/sources/nihuBridge/mapRecord.js"
    );
    expect(mapNihuBridgeRecordResponse({ info: { statusCode: 99 } })).toBeNull();
  });
});

describe("createNihuBridgeAdapter", () => {
  it("検索は POST + JSON body で叩き、paging.start を (page-1)*limit に揃える", async () => {
    const searchFixture = readFixture("search-response.json");
    const fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json; charset=utf-8" },
      json: async () => searchFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createNihuBridgeAdapter } = await import(
      "../src/sources/nihuBridge/adapter.js"
    );
    const adapter = createNihuBridgeAdapter();
    const result = await adapter.search({
      query: "源氏物語",
      limit: 10,
      page: 2
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(
      "https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/search"
    );
    expect(init.method).toBe("POST");
    expect(
      (init.headers as Record<string, string>)["Content-Type"]
    ).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body.query.paging).toEqual({ start: 10, size: 10 });
    expect(body.query.conditions[0]).toMatchObject({
      connect: "AND",
      query: { term: "源氏物語" }
    });
    expect(result.items[0]!.source).toBe("nihu_bridge");
  });

  it("filters に institute / period / bbox / normalize=false が乗ると body に反映される", async () => {
    const searchFixture = readFixture("search-response.json");
    const fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json; charset=utf-8" },
      json: async () => searchFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createNihuBridgeAdapter } = await import(
      "../src/sources/nihuBridge/adapter.js"
    );
    const adapter = createNihuBridgeAdapter();
    await adapter.search({
      query: "平家物語",
      limit: 5,
      page: 1,
      filters: {
        nihu_bridge: {
          institute: ["nijl"],
          normalize: false,
          period_from: "1185",
          period_to: "1600",
          bbox: { lat1: 35.02, lon1: 135.68, lat2: 34.94, lon2: 135.79 }
        }
      }
    });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.institute).toEqual(["nijl"]);
    expect(body.query.conditions[0]).toMatchObject({
      connect: "AND",
      query: { term: "平家物語", normalize: false }
    });
    expect(body.query.conditions[1]).toMatchObject({
      connect: "AND",
      query: {
        field: "temporal",
        operator: "BETWEEN"
      }
    });
    expect(body.query.conditions[1].query.term).toBe(
      "1185-01-01T00:00:00+09:00,1600-12-31T00:00:00+09:00"
    );
    expect(body.query.conditions[2]).toMatchObject({
      connect: "AND",
      query: {
        field: "spatial",
        term: "(35.02,135.68),(34.94,135.79)"
      }
    });
  });

  it("top-level issued_from / issued_to は filters.nihu_bridge.period_* が無いとき temporal 条件に変換する", async () => {
    const searchFixture = readFixture("search-response.json");
    const fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json; charset=utf-8" },
      json: async () => searchFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createNihuBridgeAdapter } = await import(
      "../src/sources/nihuBridge/adapter.js"
    );
    const adapter = createNihuBridgeAdapter();
    await adapter.search({
      query: "平家物語",
      limit: 5,
      page: 1,
      issued_from: "1185",
      issued_to: "1600"
    });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.query.conditions[1].query.term).toBe(
      "1185-01-01T00:00:00+09:00,1600-12-31T00:00:00+09:00"
    );
  });

  it("レコード取得は GET で叩き、404 は null に変換する", async () => {
    const recordFixture = readFixture("record-response.json");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json; charset=utf-8" },
        json: async () => recordFixture
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: { get: () => "application/json" }
      });
    vi.stubGlobal("fetch", fetch);

    const { createNihuBridgeAdapter } = await import(
      "../src/sources/nihuBridge/adapter.js"
    );
    const adapter = createNihuBridgeAdapter();
    const record = await adapter.getRecord("100000123");
    expect(record?.source_id).toBe("100000123");
    const calledUrl = fetch.mock.calls[0]![0] as string;
    expect(calledUrl).toBe(
      "https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/100000123"
    );

    const missing = await adapter.getRecord("999999999");
    expect(missing).toBeNull();
  });
});
