# kokkai_minutes / teikoku_minutes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `jp_lit_search(source=kokkai_minutes|teikoku_minutes)` と `jp_lit_get_record` で国会会議録・帝国議会会議録を検索・取得できるようにする。

**Architecture:** 国会会議録 API (`kokkai.ndl.go.jp/api`) と帝国議会会議録 API (`teikokugikai-i.ndl.go.jp/api/emp`) はほぼ同一の JSON スキーマを持つ。共通 mapper（mapSearch / mapRecord）を一つ実装し、adapter factory で base URL と source 名だけ差し替える設計。`jp_lit_search` には speech エンドポイントを使い発言単位で返す。`jp_lit_get_record` には meeting エンドポイントを使い会議全体を RecordItem として返す。

**Tech Stack:** TypeScript, Vitest, fetch API（既存 `fetchJson` ユーティリティ）

---

## ファイル構成

| パス | 役割 |
|------|------|
| `src/sources/kokkai/adapter.ts` | `createKokkaiAdapter` / `createTeikokuAdapter` factory |
| `src/sources/kokkai/mapSearch.ts` | speech JSON → `SearchItem[]` |
| `src/sources/kokkai/mapRecord.ts` | meeting JSON → `RecordItem` |
| `src/lib/types.ts` | `SourceName` に `"kokkai_minutes"` `"teikoku_minutes"` 追加 |
| `src/lib/schemas.ts` | `sourceSchema` に同上追加 |
| `src/server.ts` | adapter 登録・環境変数追加 |
| `tests/kokkai.adapter.test.ts` | 全テスト |
| `tests/fixtures/kokkai/speech-response.json` | speech エンドポイント fixture |
| `tests/fixtures/kokkai/meeting-response.json` | meeting エンドポイント fixture |
| `README.md` | 新 source ドキュメント追加 |

---

## API 仕様メモ（実装者向け）

**エンドポイント:**

```
# 国会会議録
GET https://kokkai.ndl.go.jp/api/speech
GET https://kokkai.ndl.go.jp/api/meeting

# 帝国議会会議録
GET https://teikokugikai-i.ndl.go.jp/api/emp/speech
GET https://teikokugikai-i.ndl.go.jp/api/emp/meeting
```

**主なパラメータ（両 API 共通）:**

| パラメータ | 説明 |
|-----------|------|
| `any` | キーワード（AND 検索） |
| `maximumRecords` | 取得件数（speech: 1-100、meeting: 1-10） |
| `startRecord` | 開始位置（1 始まり） |
| `recordPacking` | `json`（固定） |
| `issueID` | 会議録 ID（getRecord で使用） |

**speech レスポンス構造:**

```json
{
  "numberOfRecords": 15842,
  "numberOfReturn": 1,
  "startRecord": 1,
  "nextRecordPosition": 2,
  "record": [
    {
      "speechID": "1151420_098_2_00026",
      "issueID": "1151420_098_2",
      "session": 214,
      "nameOfHouse": "衆議院",
      "nameOfMeeting": "本会議",
      "issue": "第2号",
      "date": "2023-01-25",
      "speechOrder": 26,
      "speaker": "岸田文雄",
      "speakerYomi": "きしだふみお",
      "speakerGroup": "自由民主党",
      "speakerPosition": "内閣総理大臣",
      "speakerRole": "",
      "speech": "ただいま議題となりました法律案について...",
      "startPage": 5,
      "speechURL": "https://kokkai.ndl.go.jp/record/1151420_098_2_00026",
      "meetingURL": "https://kokkai.ndl.go.jp/record/1151420_098_2",
      "pdfURL": "https://kokkai.ndl.go.jp/pdf/1151420_098_2"
    }
  ]
}
```

**meeting レスポンス構造:**

