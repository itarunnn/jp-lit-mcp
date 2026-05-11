import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitSearchKokushoImageTagsTool } from "../src/tools/jpLitSearchKokushoImageTags.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-kokusho-tags-"));
  tempDirs.push(dir);
  return dir;
}

function readFixture(name: string) {
  return JSON.parse(readFileSync(new URL(`./fixtures/kokusho/${name}`, import.meta.url), "utf-8"));
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function makeClient(payload: unknown) {
  return {
    searchBiblios: vi.fn(),
    getBiblioDetail: vi.fn(),
    searchFulltext: vi.fn(),
    searchImageTags: vi.fn().mockResolvedValue(payload)
  };
}

describe("jp_lit_search_kokusho_image_tags", () => {
  it("国書DB画像タグ検索を正規化して返す", async () => {
    const baseDir = await createTempDir();
    const client = makeClient(readFixture("image-tags-response.json"));
    const tool = createJpLitSearchKokushoImageTagsTool(
      client,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "桜", limit: 1, page: 1 });

    expect(client.searchImageTags).toHaveBeenCalledWith("桜", 1);
    expect(result.structuredContent).toMatchObject({
      keyword: "桜",
      page: 1,
      limit: 1,
      total: 2488,
      cache: {
        hit: false,
        cache_key: expect.any(String),
        saved_at: expect.any(String),
        refresh_hint: null
      },
      raw: {
        endpoint: "tagSearch",
        upstream_total: 2488,
        upstream_page: 1,
        upstream_last_page: 25,
        returned_count: 1
      }
    });
    expect(result.structuredContent.items).toEqual([
      expect.objectContaining({
        bid: "200002332",
        source_id: "200002332",
        title: "絵本太閤記",
        work_title: "絵本太閤記",
        authors: [{ name: "岡田玉山", role: "author" }],
        koma: 7,
        tag_texts: ["桜", "武者"],
        image_paths: [
          "/200002332/v4/image/00000007.tif/744,387,882,679",
          "/200002332/v4/image/00000007.tif/100,100,200,200"
        ],
        viewer_url: "https://kokusho.nijl.ac.jp/biblio/200002332/7",
        biblio_url: "https://kokusho.nijl.ac.jp/biblio/200002332",
        source_metadata: expect.objectContaining({
          collection: "国文研",
          seikyu: "ナ4-1",
          upstream_per_page: 100,
          upstream_last_page: 25
        })
      })
    ]);
  });

  it("上流が返す空のプレースホルダ行を除外してから limit を適用する", async () => {
    const baseDir = await createTempDir();
    const fixture = readFixture("image-tags-response.json") as Record<string, unknown>;
    fixture.data = [
      {
        bid: null,
        name: "",
        koma: "",
        tag: [{ imagepath: null, text: null }],
        authorlist: []
      },
      ...(fixture.data as unknown[])
    ];
    const client = makeClient(fixture);
    const tool = createJpLitSearchKokushoImageTagsTool(
      client,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "桜", limit: 1, page: 1 });

    expect(result.structuredContent.items).toHaveLength(1);
    expect(result.structuredContent.items[0].bid).toBe("200002332");
    expect(result.structuredContent.items[0].tag_texts).toEqual(["桜", "武者"]);
  });

  it("同一入力は cache を再利用し、force_refresh=true では再取得する", async () => {
    const baseDir = await createTempDir();
    const client = makeClient(readFixture("image-tags-response.json"));
    const tool = createJpLitSearchKokushoImageTagsTool(
      client,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const first = await tool({ keyword: "桜", limit: 1 });
    const second = await tool({ keyword: "桜", limit: 1 });
    const refreshed = await tool({ keyword: "桜", limit: 1, force_refresh: true });

    expect(first.structuredContent.cache?.hit).toBe(false);
    expect(second.structuredContent.cache?.hit).toBe(true);
    expect(refreshed.structuredContent.cache?.hit).toBe(false);
    expect(client.searchImageTags).toHaveBeenCalledTimes(2);
  });

  it("data 非配列 payload は NotFoundError を投げる", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchKokushoImageTagsTool(
      makeClient({ total: 1 }),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(tool({ keyword: "桜" })).rejects.toMatchObject({
      name: "NotFoundError"
    });
  });
});
