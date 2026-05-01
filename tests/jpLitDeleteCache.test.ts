import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createJpLitDeleteCacheTool } from "../src/tools/jpLitDeleteCache.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-delete-cache-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_delete_cache", () => {
  it("cache_key 指定で単体削除できる", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const tool = createJpLitDeleteCacheTool(cache);
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "k1",
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "foo" },
      structured_content: { query: "foo", total: 1 }
    });

    const result = await tool({ tool: "jp_lit_search", cache_key: "k1" });
    expect(result.structuredContent.deleted).toBe(true);
    expect(result.structuredContent.deleted_count).toBe(1);
    expect(await cache.read("jp_lit_search", "k1")).toBeNull();
  });

  it("clear_all=true で tool 配下を一括削除できる", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const tool = createJpLitDeleteCacheTool(cache);
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "k1",
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "foo" },
      structured_content: { query: "foo", total: 1 }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "k2",
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "bar" },
      structured_content: { query: "bar", total: 1 }
    });

    const result = await tool({ tool: "jp_lit_search", clear_all: true });
    expect(result.structuredContent.deleted).toBe(true);
    expect(result.structuredContent.deleted_count).toBe(2);
  });
});
