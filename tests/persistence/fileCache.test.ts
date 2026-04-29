import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCacheKey } from "../../src/lib/persistence/cacheKeys.js";
import { createFileCache } from "../../src/lib/persistence/fileCache.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ndl-jp-lit-cache-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("createCacheKey", () => {
  it("normalizes object key order", () => {
    const left = createCacheKey("jp_lit_search", { query: "foo", page: 1 });
    const right = createCacheKey("jp_lit_search", { page: 1, query: "foo" });

    expect(left).toBe(right);
  });
});

describe("file cache", () => {
  it("round-trips structured content", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-test",
      saved_at: new Date().toISOString(),
      input: { query: "foo" },
      structured_content: { query: "foo", total: 1 }
    });

    const cached = await cache.read<{ query: string; total: number }>(
      "jp_lit_search",
      "sha256-test"
    );

    expect(cached?.structured_content).toEqual({ query: "foo", total: 1 });
  });
});
