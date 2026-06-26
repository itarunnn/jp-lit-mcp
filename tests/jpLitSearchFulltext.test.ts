import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitSearchFulltextTool } from "../src/tools/jpLitSearchFulltext.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-search-fulltext-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function makeNextDlClient(searchResult: unknown) {
  return {
    getBook: vi.fn(),
    getPage: vi.fn(),
    getFulltextJson: vi.fn(),
    searchPages: vi.fn(),
    searchBooks: vi.fn().mockResolvedValue(searchResult)
  };
}

const SEARCH_PAYLOAD = {
  list: [
    {
      id: "897115",
      title: "帝国図書館一覧",
      volume: null,
      responsibility: "帝国図書館 編",
      publisher: "帝国図書館",
      published: "明治33年",
      publishyear: 1900,
      ndc: "017",
      bibId: "000000518610",
      callNo: "特1-94",
      page: 62,
      isClassic: false,
      highlights: ["大政奉還後の図書館行政について"]
    }
  ],
  hit: 1,
  from: 0
};

describe("jp_lit_search_fulltext", () => {
  it("正常系: 全文検索結果を返す", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchFulltextTool(
      makeNextDlClient(SEARCH_PAYLOAD),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "大政奉還" });

    expect(result.structuredContent.keyword).toBe("大政奉還");
    expect(result.structuredContent.searchfield).toBe("contentonly");
    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.from).toBe(0);
    expect(result.structuredContent.items).toHaveLength(1);
    expect(result.structuredContent.items[0]).toMatchObject({
      pid: "897115",
      viewer_url: "https://dl.ndl.go.jp/pid/897115",
      title: "帝国図書館一覧",
      responsibility: "帝国図書館 編",
      publishyear: 1900,
      is_classic: false
    });
  });

  it("searchfield=metaonly を渡せる", async () => {
    const baseDir = await createTempDir();
    const nextDlClient = makeNextDlClient(SEARCH_PAYLOAD);
    const tool = createJpLitSearchFulltextTool(
      nextDlClient,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await tool({ keyword: "図書館", searchfield: "metaonly" });

    expect(nextDlClient.searchBooks).toHaveBeenCalledWith(
      "図書館",
      expect.objectContaining({ searchfield: "metaonly" })
    );
  });

  it("size / from / f_ndc パラメータが searchBooks に渡る", async () => {
    const baseDir = await createTempDir();
    const nextDlClient = makeNextDlClient(SEARCH_PAYLOAD);
    const tool = createJpLitSearchFulltextTool(
      nextDlClient,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await tool({ keyword: "図書館", size: 5, from: 10, f_ndc: "017" });

    expect(nextDlClient.searchBooks).toHaveBeenCalledWith(
      "図書館",
      expect.objectContaining({ size: 5, from: 10, fNdc: "017" })
    );
  });

  it("短い NDC 分類は前方一致 filter として searchBooks に渡る", async () => {
    const baseDir = await createTempDir();
    const nextDlClient = makeNextDlClient(SEARCH_PAYLOAD);
    const tool = createJpLitSearchFulltextTool(
      nextDlClient,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await tool({ keyword: "夏目漱石", f_ndc: "9" });

    expect(nextDlClient.searchBooks).toHaveBeenCalledWith(
      "夏目漱石",
      expect.objectContaining({ fNdc: "9*" })
    );
  });

  it("具体的な NDC 分類と明示的な wildcard はそのまま searchBooks に渡る", async () => {
    const baseDir = await createTempDir();
    const nextDlClient = makeNextDlClient(SEARCH_PAYLOAD);
    const tool = createJpLitSearchFulltextTool(
      nextDlClient,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await tool({ keyword: "図書館", f_ndc: "017", force_refresh: true });
    await tool({ keyword: "文学", f_ndc: "9*", force_refresh: true });

    expect(nextDlClient.searchBooks).toHaveBeenNthCalledWith(
      1,
      "図書館",
      expect.objectContaining({ fNdc: "017" })
    );
    expect(nextDlClient.searchBooks).toHaveBeenNthCalledWith(
      2,
      "文学",
      expect.objectContaining({ fNdc: "9*" })
    );
  });

  it("短い NDC 分類と正規化後の wildcard は同じ cache entry を使う", async () => {
    const baseDir = await createTempDir();
    const nextDlClient = makeNextDlClient(SEARCH_PAYLOAD);
    const tool = createJpLitSearchFulltextTool(
      nextDlClient,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await tool({ keyword: "夏目漱石", f_ndc: "9" });
    await tool({ keyword: "夏目漱石", f_ndc: "9*" });

    expect(nextDlClient.searchBooks).toHaveBeenCalledTimes(1);
  });

  it("空白だけの NDC 分類は未指定と同じ cache entry を使う", async () => {
    const baseDir = await createTempDir();
    const nextDlClient = makeNextDlClient(SEARCH_PAYLOAD);
    const tool = createJpLitSearchFulltextTool(
      nextDlClient,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await tool({ keyword: "夏目漱石" });
    await tool({ keyword: "夏目漱石", f_ndc: "   " });

    expect(nextDlClient.searchBooks).toHaveBeenCalledTimes(1);
  });

  it("API が null を返したら NotFoundError を投げる", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchFulltextTool(
      makeNextDlClient(null),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(tool({ keyword: "大政奉還" })).rejects.toMatchObject({
      name: "NotFoundError"
    });
  });

  it("bibId / callNo が items の bib_id / call_no にマップされる", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchFulltextTool(
      makeNextDlClient(SEARCH_PAYLOAD),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "大政奉還" });

    expect(result.structuredContent.items[0]).toMatchObject({
      bib_id: "000000518610",
      call_no: "特1-94"
    });
  });

  it("bibId / callNo が欠落していれば bib_id / call_no は null になる", async () => {
    const baseDir = await createTempDir();
    const payloadWithoutBibId = {
      list: [{ id: "111", title: "テスト", page: 10, isClassic: false, highlights: [] }],
      hit: 1,
      from: 0
    };
    const tool = createJpLitSearchFulltextTool(
      makeNextDlClient(payloadWithoutBibId),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "テスト" });

    expect(result.structuredContent.items[0]).toMatchObject({
      bib_id: null,
      call_no: null
    });
  });

  it("list が空でも正常に返す", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchFulltextTool(
      makeNextDlClient({ list: [], hit: 0, from: 0 }),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "存在しないキーワード" });

    expect(result.structuredContent.total).toBe(0);
    expect(result.structuredContent.items).toHaveLength(0);
  });

  it("同一入力は cache を再利用し、force_refresh=true では上流を再検索する", async () => {
    const baseDir = await createTempDir();
    const nextDlClient = makeNextDlClient(SEARCH_PAYLOAD);
    const tool = createJpLitSearchFulltextTool(
      nextDlClient,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const first = await tool({ keyword: "大政奉還", size: 1 });
    const second = await tool({ keyword: "大政奉還", size: 1 });
    const refreshed = await tool({ keyword: "大政奉還", size: 1, force_refresh: true });

    expect(first.structuredContent.cache).toMatchObject({
      hit: false,
      cache_key: expect.any(String),
      saved_at: expect.any(String),
      refresh_hint: null
    });
    expect(second.structuredContent.cache).toMatchObject({
      hit: true,
      cache_key: first.structuredContent.cache?.cache_key,
      saved_at: first.structuredContent.cache?.saved_at,
      refresh_hint: expect.stringContaining("上流APIへは再検索していません")
    });
    expect(second.structuredContent.cache?.refresh_hint).toContain(second.structuredContent.cache?.saved_at);
    expect(refreshed.structuredContent.cache?.hit).toBe(false);
    expect(refreshed.structuredContent.cache?.cache_key).toBe(first.structuredContent.cache?.cache_key);
    expect(nextDlClient.searchBooks).toHaveBeenCalledTimes(2);
  });
});
