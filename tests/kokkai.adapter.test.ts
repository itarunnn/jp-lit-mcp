import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function readFixture(name: string) {
  return readFileSync(new URL(`./fixtures/kokkai/${name}`, import.meta.url), "utf-8");
}

describe("mapKokkaiMeetingResponse", () => {
  it("meeting JSON を RecordItem に正規化する（kokkai_minutes）", async () => {
    const json = readFixture("meeting-response.json");
    const { mapKokkaiMeetingResponse } = await import("../src/sources/kokkai/mapRecord.js");

    const record = mapKokkaiMeetingResponse("kokkai_minutes", "1151420_098_2_00026", json);

    expect(record).toMatchObject({
      source: "kokkai_minutes",
      source_id: "1151420_098_2_00026",
      title: "衆議院本会議 第214回国会 第2号（2023-01-25）",
      subtitle: null,
      title_reading: null,
      authors: [],
      publisher: "国立国会図書館",
      journal_title: "衆議院本会議",
      issued_at: "2023-01-25",
      issued_at_label: "2023-01-25",
      issued_at_precision: "day",
      url: "https://kokkai.ndl.go.jp/record/1151420_098_2",
      availability: { online: true, digital_collection: false },
      alternative_titles: ["第214回国会衆議院本会議第2号"],
      publication_place: "日本",
      language: "ja",
      material_type: "parliamentary_record",
      extent: null,
      subjects: [],
      identifiers: { issue_id: "1151420_098_2", session: 214 },
      table_of_contents: [],
      content_access: {
        has_page_images: true,
        has_text_coordinates: false,
        viewer_url: "https://kokkai.ndl.go.jp/record/1151420_098_2",
        access_note: null
      }
    });
    expect(record?.source_metadata).toMatchObject({
      issue_id: "1151420_098_2",
      session: 214,
      name_of_house: "衆議院",
      name_of_meeting: "本会議",
      issue: "第2号",
      pdf_url: "https://kokkai.ndl.go.jp/pdf/1151420_098_2",
      speech_count: 2
    });
    expect(Array.isArray(record?.source_metadata.speeches)).toBe(true);
    expect((record?.source_metadata.speeches as unknown[]).length).toBe(2);
  });

  it("record が空のとき null を返す", async () => {
    const json = JSON.stringify({ numberOfRecords: 0, numberOfReturn: 0, startRecord: 1, record: [] });
    const { mapKokkaiMeetingResponse } = await import("../src/sources/kokkai/mapRecord.js");

    const record = mapKokkaiMeetingResponse("kokkai_minutes", "missing_id", json);

    expect(record).toBeNull();
  });
});

describe("mapKokkaiSearchResponse", () => {
  it("speech JSON を SearchItem[] に正規化する（kokkai_minutes）", async () => {
    const json = readFixture("speech-response.json");
    const { mapKokkaiSearchResponse } = await import("../src/sources/kokkai/mapSearch.js");

    const result = mapKokkaiSearchResponse("kokkai_minutes", json);

    expect(result.total).toBe(15842);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      source: "kokkai_minutes",
      source_id: "1151420_098_2_00026",
      title: "岸田文雄 — 衆議院本会議 第214回国会 第2号（2023-01-25）",
      subtitle: null,
      title_reading: "きしだふみお",
      authors: [{ name: "岸田文雄", role: "内閣総理大臣" }],
      publisher: "国立国会図書館",
      journal_title: "衆議院本会議",
      issued_at: "2023-01-25",
      issued_at_label: "2023-01-25",
      issued_at_precision: "day",
      summary: "ただいま議題となりました法律案について、その趣旨を御説明申し上げます。",
      url: "https://kokkai.ndl.go.jp/record/1151420_098_2_00026",
      availability: { online: true, digital_collection: false },
      material_type: "parliamentary_record",
      subjects: ["自由民主党"],
      table_of_contents: [],
      duplicate_key: "1151420_098_2",
      duplicate_count: 1,
      related_records: []
    });
  });

  it("source=teikoku_minutes のとき items[0].source が teikoku_minutes になる", async () => {
    const json = readFixture("speech-response.json");
    const { mapKokkaiSearchResponse } = await import("../src/sources/kokkai/mapSearch.js");

    const result = mapKokkaiSearchResponse("teikoku_minutes", json);

    expect(result.items[0]?.source).toBe("teikoku_minutes");
  });

  it("speakerRole が空文字・speakerPosition が空文字のとき role は null", async () => {
    const json = readFixture("speech-response.json");
    const { mapKokkaiSearchResponse } = await import("../src/sources/kokkai/mapSearch.js");

    const result = mapKokkaiSearchResponse("kokkai_minutes", json);

    // items[1] は speakerRole="" speakerPosition="" なので null
    expect(result.items[1]?.authors[0]?.role).toBeNull();
  });

  it("summary は 500 字を超える発言を切り詰めて末尾に … を付ける", async () => {
    const longSpeech = "あ".repeat(600);
    const json = JSON.stringify({
      numberOfRecords: 1,
      numberOfReturn: 1,
      startRecord: 1,
      record: [{
        speechID: "test_001_1_00001",
        issueID: "test_001_1",
        session: 1,
        nameOfHouse: "衆議院",
        nameOfMeeting: "本会議",
        issue: "第1号",
        date: "1947-05-20",
        speechOrder: 1,
        speaker: "テスト議員",
        speakerYomi: "てすとぎいん",
        speakerGroup: "テスト党",
        speakerPosition: "",
        speakerRole: "",
        speech: longSpeech,
        startPage: 1,
        speechURL: "https://kokkai.ndl.go.jp/record/test_001_1_00001",
        meetingURL: "https://kokkai.ndl.go.jp/record/test_001_1",
        pdfURL: "https://kokkai.ndl.go.jp/pdf/test_001_1"
      }]
    });
    const { mapKokkaiSearchResponse } = await import("../src/sources/kokkai/mapSearch.js");

    const result = mapKokkaiSearchResponse("kokkai_minutes", json);

    expect(result.items[0]?.summary).toMatch(/…$/);
    expect(result.items[0]?.summary?.length).toBeLessThanOrEqual(501);
  });
});

