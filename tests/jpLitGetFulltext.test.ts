import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitGetFulltextTool } from "../src/tools/jpLitGetFulltext.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-get-fulltext-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function makeRecordService(record: unknown) {
  return {
    getRecord: vi.fn().mockResolvedValue(record)
  } as ReturnType<typeof import("../src/services/recordService.js").createRecordService>;
}

function makeNextDlClient(fulltextResult: unknown) {
  return {
    getBook: vi.fn(),
    getPage: vi.fn(),
    getFulltextJson: vi.fn().mockResolvedValue(fulltextResult)
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

describe("jp_lit_get_fulltext", () => {
  it("正常系: list 形式 (実際の API) の全文 OCR JSON を返す", async () => {
    const baseDir = await createTempDir();
    const fulltextPayload = {
      list: [{ id: "1000732_1", page: 1, contents: "国立国会図書館" }],
      hit: 1,
      from: 0
    };
    const tool = createJpLitGetFulltextTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(fulltextPayload),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ source: "ndl_digital", source_id: "R100000039-I1000732" });

    expect(result.structuredContent).toMatchObject({
      pid: "1000732",
      pages: fulltextPayload.list,
      raw: fulltextPayload
    });
    expect(result.structuredContent.cache).toMatchObject({
      hit: false,
      saved_at: expect.any(String),
      refresh_hint: null
    });
  });

  it("正常系: pages 形式 (フォールバック) の全文 OCR JSON を返す", async () => {
    const baseDir = await createTempDir();
    const fulltextPayload = { id: "1000732", pages: [{ page: 1, text: "国立国会図書館" }] };
    const tool = createJpLitGetFulltextTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(fulltextPayload),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ source: "ndl_digital", source_id: "R100000039-I1000732" });

    expect(result.structuredContent).toMatchObject({
      pid: "1000732",
      pages: [{ page: 1, text: "国立国会図書館" }],
      raw: fulltextPayload
    });
    expect(result.structuredContent.cache).toMatchObject({
      hit: false,
      saved_at: expect.any(String),
      refresh_hint: null
    });
  });

  it("ndl_digital 以外は InvalidRequestError を投げる", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitGetFulltextTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(null),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(
      tool({ source: "cinii_articles", source_id: "x" })
    ).rejects.toMatchObject({ name: "InvalidRequestError" });
  });

  it("next_digital_library が null なら NotFoundError を投げる", async () => {
    const baseDir = await createTempDir();
    const record = { ...BASE_RECORD, source_metadata: { next_digital_library: null } };
    const tool = createJpLitGetFulltextTool(
      makeRecordService(record),
      makeNextDlClient(null),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(
      tool({ source: "ndl_digital", source_id: "R100000039-I1000732" })
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("fulltext API が null を返したら NotFoundError を投げる", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitGetFulltextTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(null),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(
      tool({ source: "ndl_digital", source_id: "R100000039-I1000732" })
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("pid に数字以外が含まれる場合は InvalidRequestError を投げる", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitGetFulltextTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(null),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(
      tool({ source: "ndl_digital", pid: "https://example.test/897115" })
    ).rejects.toMatchObject({ name: "InvalidRequestError" });
  });
});
