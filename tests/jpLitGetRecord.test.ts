import { describe, expect, it } from "vitest";

import { NotFoundError } from "../src/lib/errors.js";
import { recordInputSchema } from "../src/lib/schemas.js";
import type { RecordItem } from "../src/lib/types.js";
import { createRecordService } from "../src/services/recordService.js";
import type { SourceAdapter } from "../src/sources/types.js";
import { createJpLitGetRecordTool } from "../src/tools/jpLitGetRecord.js";

function createRecordItem(sourceId: string): RecordItem {
  return {
    source: "ndl_digital",
    source_id: sourceId,
    title: "吾輩は猫である",
    subtitle: null,
    authors: [],
    publisher: null,
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

describe("createRecordService", () => {
  it("record 入力スキーマで source と source_id を受け付ける", () => {
    const parsed = recordInputSchema.parse({
      source: "ndl_digital",
      source_id: "123"
    });

    expect(parsed).toEqual({
      source: "ndl_digital",
      source_id: "123"
    });
  });

  it("record 入力スキーマで空の source_id を拒否する", () => {
    const parsed = recordInputSchema.safeParse({
      source: "ndl_digital",
      source_id: ""
    });

    expect(parsed.success).toBe(false);
  });

  it("record 入力スキーマで cinii_research source を受け付ける", () => {
    const parsed = recordInputSchema.parse({
      source: "cinii_research",
      source_id: "1573387450265380480"
    });

    expect(parsed.source).toBe("cinii_research");
  });

  it("record 入力スキーマで cinii_articles / cinii_books source を受け付ける", () => {
    const articles = recordInputSchema.parse({
      source: "cinii_articles",
      source_id: "1573387450265380480"
    });
    const books = recordInputSchema.parse({
      source: "cinii_books",
      source_id: "1971993809689508364"
    });

    expect(articles.source).toBe("cinii_articles");
    expect(books.source).toBe("cinii_books");
  });

  it("record 入力スキーマで jstage_articles source を受け付ける", () => {
    const parsed = recordInputSchema.parse({
      source: "jstage_articles",
      source_id: "/article/example/_article/-char/ja/"
    });

    expect(parsed.source).toBe("jstage_articles");
  });

  it("record 入力スキーマで japan_search source を受け付ける", () => {
    const parsed = recordInputSchema.parse({
      source: "japan_search",
      source_id: "ukansai-R100000114_I000002469_00"
    });

    expect(parsed.source).toBe("japan_search");
  });

  it("record 入力スキーマで ndl_catalog / ndl_articles / ndl_articles_online source を受け付ける", () => {
    const catalog = recordInputSchema.parse({
      source: "ndl_catalog",
      source_id: "R100000002-I000000001"
    });
    const articles = recordInputSchema.parse({
      source: "ndl_articles",
      source_id: "R000000004-I000000001"
    });
    const articlesOnline = recordInputSchema.parse({
      source: "ndl_articles_online",
      source_id: "R000000004-I000000002"
    });

    expect(catalog.source).toBe("ndl_catalog");
    expect(articles.source).toBe("ndl_articles");
    expect(articlesOnline.source).toBe("ndl_articles_online");
  });

  it("source と source_id から詳細を返す", async () => {
    const adapter: SourceAdapter = {
      source: "ndl_digital",
      search: async () => ({ total: 0, items: [] }),
      getRecord: async (sourceId) => createRecordItem(sourceId)
    };
    const service = createRecordService([adapter]);

    const result = await service.getRecord({
      source: "ndl_digital",
      sourceId: "abc"
    });

    expect(result).toEqual(createRecordItem("abc"));
  });

  it("tool handler が source_id を sourceId に変換して structuredContent を返す", async () => {
    const adapter: SourceAdapter = {
      source: "ndl_digital",
      search: async () => ({ total: 0, items: [] }),
      getRecord: async (sourceId) => createRecordItem(sourceId)
    };
    const service = createRecordService([adapter]);
    const tool = createJpLitGetRecordTool(service);

    const result = await tool({
      source: "ndl_digital",
      source_id: "abc"
    });

    expect(result.structuredContent).toEqual(createRecordItem("abc"));
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify(result.structuredContent, null, 2)
      }
    ]);
  });

  it("未取得時は NotFoundError を投げる", async () => {
    const adapter: SourceAdapter = {
      source: "ndl_digital",
      search: async () => ({ total: 0, items: [] }),
      getRecord: async () => null
    };
    const service = createRecordService([adapter]);

    await expect(
      service.getRecord({
        source: "ndl_digital",
        sourceId: "missing"
      })
    ).rejects.toThrow(NotFoundError);
  });
});
