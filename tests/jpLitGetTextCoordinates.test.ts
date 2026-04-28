import { describe, expect, it, vi } from "vitest";
import { createJpLitGetTextCoordinatesTool } from "../src/tools/jpLitGetTextCoordinates.js";

function makeRecordService(record: unknown) {
  return {
    getRecord: vi.fn().mockResolvedValue(record)
  } as ReturnType<typeof import("../src/services/recordService.js").createRecordService>;
}

function makeNextDlClient(pageResult: unknown) {
  return {
    getBook: vi.fn(),
    getPage: vi.fn().mockResolvedValue(pageResult),
    getFulltextJson: vi.fn()
  };
}

const BASE_RECORD = {
  source: "ndl_digital",
  source_id: "R100000039-I1000732",
  title: "国立国会図書館年報",
  source_metadata: {
    next_digital_library: {
      pid: "1000732",
      available: true,
      reason: null,
      book_api_url: "https://lab.ndl.go.jp/dl/api/book/1000732"
    }
  }
};

describe("jp_lit_get_text_coordinates", () => {
  it("正常系: ページ OCR と座標を返す", async () => {
    const pagePayload = {
      id: "1000732_1",
      contents: [{ text: "国立" }],
      coordjson: [{ x: 10, y: 20 }]
    };
    const tool = createJpLitGetTextCoordinatesTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(pagePayload)
    );

    const result = await tool({ source: "ndl_digital", source_id: "R100000039-I1000732", page: 1 });

    expect(result.structuredContent).toEqual({
      pid: "1000732",
      page: 1,
      page_image_url: "https://dl.ndl.go.jp/api/iiif/1000732/R0000001/full/full/0/default.jpg",
      contents: [{ text: "国立" }],
      coordjson: [{ x: 10, y: 20 }],
      raw: pagePayload
    });
  });

  it("ndl_digital 以外は InvalidRequestError を投げる", async () => {
    const tool = createJpLitGetTextCoordinatesTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(null)
    );

    await expect(
      tool({ source: "cinii_articles", source_id: "x", page: 1 })
    ).rejects.toMatchObject({ name: "InvalidRequestError" });
  });

  it("next_digital_library が null なら NotFoundError を投げる", async () => {
    const record = { ...BASE_RECORD, source_metadata: { next_digital_library: null } };
    const tool = createJpLitGetTextCoordinatesTool(
      makeRecordService(record),
      makeNextDlClient(null)
    );

    await expect(
      tool({ source: "ndl_digital", source_id: "R100000039-I1000732", page: 1 })
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("Page API が null を返したら NotFoundError を投げる", async () => {
    const tool = createJpLitGetTextCoordinatesTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(null)
    );

    await expect(
      tool({ source: "ndl_digital", source_id: "R100000039-I1000732", page: 9999 })
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });
});
