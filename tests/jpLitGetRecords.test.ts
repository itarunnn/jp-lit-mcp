import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvalidRequestError } from "../src/lib/errors.js";
import {
  UnsupportedPayloadError,
  UpstreamHttpError,
  UpstreamTimeoutError
} from "../src/lib/http.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import {
  recordsInputSchema,
  recordsOutputSchema
} from "../src/lib/schemas.js";
import type { RecordItem } from "../src/lib/types.js";
import { createRecordService } from "../src/services/recordService.js";
import type { SourceAdapter } from "../src/sources/types.js";
import { createJpLitGetRecordTool } from "../src/tools/jpLitGetRecord.js";
import { createJpLitGetRecordsTool } from "../src/tools/jpLitGetRecords.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-records-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      rm(dir, { recursive: true, force: true })
    )
  );
});

function createRecordItem(sourceId: string): RecordItem {
  return {
    source: "ndl_digital",
    source_id: sourceId,
    title: "吾輩は猫である",
    subtitle: null,
    title_reading: null,
    authors: [],
    publisher: null,
    journal_title: null,
    issued_at: "1905",
    issued_at_label: "1905",
    issued_at_precision: "year",
    summary: null,
    url: null,
    availability: {
      online: true,
      digital_collection: true
    },
    alternative_titles: [],
    publication_place: null,
    language: "jpn",
    material_type: "book",
    extent: null,
    subjects: [],
    identifiers: {},
    table_of_contents: [],
    content_access: {
      has_page_images: true,
      has_text_coordinates: false,
      viewer_url: null,
      access_note: null
    },
    source_metadata: {},
    raw: {}
  };
}

function createValidErrorBatchOutput() {
  return {
    source: "ndl_digital" as const,
    requested_count: 2,
    unique_count: 2,
    success_count: 0,
    error_count: 2,
    items: [
      {
        source_id: "R100000039-I1000732",
        status: "error" as const,
        error: {
          category: "not_found" as const,
          message: "該当レコードが見つかりませんでした。"
        }
      },
      {
        source_id: "R100000039-I1000733",
        status: "error" as const,
        error: {
          category: "timeout" as const,
          message: "上流 source の応答がタイムアウトしました。"
        }
      }
    ]
  };
}

async function createBatchHarness(
  implementation: (sourceId: string) => Promise<RecordItem | null>
) {
  const baseDir = await createTempDir();
  const cache = createFileCache(baseDir);
  const sessions = createSessionStore(baseDir);
  const getRecord = vi.fn(implementation);
  const adapter: SourceAdapter = {
    source: "ndl_digital",
    search: async () => ({ total: 0, items: [] }),
    getRecord
  };
  const service = createRecordService([adapter]);

  return {
    cache,
    sessions,
    service,
    getRecord,
    tool: createJpLitGetRecordsTool(service, cache, sessions),
    singleTool: createJpLitGetRecordTool(service, cache, sessions)
  };
}

