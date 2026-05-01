import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitSearchIllustrationsTool } from "../src/tools/jpLitSearchIllustrations.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-search-illustrations-"));
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
    searchBooks: vi.fn(),
    searchIllustrations: vi.fn().mockResolvedValue(searchResult)
  };
}

const SEARCH_PAYLOAD = {
  list: [
    {
      id: "831460_49_1",
      pid: "831460",
      page: 49,
      x: 20.2,
      y: 13.9,
      w: 28.6,
      h: 31.8,
      graphictags: [
        { tagname: "graphic", confidence: 1.0 },
        { tagname: "picture_outdoor", confidence: 0.85 }
      ],
      feature_txt2vec: [0.12, -0.34, 0.56]
    }
  ],
  hit: 1000,
  from: 0
};

describe("jp_lit_search_illustrations", () => {
  it("正常系: 図版検索結果と IIIF URL を返す", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchIllustrationsTool(
      makeNextDlClient(SEARCH_PAYLOAD),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "富士山" });

    expect(result.structuredContent.keyword).toBe("富士山");
    expect(result.structuredContent.total).toBe(1000);
    expect(result.structuredContent.items).toHaveLength(1);

    const item = result.structuredContent.items[0];
    expect(item).toMatchObject({
      id: "831460_49_1",
      pid: "831460",
      viewer_url: "https://dl.ndl.go.jp/pid/831460",
      page: 49,
      x: 20.2,
      y: 13.9,
      w: 28.6,
      h: 31.8
    });
    expect(item.graphictags).toEqual([
      { tagname: "graphic", confidence: 1.0 },
      { tagname: "picture_outdoor", confidence: 0.85 }
    ]);
  });

  it("page_image_url が正しい IIIF 形式になっている", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchIllustrationsTool(
      makeNextDlClient(SEARCH_PAYLOAD),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "富士山" });
    const item = result.structuredContent.items[0];

    expect(item.page_image_url).toBe(
      "https://dl.ndl.go.jp/api/iiif/831460/R0000049/full/full/0/default.jpg"
    );
  });

  it("illustration_image_url が pct 座標付き IIIF 形式になっている", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchIllustrationsTool(
      makeNextDlClient(SEARCH_PAYLOAD),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "富士山" });
    const item = result.structuredContent.items[0];

    expect(item.illustration_image_url).toBe(
      "https://dl.ndl.go.jp/api/iiif/831460/R0000049/pct:20.2,13.9,28.6,31.8/full/0/default.jpg"
    );
  });

  it("feature_txt2vec が出力に含まれない", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchIllustrationsTool(
      makeNextDlClient(SEARCH_PAYLOAD),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "富士山" });
    const item = result.structuredContent.items[0];

    expect(item).not.toHaveProperty("feature_txt2vec");
  });

  it("size / from パラメータが searchIllustrations に渡る", async () => {
    const baseDir = await createTempDir();
    const nextDlClient = makeNextDlClient(SEARCH_PAYLOAD);
    const tool = createJpLitSearchIllustrationsTool(
      nextDlClient,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await tool({ keyword: "富士山", size: 5, from: 20 });

    expect(nextDlClient.searchIllustrations).toHaveBeenCalledWith("富士山", {
      size: 5,
      from: 20
    });
  });

  it("API が null を返したら NotFoundError を投げる", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchIllustrationsTool(
      makeNextDlClient(null),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(tool({ keyword: "富士山" })).rejects.toMatchObject({
      name: "NotFoundError"
    });
  });

  it("list が空でも正常に返す", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchIllustrationsTool(
      makeNextDlClient({ list: [], hit: 0, from: 0 }),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "存在しないキーワード" });

    expect(result.structuredContent.total).toBe(0);
    expect(result.structuredContent.items).toHaveLength(0);
  });
});