```json
{
  "numberOfRecords": 1,
  "numberOfReturn": 1,
  "startRecord": 1,
  "record": [
    {
      "issueID": "1151420_098_2",
      "session": 214,
      "nameOfHouse": "衆議院",
      "nameOfMeeting": "本会議",
      "issue": "第2号",
      "date": "2023-01-25",
      "meetingURL": "https://kokkai.ndl.go.jp/record/1151420_098_2",
      "pdfURL": "https://kokkai.ndl.go.jp/pdf/1151420_098_2",
      "speechRecord": [
        {
          "speechID": "1151420_098_2_00001",
          "speechOrder": 1,
          "speaker": "大島理森",
          "speakerYomi": "おおしまただもり",
          "speakerGroup": "",
          "speakerPosition": "議長",
          "speakerRole": "",
          "speech": "これより会議を開きます。",
          "startPage": 1,
          "speechURL": "https://kokkai.ndl.go.jp/record/1151420_098_2_00001"
        }
      ]
    }
  ]
}
```

**source_id 設計:**
- search 結果の `source_id` = `speechID`（発言単位、ユニーク）
- `getRecord` は `source_id`（speechID）から `issueID` を抽出して meeting エンドポイントを叩く
- `issueID` の抽出: `speechID.split("_").slice(0, -1).join("_")` で最後のセグメントを除去

---

## Task 1: SourceName と sourceSchema に新 source を追加

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/schemas.ts`

- [ ] **Step 1: `src/lib/types.ts` の `SourceName` に追加**

```typescript
export type SourceName =
  | "ndl_search"
  | "ndl_catalog"
  | "ndl_digital"
  | "ndl_articles"
  | "ndl_articles_online"
  | "irdb"
  | "jstage_articles"
  | "japan_search"
  | "cinii_articles"
  | "cinii_books"
  | "kokkai_minutes"
  | "teikoku_minutes";
