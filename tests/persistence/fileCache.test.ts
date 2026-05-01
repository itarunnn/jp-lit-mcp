import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCacheKey } from "../../src/lib/persistence/cacheKeys.js";
import { createFileCache } from "../../src/lib/persistence/fileCache.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-cache-"));
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

  it("reads cached content from the legacy cache directory when the new path is missing", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const legacyDir = path.join(baseDir, ".cache", "ndl-jp-lit-mcp", "cache", "v1", "jp_lit_search");
    const legacyFile = path.join(legacyDir, "sha256-legacy.json");

    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      legacyFile,
      JSON.stringify(
        {
          version: 1,
          tool: "jp_lit_search",
          cache_key: "sha256-legacy",
          saved_at: new Date().toISOString(),
          input: { query: "legacy" },
          structured_content: { query: "legacy", total: 2 }
        },
        null,
        2
      ),
      "utf8"
    );

    const cached = await cache.read<{ query: string; total: number }>(
      "jp_lit_search",
      "sha256-legacy"
    );

    expect(cached?.structured_content).toEqual({ query: "legacy", total: 2 });
  });

  it("deletes cache file by key", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-delete",
      saved_at: new Date().toISOString(),
      input: { query: "delete" },
      structured_content: { query: "delete", total: 1 }
    });

    const deleted = await cache.delete("jp_lit_search", "sha256-delete");
    const cached = await cache.read("jp_lit_search", "sha256-delete");
    expect(deleted).toBe(true);
    expect(cached).toBeNull();
  });

  it("clears all cache files for a tool", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-c1",
      saved_at: new Date().toISOString(),
      input: { query: "a" },
      structured_content: { query: "a", total: 1 }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-c2",
      saved_at: new Date().toISOString(),
      input: { query: "b" },
      structured_content: { query: "b", total: 1 }
    });

    const removed = await cache.clear("jp_lit_search");
    expect(removed).toBe(2);
    expect(await cache.read("jp_lit_search", "sha256-c1")).toBeNull();
    expect(await cache.read("jp_lit_search", "sha256-c2")).toBeNull();
  });
});
