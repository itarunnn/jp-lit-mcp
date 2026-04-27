import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readFixture(name: string) {
  return readFileSync(new URL(`./fixtures/kokkai/${name}`, import.meta.url), "utf-8");
}

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
      subtitle: "ただいま議題となりました法律案について、その趣旨を御説明申し上げます。",
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