```

- [ ] **Step 2: `src/lib/schemas.ts` の `sourceSchema` に追加**

```typescript
export const sourceSchema = z.enum([
  "ndl_search",
  "ndl_catalog",
  "ndl_digital",
  "ndl_articles",
  "ndl_articles_online",
  "irdb",
  "jstage_articles",
  "japan_search",
  "cinii_articles",
  "cinii_books",
  "kokkai_minutes",
  "teikoku_minutes"
]);
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
cd ndl-jp-lit-mcp && npm run build
```

Expected: エラーなし

- [ ] **Step 4: commit**

```bash
git add src/lib/types.ts src/lib/schemas.ts
git commit -m "feat: add kokkai_minutes and teikoku_minutes to SourceName and sourceSchema"
```

---

## Task 2: fixture ファイルを作成

**Files:**
- Create: `tests/fixtures/kokkai/speech-response.json`
- Create: `tests/fixtures/kokkai/meeting-response.json`

- [ ] **Step 1: speech fixture を作成**

`tests/fixtures/kokkai/speech-response.json`:

```json
{
  "numberOfRecords": 15842,
  "numberOfReturn": 2,
  "startRecord": 1,
  "nextRecordPosition": 3,
  "record": [
    {
      "speechID": "1151420_098_2_00026",
      "issueID": "1151420_098_2",
      "session": 214,
      "nameOfHouse": "衆議院",
      "nameOfMeeting": "本会議",
      "issue": "第2号",
      "date": "2023-01-25",
      "speechOrder": 26,
      "speaker": "岸田文雄",
      "speakerYomi": "きしだふみお",
      "speakerGroup": "自由民主党",
      "speakerPosition": "内閣総理大臣",
      "speakerRole": "",
      "speech": "ただいま議題となりました法律案について、その趣旨を御説明申し上げます。",
      "startPage": 5,
      "speechURL": "https://kokkai.ndl.go.jp/record/1151420_098_2_00026",
      "meetingURL": "https://kokkai.ndl.go.jp/record/1151420_098_2",
      "pdfURL": "https://kokkai.ndl.go.jp/pdf/1151420_098_2"
    },
    {
      "speechID": "1151420_098_2_00027",
      "issueID": "1151420_098_2",
      "session": 214,
      "nameOfHouse": "衆議院",
      "nameOfMeeting": "本会議",
      "issue": "第2号",
      "date": "2023-01-25",
      "speechOrder": 27,
      "speaker": "枝野幸男",
      "speakerYomi": "えだのゆきお",
      "speakerGroup": "立憲民主党",
      "speakerPosition": "",
      "speakerRole": "",
      "speech": "ただいまの提案理由の説明は聴取いたしました。",
      "startPage": 6,
      "speechURL": "https://kokkai.ndl.go.jp/record/1151420_098_2_00027",
      "meetingURL": "https://kokkai.ndl.go.jp/record/1151420_098_2",
      "pdfURL": "https://kokkai.ndl.go.jp/pdf/1151420_098_2"
    }
  ]
}
```

- [ ] **Step 2: meeting fixture を作成**

`tests/fixtures/kokkai/meeting-response.json`:

```json
{
  "numberOfRecords": 1,
  "numberOfReturn": 1,
  "startRecord": 1,
  "record": [
    {
      "issueID": "1151420_098_2",
      "session": 214,
      "nameOfHouse": "衆議院",
      "nameOfMeeting": "本会議",
      "issue": "第2号",
      "date": "2023-01-25",
      "meetingURL": "https://kokkai.ndl.go.jp/record/1151420_098_2",
      "pdfURL": "https://kokkai.ndl.go.jp/pdf/1151420_098_2",
      "speechRecord": [
        {
          "speechID": "1151420_098_2_00001",
          "speechOrder": 1,
          "speaker": "大島理森",
          "speakerYomi": "おおしまただもり",
          "speakerGroup": "",
          "speakerPosition": "議長",
          "speakerRole": "",
          "speech": "これより会議を開きます。",
          "startPage": 1,
          "speechURL": "https://kokkai.ndl.go.jp/record/1151420_098_2_00001"
        },
        {
          "speechID": "1151420_098_2_00026",
          "speechOrder": 26,
          "speaker": "岸田文雄",
          "speakerYomi": "きしだふみお",
          "speakerGroup": "自由民主党",
          "speakerPosition": "内閣総理大臣",
          "speakerRole": "",
          "speech": "ただいま議題となりました法律案について、その趣旨を御説明申し上げます。",
          "startPage": 5,
          "speechURL": "https://kokkai.ndl.go.jp/record/1151420_098_2_00026"
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: commit**

```bash
git add tests/fixtures/kokkai/
git commit -m "test: add kokkai API fixture files"
```

---

## Task 3: mapSearch を実装（TDD）

**Files:**
- Create: `src/sources/kokkai/mapSearch.ts`
- Test: `tests/kokkai.adapter.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/kokkai.adapter.test.ts`:

```typescript
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

  it("speech JSON を SearchItem[] に正規化する（teikoku_minutes）", async () => {
    const json = readFixture("speech-response.json");
    const { mapKokkaiSearchResponse } = await import("../src/sources/kokkai/mapSearch.js");

    const result = mapKokkaiSearchResponse("teikoku_minutes", json);

    expect(result.items[0]?.source).toBe("teikoku_minutes");
  });

  it("speakerRole が空文字のときは null にする", async () => {
    const json = readFixture("speech-response.json");
    const { mapKokkaiSearchResponse } = await import("../src/sources/kokkai/mapSearch.js");

    const result = mapKokkaiSearchResponse("kokkai_minutes", json);

    expect(result.items[0]?.authors[0]?.role).toBe("内閣総理大臣");
    expect(result.items[1]?.authors[0]?.role).toBeNull();
  });

  it("summary は 500 字を超える発言を切り詰める", async () => {
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

    expect(result.items[0]?.summary?.length).toBeLessThanOrEqual(503);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd ndl-jp-lit-mcp && npx vitest run tests/kokkai.adapter.test.ts 2>&1 | head -30
```

Expected: `Cannot find module` エラー

- [ ] **Step 3: `mapSearch.ts` を実装**

`src/sources/kokkai/mapSearch.ts`:

```typescript
import { normalizeIssuedAt } from "../../lib/date.js";
import type { SearchItem, SourceName } from "../../lib/types.js";
import type { SearchResult } from "../types.js";

type KokkaiSpeechRecord = {
  speechID: string;
  issueID: string;
  session: number;
  nameOfHouse: string;
  nameOfMeeting: string;
  issue: string;
  date: string;
  speechOrder: number;
  speaker: string;
  speakerYomi: string;
  speakerGroup: string;
  speakerPosition: string;
  speakerRole: string;
  speech: string;
  startPage: number;
  speechURL: string;
  meetingURL: string;
  pdfURL: string;
};

type KokkaiSpeechResponse = {
  numberOfRecords: number;
  numberOfReturn: number;
  startRecord: number;
  nextRecordPosition?: number;
  record: KokkaiSpeechRecord[];
};

const SUMMARY_MAX = 500;

function truncate(text: string): string {
  if (text.length <= SUMMARY_MAX) return text;
  return text.slice(0, SUMMARY_MAX) + "…";
}

function toIssuedFields(date: string) {
  const info = normalizeIssuedAt(date);
  if (info.issuedAtPrecision === "unknown") {
    return { issued_at: null, issued_at_label: info.issuedAtLabel, issued_at_precision: "unknown" as const };
  }
  return { issued_at: info.issuedAt, issued_at_label: info.issuedAtLabel, issued_at_precision: info.issuedAtPrecision };
}

function buildTitle(r: KokkaiSpeechRecord): string {
  return `${r.speaker} — ${r.nameOfHouse}${r.nameOfMeeting} 第${r.session}回国会 ${r.issue}（${r.date}）`;
}

function mapSpeechRecord(source: SourceName, r: KokkaiSpeechRecord): SearchItem {
  const summary = truncate(r.speech ?? "");
  const role = r.speakerRole || r.speakerPosition || null;

  return {
    source,
    source_id: r.speechID,
    title: buildTitle(r),
    subtitle: summary || null,
    title_reading: r.speakerYomi || null,
    authors: [{ name: r.speaker, role }],
    publisher: "国立国会図書館",
    journal_title: `${r.nameOfHouse}${r.nameOfMeeting}`,
    ...toIssuedFields(r.date),
    summary: summary || null,
    url: r.speechURL,
    availability: { online: true, digital_collection: false },
    material_type: "parliamentary_record",
    subjects: r.speakerGroup ? [r.speakerGroup] : [],
    duplicate_key: r.issueID,
    duplicate_count: 1,
    related_records: []
  };
}

export function mapKokkaiSearchResponse(source: SourceName, json: string): SearchResult {
  const data: KokkaiSpeechResponse = JSON.parse(json);
  const records = Array.isArray(data.record) ? data.record : [];

  return {
    total: data.numberOfRecords ?? records.length,
    items: records.map((r) => mapSpeechRecord(source, r))
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
cd ndl-jp-lit-mcp && npx vitest run tests/kokkai.adapter.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: 全テスト PASS

- [ ] **Step 5: commit**

```bash
git add src/sources/kokkai/mapSearch.ts tests/kokkai.adapter.test.ts
git commit -m "feat: implement kokkai mapSearch (speech JSON → SearchItem)"
```

---

## Task 4: mapRecord を実装（TDD）

**Files:**
- Create: `src/sources/kokkai/mapRecord.ts`
- Test: `tests/kokkai.adapter.test.ts`（追記）

- [ ] **Step 1: failing test を追記**

`tests/kokkai.adapter.test.ts` に追記:

```typescript
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
    expect(record.source_metadata).toMatchObject({
      issue_id: "1151420_098_2",
      session: 214,
      name_of_house: "衆議院",
      name_of_meeting: "本会議",
      issue: "第2号",
      pdf_url: "https://kokkai.ndl.go.jp/pdf/1151420_098_2",
      speech_count: 2
    });
    expect(Array.isArray(record.source_metadata.speeches)).toBe(true);
    expect((record.source_metadata.speeches as unknown[]).length).toBe(2);
  });

  it("meeting が見つからない（record 空）場合は null を返す", async () => {
    const json = JSON.stringify({ numberOfRecords: 0, numberOfReturn: 0, startRecord: 1, record: [] });
    const { mapKokkaiMeetingResponse } = await import("../src/sources/kokkai/mapRecord.js");

    const record = mapKokkaiMeetingResponse("kokkai_minutes", "missing_id", json);

    expect(record).toBeNull();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd ndl-jp-lit-mcp && npx vitest run tests/kokkai.adapter.test.ts 2>&1 | grep -E "✓|✗|FAIL" | head -20
```

Expected: mapKokkaiMeetingResponse の describe が FAIL

- [ ] **Step 3: `mapRecord.ts` を実装**

`src/sources/kokkai/mapRecord.ts`:

```typescript
import { normalizeIssuedAt } from "../../lib/date.js";
import type { RecordItem, SourceName } from "../../lib/types.js";

type KokkaiSpeechInMeeting = {
  speechID: string;
  speechOrder: number;
  speaker: string;
  speakerYomi?: string;
  speakerGroup?: string;
  speakerPosition?: string;
  speakerRole?: string;
  speech: string;
  startPage?: number;
  speechURL?: string;
};

type KokkaiMeetingRecord = {
  issueID: string;
  session: number;
  nameOfHouse: string;
  nameOfMeeting: string;
  issue: string;
  date: string;
  meetingURL: string;
  pdfURL: string;
  speechRecord: KokkaiSpeechInMeeting[];
};

type KokkaiMeetingResponse = {
  numberOfRecords: number;
  record: KokkaiMeetingRecord[];
};

function toIssuedFields(date: string) {
  const info = normalizeIssuedAt(date);
  if (info.issuedAtPrecision === "unknown") {
    return { issued_at: null, issued_at_label: info.issuedAtLabel, issued_at_precision: "unknown" as const };
  }
  return { issued_at: info.issuedAt, issued_at_label: info.issuedAtLabel, issued_at_precision: info.issuedAtPrecision };
}

export function mapKokkaiMeetingResponse(
  source: SourceName,
  sourceId: string,
  json: string
): RecordItem | null {
  const data: KokkaiMeetingResponse = JSON.parse(json);
  const meeting = data.record?.[0];

  if (!meeting) return null;

  const title = `${meeting.nameOfHouse}${meeting.nameOfMeeting} 第${meeting.session}回国会 ${meeting.issue}（${meeting.date}）`;
  const speeches = Array.isArray(meeting.speechRecord) ? meeting.speechRecord : [];

  return {
    source,
    source_id: sourceId,
    title,
    subtitle: null,
    title_reading: null,
    authors: [],
    publisher: "国立国会図書館",
    journal_title: `${meeting.nameOfHouse}${meeting.nameOfMeeting}`,
    ...toIssuedFields(meeting.date),
    summary: null,
    url: meeting.meetingURL,
    availability: { online: true, digital_collection: false },
    alternative_titles: [`第${meeting.session}回国会${meeting.nameOfHouse}${meeting.nameOfMeeting}${meeting.issue}`],
    publication_place: "日本",
    language: "ja",
    material_type: "parliamentary_record",
    extent: null,
    subjects: [],
    identifiers: {
      issue_id: meeting.issueID,
      session: meeting.session
    },
    table_of_contents: [],
    content_access: {
      has_page_images: true,
      has_text_coordinates: false,
      viewer_url: meeting.meetingURL,
      access_note: null
    },
    source_metadata: {
      issue_id: meeting.issueID,
      session: meeting.session,
      name_of_house: meeting.nameOfHouse,
      name_of_meeting: meeting.nameOfMeeting,
      issue: meeting.issue,
      pdf_url: meeting.pdfURL,
      speech_count: speeches.length,
      speeches: speeches.map((s) => ({
        speech_id: s.speechID,
        speech_order: s.speechOrder,
        speaker: s.speaker,
        speaker_yomi: s.speakerYomi ?? null,
        speaker_group: s.speakerGroup ?? null,
        speaker_position: s.speakerPosition ?? null,
        speaker_role: s.speakerRole ?? null,
        speech: s.speech,
        start_page: s.startPage ?? null,
        speech_url: s.speechURL ?? null
      }))
    },
    raw: { meeting }
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
cd ndl-jp-lit-mcp && npx vitest run tests/kokkai.adapter.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: 全テスト PASS

- [ ] **Step 5: commit**

```bash
git add src/sources/kokkai/mapRecord.ts tests/kokkai.adapter.test.ts
git commit -m "feat: implement kokkai mapRecord (meeting JSON → RecordItem)"
```

---

## Task 5: adapter を実装（TDD）

**Files:**
- Create: `src/sources/kokkai/adapter.ts`
- Test: `tests/kokkai.adapter.test.ts`（追記）

- [ ] **Step 1: failing test を追記**

`tests/kokkai.adapter.test.ts` に追記:

```typescript
describe("createKokkaiAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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

  it("page=2 のとき startRecord を正しく計算する", async () => {
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

  it("getRecord は meeting エンドポイントを叩き RecordItem を返す", async () => {
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
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd ndl-jp-lit-mcp && npx vitest run tests/kokkai.adapter.test.ts 2>&1 | grep -E "FAIL|Cannot find" | head -10
```

Expected: `Cannot find module` エラー

- [ ] **Step 3: `adapter.ts` を実装**

`src/sources/kokkai/adapter.ts`:

```typescript
import { fetchText } from "../../lib/http.js";
import type { SourceAdapter } from "../types.js";
import { mapKokkaiMeetingResponse } from "./mapRecord.js";
import { mapKokkaiSearchResponse } from "./mapSearch.js";

const KOKKAI_SPEECH_URL = "https://kokkai.ndl.go.jp/api/speech";
const KOKKAI_MEETING_URL = "https://kokkai.ndl.go.jp/api/meeting";
const TEIKOKU_SPEECH_URL = "https://teikokugikai-i.ndl.go.jp/api/emp/speech";
const TEIKOKU_MEETING_URL = "https://teikokugikai-i.ndl.go.jp/api/emp/meeting";

interface KokkaiAdapterOptions {
  speechBaseUrl?: string;
  meetingBaseUrl?: string;
}

function extractIssueId(speechId: string): string {
  const parts = speechId.split("_");
  return parts.slice(0, -1).join("_");
}

function createAdapter(
  sourceName: "kokkai_minutes" | "teikoku_minutes",
  defaultSpeechUrl: string,
  defaultMeetingUrl: string,
  options: KokkaiAdapterOptions = {}
): SourceAdapter {
  const speechBaseUrl = options.speechBaseUrl ?? defaultSpeechUrl;
  const meetingBaseUrl = options.meetingBaseUrl ?? defaultMeetingUrl;

  return {
    source: sourceName,
    async search({ query, limit, page }) {
      const url = new URL(speechBaseUrl);
      url.searchParams.set("any", query);
      url.searchParams.set("maximumRecords", String(limit));
      url.searchParams.set("startRecord", String((page - 1) * limit + 1));
      url.searchParams.set("recordPacking", "json");

      const payload = await fetchText(url.toString());
      return mapKokkaiSearchResponse(sourceName, payload.text);
    },
    async getRecord(sourceId) {
      const issueId = extractIssueId(sourceId);
      const url = new URL(meetingBaseUrl);
      url.searchParams.set("issueID", issueId);
      url.searchParams.set("recordPacking", "json");

      const payload = await fetchText(url.toString());
      return mapKokkaiMeetingResponse(sourceName, sourceId, payload.text);
    }
  };
}

export function createKokkaiAdapter(options: KokkaiAdapterOptions = {}): SourceAdapter {
  return createAdapter("kokkai_minutes", KOKKAI_SPEECH_URL, KOKKAI_MEETING_URL, options);
}

export function createTeikokuAdapter(options: KokkaiAdapterOptions = {}): SourceAdapter {
  return createAdapter("teikoku_minutes", TEIKOKU_SPEECH_URL, TEIKOKU_MEETING_URL, options);
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
cd ndl-jp-lit-mcp && npx vitest run tests/kokkai.adapter.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗|PASS|FAIL"
```

Expected: 全テスト PASS

- [ ] **Step 5: commit**

```bash
git add src/sources/kokkai/adapter.ts tests/kokkai.adapter.test.ts
git commit -m "feat: implement kokkai/teikoku adapter"
```

---

## Task 6: server.ts に登録

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: import と ServerEnv に追加**

`src/server.ts` の import セクションに追加:

```typescript
import { createKokkaiAdapter, createTeikokuAdapter } from "./sources/kokkai/adapter.js";
```

`ServerEnv` 型に追加:

```typescript
interface ServerEnv {
  // ... 既存
  KOKKAI_SPEECH_BASE_URL?: string;
  KOKKAI_MEETING_BASE_URL?: string;
  TEIKOKU_SPEECH_BASE_URL?: string;
  TEIKOKU_MEETING_BASE_URL?: string;
}
```

- [ ] **Step 2: `resolveAdapterOptionsFromEnv` に追加**

`resolveAdapterOptionsFromEnv` の return オブジェクトに追加:

```typescript
kokkai: {
  ...(env.KOKKAI_SPEECH_BASE_URL ? { speechBaseUrl: env.KOKKAI_SPEECH_BASE_URL } : {}),
  ...(env.KOKKAI_MEETING_BASE_URL ? { meetingBaseUrl: env.KOKKAI_MEETING_BASE_URL } : {})
},
teikoku: {
  ...(env.TEIKOKU_SPEECH_BASE_URL ? { speechBaseUrl: env.TEIKOKU_SPEECH_BASE_URL } : {}),
  ...(env.TEIKOKU_MEETING_BASE_URL ? { meetingBaseUrl: env.TEIKOKU_MEETING_BASE_URL } : {})
}
```

- [ ] **Step 3: `createServer` の adapters 配列に追加**

```typescript
const adapters = [
  // ... 既存
  createKokkaiAdapter(adapterOptions.kokkai),
  createTeikokuAdapter(adapterOptions.teikoku)
];
```

- [ ] **Step 4: ビルドが通ることを確認**

```bash
cd ndl-jp-lit-mcp && npm run build
```

Expected: エラーなし

- [ ] **Step 5: 全テストが通ることを確認**

```bash
cd ndl-jp-lit-mcp && npm test 2>&1 | tail -5
```

Expected: `192 + N tests passed`（新テスト分増加）

- [ ] **Step 6: smoke check**

```bash
cd ndl-jp-lit-mcp && npm run smoke:mcp
```

Expected: PASS

- [ ] **Step 7: commit**

```bash
git add src/server.ts
git commit -m "feat: register kokkai_minutes and teikoku_minutes adapters in server"
```

---

## Task 7: README を更新

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 対応 source テーブルに追加**

`README.md` の対応 source テーブルに追加:

```markdown
| `kokkai_minutes` | 国会会議録（第1回国会〜現在） | |
| `teikoku_minutes` | 帝国議会会議録（第1回〜第90回） | |
```

- [ ] **Step 2: 実装状況セクションに追記**

既存の実装状況セクションに追記:

```markdown
- `kokkai_minutes` / `teikoku_minutes` を追加
  - 検索: 国会会議録 API / 帝国議会会議録 API の speech エンドポイント（発言単位）
  - 詳細: meeting エンドポイント（会議全体）
  - 既定横断検索には含めない
```

- [ ] **Step 3: 拡張ロードマップの Phase 2 を完了に更新**

```markdown
| Phase 2 | `kokkai_minutes` / `teikoku_minutes` | 国会・帝国議会会議録 | ✅ 完了 |
```

- [ ] **Step 4: 環境変数テーブルに追記**

```markdown
| `KOKKAI_SPEECH_BASE_URL` | `https://kokkai.ndl.go.jp/api/speech` | kokkai_minutes 検索 URL |
| `KOKKAI_MEETING_BASE_URL` | `https://kokkai.ndl.go.jp/api/meeting` | kokkai_minutes 詳細 URL |
| `TEIKOKU_SPEECH_BASE_URL` | `https://teikokugikai-i.ndl.go.jp/api/emp/speech` | teikoku_minutes 検索 URL |
| `TEIKOKU_MEETING_BASE_URL` | `https://teikokugikai-i.ndl.go.jp/api/emp/meeting` | teikoku_minutes 詳細 URL |
```

- [ ] **Step 5: commit**

```bash
git add README.md
git commit -m "docs: document kokkai_minutes and teikoku_minutes sources"
```
