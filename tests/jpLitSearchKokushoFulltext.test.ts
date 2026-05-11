import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitSearchKokushoFulltextTool } from "../src/tools/jpLitSearchKokushoFulltext.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-kokusho-fulltext-"));
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
    searchFulltext: vi.fn().mockResolvedValue(payload),
    searchImageTags: vi.fn()
  };
}

describe("jp_lit_search_kokusho_fulltext", () => {
  it("国書DB全文検索スニペットを正規化して返す", async () => {
    const baseDir = await createTempDir();
    const client = makeClient(readFixture("fulltext-response.json"));
    const tool = createJpLitSearchKokushoFulltextTool(
      client,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "春", limit: 1, page: 1 });

    expect(client.searchFulltext).toHaveBeenCalledWith("春");
    expect(result.structuredContent).toMatchObject({
      keyword: "春",
      page: 1,
      limit: 1,
      total: 2,
      cache: {
        hit: false,
        cache_key: expect.any(String),
        saved_at: expect.any(String),
        refresh_hint: null
      },
      raw: {
        endpoint: "fulltextSearch",
        upstream_total: 2,
        returned_count: 1
      }
    });
    expect(result.structuredContent.items).toEqual([
      expect.objectContaining({
        bid: "200010454",
        source_id: "200010454",
        title: "源氏物語",
        work_title: "源氏物語",
        authors: [{ name: "紫式部", role: "author" }],
        koma: 12,
        line: 4,
        snippet: "いづれの御時にか、春の光のどけきころ",
        viewer_url: "https://kokusho.nijl.ac.jp/biblio/200010454/12",
        biblio_url: "https://kokusho.nijl.ac.jp/biblio/200010454",
        source_metadata: expect.objectContaining({
          satsu: "1",
          totalkoma: 58,
          kansha: "写",
          shubetsu: "M",
          wkeyword: "春",
          authorhead: "むらさきしきぶ"
        })
      })
    ]);
  });

  it("page / limit で上流配列を slice し、HTML タグを除去する", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchKokushoFulltextTool(
      makeClient(readFixture("fulltext-response.json")),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ keyword: "春", limit: 1, page: 2 });

    expect(result.structuredContent.items).toHaveLength(1);
    expect(result.structuredContent.items[0]).toMatchObject({
      bid: "200010455",
      koma: 13,
      line: 5,
      snippet: "春の夜の夢"
    });
  });

  it("同一入力は cache を再利用し、force_refresh=true では再取得する", async () => {
    const baseDir = await createTempDir();
    const client = makeClient(readFixture("fulltext-response.json"));
    const tool = createJpLitSearchKokushoFulltextTool(
      client,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const first = await tool({ keyword: "春", limit: 1 });
    const second = await tool({ keyword: "春", limit: 1 });
    const refreshed = await tool({ keyword: "春", limit: 1, force_refresh: true });

    expect(first.structuredContent.cache?.hit).toBe(false);
    expect(second.structuredContent.cache?.hit).toBe(true);
    expect(second.structuredContent.cache?.refresh_hint).toContain("force_refresh=true");
    expect(refreshed.structuredContent.cache?.hit).toBe(false);
    expect(client.searchFulltext).toHaveBeenCalledTimes(2);
  });

  it("非配列 payload は NotFoundError を投げる", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitSearchKokushoFulltextTool(
      makeClient({ error: "unexpected" }),
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    await expect(tool({ keyword: "春" })).rejects.toMatchObject({
      name: "NotFoundError"
    });
  });
});