describe("createKokkaiAdapter", () => {
  it("speech エンドポイントを叩いて SearchResult を返す", async () => {
    const speechFixture = readFixture("speech-response.json");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null },
      text: async () => speechFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createKokkaiAdapter } = await import("../src/sources/kokkai/adapter.js");
    const adapter = createKokkaiAdapter();

    const result = await adapter.search({ query: "賭博", limit: 10, page: 1 });

    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(fetch.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://kokkai.ndl.go.jp/api/speech");
    expect(url.searchParams.get("any")).toBe("賭博");
    expect(url.searchParams.get("maximumRecords")).toBe("10");
    expect(url.searchParams.get("startRecord")).toBe("1");
    expect(url.searchParams.get("recordPacking")).toBe("json");
    expect(result.total).toBe(15842);
    expect(result.items[0]?.source).toBe("kokkai_minutes");
  });

  it("page=3, limit=5 のとき startRecord=11 になる", async () => {
    const speechFixture = readFixture("speech-response.json");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null },
      text: async () => speechFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createKokkaiAdapter } = await import("../src/sources/kokkai/adapter.js");
    const adapter = createKokkaiAdapter();

    await adapter.search({ query: "賭博", limit: 5, page: 3 });

    const url = new URL(fetch.mock.calls[0][0] as string);
    expect(url.searchParams.get("startRecord")).toBe("11");
    expect(url.searchParams.get("maximumRecords")).toBe("5");
  });

  it("getRecord は meeting エンドポイントを叩いて RecordItem を返す", async () => {
    const meetingFixture = readFixture("meeting-response.json");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null },
      text: async () => meetingFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createKokkaiAdapter } = await import("../src/sources/kokkai/adapter.js");
    const adapter = createKokkaiAdapter();

    const record = await adapter.getRecord("1151420_098_2_00026");

    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(fetch.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://kokkai.ndl.go.jp/api/meeting");
    expect(url.searchParams.get("issueID")).toBe("1151420_098_2");
    expect(url.searchParams.get("recordPacking")).toBe("json");
    expect(record?.source).toBe("kokkai_minutes");
    expect(record?.source_id).toBe("1151420_098_2_00026");
  });

  it("meeting が空のとき getRecord は null を返す", async () => {
    const emptyJson = JSON.stringify({ numberOfRecords: 0, numberOfReturn: 0, startRecord: 1, record: [] });
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null },
      text: async () => emptyJson
    });
    vi.stubGlobal("fetch", fetch);

    const { createKokkaiAdapter } = await import("../src/sources/kokkai/adapter.js");
    const adapter = createKokkaiAdapter();

    const record = await adapter.getRecord("missing_001_1_00001");

    expect(record).toBeNull();
  });
});

describe("createTeikokuAdapter", () => {
  it("teikoku の speech エンドポイントを叩く", async () => {
    const speechFixture = readFixture("speech-response.json");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null },
      text: async () => speechFixture
    });
    vi.stubGlobal("fetch", fetch);

    const { createTeikokuAdapter } = await import("../src/sources/kokkai/adapter.js");
    const adapter = createTeikokuAdapter();

    const result = await adapter.search({ query: "賭博", limit: 10, page: 1 });

    const url = new URL(fetch.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://teikokugikai-i.ndl.go.jp/api/emp/speech");
    expect(result.items[0]?.source).toBe("teikoku_minutes");
  });
});