describe("jp_lit_get_records schemas", () => {
  it("同一 source の1〜10件と force_refresh を受け付ける", () => {
    expect(
      recordsInputSchema.parse({
        source: "ndl_digital",
        source_ids: [" A ", "B"]
      })
    ).toEqual({
      source: "ndl_digital",
      source_ids: ["A", "B"],
      force_refresh: false
    });
  });

  it("空配列、空ID、11件を拒否する", () => {
    expect(
      recordsInputSchema.safeParse({
        source: "ndl_digital",
        source_ids: []
      }).success
    ).toBe(false);
    expect(
      recordsInputSchema.safeParse({
        source: "ndl_digital",
        source_ids: [" "]
      }).success
    ).toBe(false);
    expect(
      recordsInputSchema.safeParse({
        source: "ndl_digital",
        source_ids: Array.from({ length: 11 }, (_, index) => String(index))
      }).success
    ).toBe(false);
  });

  it("成功・失敗を同じ ordered items として検証する", () => {
    const parsed = recordsOutputSchema.parse({
      source: "ndl_digital",
      requested_count: 2,
      unique_count: 2,
      success_count: 0,
      error_count: 2,
      items: [
        {
          source_id: "A",
          status: "error",
          error: {
            category: "not_found",
            message: "該当レコードが見つかりませんでした。"
          }
        },
        {
          source_id: "B",
          status: "error",
          error: {
            category: "timeout",
            message: "上流 source の応答がタイムアウトしました。"
          }
        }
      ]
    });

    expect(parsed.items.map((item) => item.source_id)).toEqual(["A", "B"]);
  });

  it("成功 item の cache を必須にする", () => {
    const valid = {
      source: "ndl_digital" as const,
      requested_count: 1,
      unique_count: 1,
      success_count: 1,
      error_count: 0,
      items: [
        {
          source_id: "R100000039-I1000732",
          status: "ok" as const,
          record: {
            ...createRecordItem("R100000039-I1000732"),
            cache: {
              hit: false,
              cache_key: `sha256-${"a".repeat(64)}`,
              saved_at: "2026-07-30T00:00:00.000Z",
              refresh_hint: null
            }
          }
        }
      ]
    };

    expect(recordsOutputSchema.safeParse(valid).success).toBe(true);
    expect(
      recordsOutputSchema.safeParse({
        ...valid,
        success_count: 0,
        error_count: 1
      }).success
    ).toBe(false);
    expect(
      recordsOutputSchema.safeParse({
        ...valid,
        items: [
          {
            ...valid.items[0],
            record: createRecordItem("R100000039-I1000732")
          }
        ]
      }).success
    ).toBe(false);
  });

  it("重複 item だけの mutation を拒否する", () => {
    const valid = createValidErrorBatchOutput();
    const duplicateItemResult = recordsOutputSchema.safeParse({
      ...valid,
      items: [
        valid.items[0],
        {
          ...valid.items[1],
          source_id: valid.items[0].source_id
        }
      ]
    });

    expect(recordsOutputSchema.safeParse(valid).success).toBe(true);
    expect(duplicateItemResult.success).toBe(false);
    if (!duplicateItemResult.success) {
      expect(duplicateItemResult.error.issues.map((issue) => issue.message)).toContain(
        "batch record items must contain unique source_ids"
      );
    }
  });

  it("requested_count が unique_count 未満になる mutation を拒否する", () => {
    const valid = createValidErrorBatchOutput();
    const requestedCountResult = recordsOutputSchema.safeParse({
      ...valid,
      requested_count: 1
    });

    expect(recordsOutputSchema.safeParse(valid).success).toBe(true);
    expect(requestedCountResult.success).toBe(false);
    if (!requestedCountResult.success) {
      expect(requestedCountResult.error.issues.map((issue) => issue.message)).toContain(
        "batch record requested_count must cover unique_count"
      );
    }
  });

  it("items.length だけを変更した mutation を拒否する", () => {
    const valid = createValidErrorBatchOutput();
    const itemsLengthResult = recordsOutputSchema.safeParse({
      ...valid,
      items: valid.items.slice(0, 1)
    });

    expect(recordsOutputSchema.safeParse(valid).success).toBe(true);
    expect(itemsLengthResult.success).toBe(false);
    if (!itemsLengthResult.success) {
      expect(itemsLengthResult.error.issues.map((issue) => issue.message)).toContain(
        "batch record items.length must equal unique_count"
      );
    }
  });
});

