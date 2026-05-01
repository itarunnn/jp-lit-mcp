import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitSearchPagesTool } from "../src/tools/jpLitSearchPages.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-search-pages-"));
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

function makeNextDlClient(searchResult: unknown) {
  return {
    getBook: vi.fn(),
    getPage: vi.fn(),
    getFulltextJson: vi.fn(),
    searchPages: vi.fn().mockResolvedValue(searchResult)
  };
}

const BASE_RECORD = {
  source: "ndl_digital",
  source_id: "R100000002-I000000518610",
  title: "帝国図書館一覧",
  source_metadata: {
    next_digital_library: {
      pid: "897115",
      available: true,
      reason: null,
      book_api_url: "https://lab.ndl.go.jp/dl/api/book/897115"
    }
  }
};

const SEARCH_PAYLOAD = {
  list: [
    { id: "897115_5", page: 5, contents: "国立図書館の設置に関する", score: 2.5 },
    { id: "897115_12", page: 12, contents: "帝国図書館一覧表", score: 1.8 }
  ],
  hit: 2,
  from: 0
};

describe("jp_lit_search_pages", () => {
  it("正常系: 資料内キーワード検索結果を返す", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchPagesTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(SEARCH_PAYLOAD),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({
      source: "ndl_digital",
      source_id: "R100000002-I000000518610",
      keyword: "図書館"
    });

    expect(result.structuredContent).toEqual({
      pid: "897115",
      keyword: "図書館",
      total: 2,
      from: 0,
      items: SEARCH_PAYLOAD.list,
      raw: SEARCH_PAYLOAD
    });
  });

  it("ndl_digital 以外は InvalidRequestError を投げる", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchPagesTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(SEARCH_PAYLOAD),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(
      tool({ source: "cinii_articles", source_id: "x", keyword: "test" })
    ).rejects.toMatchObject({ name: "InvalidRequestError" });
  });

  it("next_digital_library が null なら NotFoundError を投げる", async () => {
    const baseDir = await createTempDir();
    const record = { ...BASE_RECORD, source_metadata: { next_digital_library: null } };
    const tool = createJpLitSearchPagesTool(
      makeRecordService(record),
      makeNextDlClient(SEARCH_PAYLOAD),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(
      tool({ source: "ndl_digital", source_id: "R100000002-I000000518610", keyword: "図書館" })
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("searchPages API が null を返したら NotFoundError を投げる", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchPagesTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(null),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(
      tool({ source: "ndl_digital", source_id: "R100000002-I000000518610", keyword: "図書館" })
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("size / from パラメータが searchPages に渡る", async () => {
    const baseDir = await createTempDir();
    const nextDlClient = makeNextDlClient(SEARCH_PAYLOAD);
    const tool = createJpLitSearchPagesTool(
      makeRecordService(BASE_RECORD),
      nextDlClient,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await tool({
      source: "ndl_digital",
      source_id: "R100000002-I000000518610",
      keyword: "図書館",
      size: 5,
      from: 10
    });

    expect(nextDlClient.searchPages).toHaveBeenCalledWith("897115", "図書館", {
      size: 5,
      from: 10
    });
  });

  it("pid に数字以外が含まれる場合は InvalidRequestError を投げる", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchPagesTool(
      makeRecordService(BASE_RECORD),
      makeNextDlClient(SEARCH_PAYLOAD),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(
      tool({ source: "ndl_digital", pid: "897115/../../secret", keyword: "図書館" })
    ).rejects.toMatchObject({ name: "InvalidRequestError" });
  });
});
