import { describe, expect, it } from "vitest";

import {
  recordsInputSchema,
  recordsOutputSchema
} from "../src/lib/schemas.js";
import type { RecordItem } from "../src/lib/types.js";

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

  it("成功 item の cache と count invariants を必須にする", () => {
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
        unique_count: 2
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
});