describe("jp_lit_get_records tool", () => {
  it("重複を除いた入力順で成功と部分失敗を返す", async () => {
    const { tool, getRecord } = await createBatchHarness(async (sourceId) => {
      if (sourceId === "R100000039-I9999999") {
        return null;
      }
      return createRecordItem(sourceId);
    });

    const result = await tool({
      source: "ndl_digital",
      source_ids: [
        " R100000039-I1000732 ",
        "R100000039-I9999999",
        "R100000039-I1000732",
        "R100000039-I1000733"
      ]
    });

    expect(result.structuredContent).toMatchObject({
      source: "ndl_digital",
      requested_count: 4,
      unique_count: 3,
      success_count: 2,
      error_count: 1
    });
    expect(result.structuredContent.items.map((item) => item.source_id)).toEqual([
      "R100000039-I1000732",
      "R100000039-I9999999",
      "R100000039-I1000733"
    ]);
    expect(result.structuredContent.items[1]).toMatchObject({
      source_id: "R100000039-I9999999",
      status: "error",
      error: {
        category: "not_found",
        message: "該当レコードが見つかりませんでした。"
      }
    });
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify(result.structuredContent, null, 2)
      }
    ]);
    expect(getRecord).toHaveBeenCalledTimes(3);
  });

  it("既知の個別失敗を固定 category と安全な message に変換しretryしない", async () => {
    const cases = new Map<
      string,
      RecordItem | null | Error
    >([
      ["R100000039-I1000732", createRecordItem("R100000039-I1000732")],
      ["R100000039-I1000733", null],
      ["R100000039-I1000734", new UpstreamTimeoutError(123)],
      [
        "R100000039-I1000735",
        new UpstreamHttpError(503, "Sensitive upstream")
      ],
      [
        "R100000039-I1000736",
        new UnsupportedPayloadError("raw payload details")
      ]
    ]);
    const { tool, getRecord } = await createBatchHarness(async (sourceId) => {
      const value = cases.get(sourceId);
      if (value instanceof Error) {
        throw value;
      }
      return value ?? null;
    });

    const result = await tool({
      source: "ndl_digital",
      source_ids: Array.from(cases.keys())
    });

    expect(result.structuredContent.items).toEqual([
      expect.objectContaining({
        source_id: "R100000039-I1000732",
        status: "ok",
        record: expect.objectContaining({
          source_id: "R100000039-I1000732"
        })
      }),
      {
        source_id: "R100000039-I1000733",
        status: "error",
        error: {
          category: "not_found",
          message: "該当レコードが見つかりませんでした。"
        }
      },
      {
        source_id: "R100000039-I1000734",
        status: "error",
        error: {
          category: "timeout",
          message: "上流 source の応答がタイムアウトしました。"
        }
      },
      {
        source_id: "R100000039-I1000735",
        status: "error",
        error: {
          category: "http",
          message: "上流 source へのリクエストに失敗しました。"
        }
      },
      {
        source_id: "R100000039-I1000736",
        status: "error",
        error: {
          category: "invalid_payload",
          message: "上流 source の応答形式を処理できませんでした。"
        }
      }
    ]);
    expect(result.structuredContent).toMatchObject({
      success_count: 1,
      error_count: 4
    });
    for (const sourceId of cases.keys()) {
      expect(
        getRecord.mock.calls.filter(([calledSourceId]) => calledSourceId === sourceId)
      ).toHaveLength(1);
    }
  });

  it("実際に不正な source_id だけを invalid_request に変換する", async () => {
    const { tool, getRecord } = await createBatchHarness(async (sourceId) =>
      createRecordItem(sourceId)
    );

    const result = await tool({
      source: "ndl_digital",
      source_ids: ["not a valid source id"]
    });

    expect(result.structuredContent.items).toEqual([
      {
        source_id: "not a valid source id",
        status: "error",
        error: {
          category: "invalid_request",
          message: "source_id をこの source の詳細取得に利用できません。"
        }
      }
    ]);
    expect(getRecord).not.toHaveBeenCalled();
  });

  it("adapter/cache/config相当の通常InvalidRequestErrorを安全なunknownにする", async () => {
    const { tool } = await createBatchHarness(async () => {
      throw new InvalidRequestError("raw systemic invalid request details");
    });

    const result = await tool({
      source: "ndl_digital",
      source_ids: ["R100000039-I1000732"]
    });

    expect(result.structuredContent.items).toEqual([
      {
        source_id: "R100000039-I1000732",
        status: "error",
        error: {
          category: "unknown",
          message: "レコード詳細の取得中に予期しないエラーが発生しました。"
        }
      }
    ]);
    expect(JSON.stringify(result.structuredContent)).not.toContain(
      "raw systemic invalid request details"
    );
    expect(JSON.stringify(result.structuredContent)).not.toContain(
      "source_id をこの source"
    );
  });

  it("通常のunknown errorを安全なunknownにする", async () => {
    const { tool } = await createBatchHarness(async () => {
      throw new Error("secret unexpected details");
    });

    const result = await tool({
      source: "ndl_digital",
      source_ids: ["R100000039-I1000732"]
    });

    expect(result.structuredContent.items).toEqual([
      {
        source_id: "R100000039-I1000732",
        status: "error",
        error: {
          category: "unknown",
          message: "レコード詳細の取得中に予期しないエラーが発生しました。"
        }
      }
    ]);
    expect(JSON.stringify(result.structuredContent)).not.toContain(
      "secret unexpected details"
    );
  });

  it("単件取得後の batch 取得が同じ cache を使う", async () => {
    const { singleTool, tool, getRecord } = await createBatchHarness(
      async (sourceId) => createRecordItem(sourceId)
    );

    const single = await singleTool({
      source: "ndl_digital",
      source_id: "R100000039-I1000732"
    });
    const batch = await tool({
      source: "ndl_digital",
      source_ids: ["R100000039-I1000732"]
    });

    expect(single.structuredContent.cache?.hit).toBe(false);
    expect(batch.structuredContent.items[0]).toMatchObject({
      status: "ok",
      record: {
        cache: {
          hit: true,
          cache_key: single.structuredContent.cache?.cache_key
        }
      }
    });
    expect(getRecord).toHaveBeenCalledTimes(1);
  });

  it("batch 取得後の単件取得が同じ cache を使う", async () => {
    const { singleTool, tool, getRecord } = await createBatchHarness(
      async (sourceId) => createRecordItem(sourceId)
    );

    const batch = await tool({
      source: "ndl_digital",
      source_ids: ["R100000039-I1000732"]
    });
    const single = await singleTool({
      source: "ndl_digital",
      source_id: "R100000039-I1000732"
    });

    expect(batch.structuredContent.items[0]).toMatchObject({
      status: "ok",
      record: {
        cache: {
          hit: false,
          cache_key: single.structuredContent.cache?.cache_key
        }
      }
    });
    expect(single.structuredContent.cache?.hit).toBe(true);
    expect(getRecord).toHaveBeenCalledTimes(1);
  });

  it("force_refresh=true では各一意 ID を再取得する", async () => {
    const { tool, getRecord } = await createBatchHarness(
      async (sourceId) => createRecordItem(sourceId)
    );
    const sourceIds = [
      "R100000039-I1000732",
      "R100000039-I1000733"
    ];

    await tool({
      source: "ndl_digital",
      source_ids: sourceIds
    });
    const refreshed = await tool({
      source: "ndl_digital",
      source_ids: [...sourceIds, sourceIds[0]],
      force_refresh: true
    });

    expect(refreshed.structuredContent).toMatchObject({
      requested_count: 3,
      unique_count: 2,
      success_count: 2
    });
    for (const item of refreshed.structuredContent.items) {
      expect(item).toMatchObject({
        status: "ok",
        record: {
          cache: {
            hit: false
          }
        }
      });
    }
    expect(getRecord).toHaveBeenCalledTimes(4);
  });

  it("詳細取得の同時実行数を2に固定する", async () => {
    let active = 0;
    let started = 0;
    let maxActive = 0;
    const releases: Array<() => void> = [];
    const { tool } = await createBatchHarness(async (sourceId) => {
      active += 1;
      started += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      return createRecordItem(sourceId);
    });

    const pending = tool({
      source: "ndl_digital",
      source_ids: [
        "R100000039-I1000732",
        "R100000039-I1000733",
        "R100000039-I1000734",
        "R100000039-I1000735"
      ]
    });

    await vi.waitFor(() => expect(started).toBe(2));
    expect(maxActive).toBe(2);
    releases.splice(0).forEach((release) => release());

    await vi.waitFor(() => expect(started).toBe(4));
    expect(maxActive).toBe(2);
    releases.splice(0).forEach((release) => release());

    await expect(pending).resolves.toMatchObject({
      structuredContent: {
        success_count: 4,
        error_count: 0
      }
    });
  });

  it("成功した一意 ID だけ単件 tool の session entry を残す", async () => {
    const { tool, sessions } = await createBatchHarness(async (sourceId) => {
      if (sourceId === "R100000039-I9999999") {
        return null;
      }
      return createRecordItem(sourceId);
    });

    await tool({
      source: "ndl_digital",
      source_ids: [
        "R100000039-I1000732",
        "R100000039-I9999999",
        "R100000039-I1000732",
        "R100000039-I1000733"
      ]
    });
    const session = await sessions.readCurrent();

    expect(session.entries).toHaveLength(2);
    expect(session.entries.map((entry) => entry.tool)).toEqual([
      "jp_lit_get_record",
      "jp_lit_get_record"
    ]);
    expect(session.entries.map((entry) => entry.input.source_id).sort()).toEqual([
      "R100000039-I1000732",
      "R100000039-I1000733"
    ]);
    expect(
      session.entries.some((entry) => entry.tool === "jp_lit_get_records")
    ).toBe(false);
  });
});
