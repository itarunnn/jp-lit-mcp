import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCacheKey } from "../../src/lib/persistence/cacheKeys.js";
import { createFileCache } from "../../src/lib/persistence/fileCache.js";
import {
  getCacheRoot,
  getLegacyCacheRoot
} from "../../src/lib/persistence/paths.js";

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
  it("serializes concurrent writes to the same key and leaves parseable JSON", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const key = createCacheKey("jp_lit_search", { query: "concurrent" });

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        cache.write("jp_lit_search", {
          version: 1,
          tool: "jp_lit_search",
          cache_key: key,
          saved_at: `2026-05-01T00:00:0${index}.000Z`,
          input: { query: "concurrent" },
          structured_content: { index }
        })
      )
    );

    const target = path.join(getCacheRoot(baseDir), "jp_lit_search", `${key}.json`);
    const persisted = await readFile(target, "utf8");
    expect(() => JSON.parse(persisted)).not.toThrow();
    await expect(cache.read("jp_lit_search", key)).resolves.toMatchObject({
      cache_key: key
    });
  });

  it("does not leave a unique temp file when serialization fails", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const key = createCacheKey("jp_lit_search", { query: "cleanup" });
    const directory = path.join(getCacheRoot(baseDir), "jp_lit_search");
    const circular: Record<string, unknown> = { cleanup: true };
    circular.self = circular;

    await expect(
      cache.write("jp_lit_search", {
        version: 1,
        tool: "jp_lit_search",
        cache_key: key,
        saved_at: "2026-05-01T00:00:00.000Z",
        input: { query: "cleanup" },
        structured_content: circular
      })
    ).rejects.toThrow();

    expect((await readdir(directory)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("round-trips structured content", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const key = createCacheKey("jp_lit_search", { query: "foo" });

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: key,
      saved_at: new Date().toISOString(),
      input: { query: "foo" },
      structured_content: { query: "foo", total: 1 }
    });

    const cached = await cache.read<{ query: string; total: number }>(
      "jp_lit_search",
      key
    );

    expect(cached?.structured_content).toEqual({ query: "foo", total: 1 });
  });

  it("reads cached content from the legacy cache directory when the new path is missing", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const key = createCacheKey("jp_lit_search", { query: "legacy" });
    const legacyDir = path.join(baseDir, ".cache", "ndl-jp-lit-mcp", "cache", "v1", "jp_lit_search");
    const legacyFile = path.join(legacyDir, `${key}.json`);

    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      legacyFile,
      JSON.stringify(
        {
          version: 1,
          tool: "jp_lit_search",
          cache_key: key,
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
      key
    );

    expect(cached?.structured_content).toEqual({ query: "legacy", total: 2 });
  });

  it("deletes cache file by key", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const key = createCacheKey("jp_lit_search", { query: "delete" });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: key,
      saved_at: new Date().toISOString(),
      input: { query: "delete" },
      structured_content: { query: "delete", total: 1 }
    });

    const deleted = await cache.delete("jp_lit_search", key);
    const cached = await cache.read("jp_lit_search", key);
    expect(deleted).toBe(true);
    expect(cached).toBeNull();
  });

  it("clears all cache files for a tool", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const firstKey = createCacheKey("jp_lit_search", { query: "a" });
    const secondKey = createCacheKey("jp_lit_search", { query: "b" });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: firstKey,
      saved_at: new Date().toISOString(),
      input: { query: "a" },
      structured_content: { query: "a", total: 1 }
    });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: secondKey,
      saved_at: new Date().toISOString(),
      input: { query: "b" },
      structured_content: { query: "b", total: 1 }
    });

    const removed = await cache.clear("jp_lit_search");
    expect(removed).toBe(2);
    expect(await cache.read("jp_lit_search", firstKey)).toBeNull();
    expect(await cache.read("jp_lit_search", secondKey)).toBeNull();
  });

  it("rejects cache path traversal without touching files outside the cache root", async () => {
    const baseDir = await createTempDir();
    const victim = path.join(baseDir, "victim");
    const proof = path.join(victim, "proof.json");
    await mkdir(victim, { recursive: true });
    await writeFile(proof, "{}", "utf8");
    const cache = createFileCache(baseDir);

    await expect(cache.clear("../../../../victim")).rejects.toThrow(/cache/i);
    await expect(readFile(proof, "utf8")).resolves.toBe("{}");
  });

  it("rejects traversal in cache keys", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);

    await expect(
      cache.delete("jp_lit_search", "../../../../../victim/proof")
    ).rejects.toThrow(/cache/i);
  });

  it.each([
    ["current", "read"],
    ["current", "write"],
    ["current", "delete"],
    ["current", "clear"],
    ["legacy", "read"],
    ["legacy", "delete"],
    ["legacy", "clear"]
  ] as const)("rejects %s cache %s through an outside junction", async (rootKind, operation) => {
    const baseDir = await createTempDir();
    const victim = path.join(baseDir, "victim");
    const key = createCacheKey("jp_lit_search", { rootKind, operation });
    const proof = path.join(victim, `${key}.json`);
    const cacheRoot =
      rootKind === "current"
        ? getCacheRoot(baseDir)
        : getLegacyCacheRoot(baseDir);
    const linkedToolDir = path.join(cacheRoot, "jp_lit_search");
    await mkdir(victim, { recursive: true });
    await writeFile(
      proof,
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: key,
        saved_at: "2026-05-01T00:00:00.000Z",
        input: {},
        structured_content: { proof: true }
      }),
      "utf8"
    );
    await mkdir(cacheRoot, { recursive: true });
    await symlink(
      victim,
      linkedToolDir,
      process.platform === "win32" ? "junction" : "dir"
    );
    const cache = createFileCache(baseDir);

    const action =
      operation === "read"
        ? () => cache.read("jp_lit_search", key)
        : operation === "write"
          ? () => cache.write("jp_lit_search", {
              version: 1,
              tool: "jp_lit_search",
              cache_key: key,
              saved_at: "2026-05-01T00:00:00.000Z",
              input: {},
              structured_content: { changed: true }
            })
          : operation === "delete"
            ? () => cache.delete("jp_lit_search", key)
            : () => cache.clear("jp_lit_search");

    await expect(action()).rejects.toThrow(/cache/i);
    await expect(readFile(proof, "utf8")).resolves.toContain("proof");
  });

  it("uses a current entry before resolving an unsafe legacy path", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const key = createCacheKey("jp_lit_search", { query: "current-first" });
    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: key,
      saved_at: "2026-05-01T00:00:00.000Z",
      input: { query: "current-first" },
      structured_content: { current: true }
    });

    const victim = path.join(baseDir, "legacy-victim");
    const legacyRoot = getLegacyCacheRoot(baseDir);
    await mkdir(victim, { recursive: true });
    await mkdir(legacyRoot, { recursive: true });
    await symlink(
      victim,
      path.join(legacyRoot, "jp_lit_search"),
      process.platform === "win32" ? "junction" : "dir"
    );

    await expect(cache.read("jp_lit_search", key)).resolves.toMatchObject({
      structured_content: { current: true }
    });
    await expect(cache.delete("jp_lit_search", key)).resolves.toBe(true);
  });

  it.each(["current", "legacy"] as const)(
    "rejects a dangling %s cache junction",
    async (rootKind) => {
      const baseDir = await createTempDir();
      const cacheRoot =
        rootKind === "current"
          ? getCacheRoot(baseDir)
          : getLegacyCacheRoot(baseDir);
      await mkdir(cacheRoot, { recursive: true });
      await symlink(
        path.join(baseDir, "missing-target"),
        path.join(cacheRoot, "jp_lit_search"),
        process.platform === "win32" ? "junction" : "dir"
      );

      await expect(
        createFileCache(baseDir).clear("jp_lit_search")
      ).rejects.toThrow(/cache/i);
    }
  );

  it("ignores unknown directories when clearing every cached tool", async () => {
    const baseDir = await createTempDir();
    const unknownDir = path.join(getCacheRoot(baseDir), "unexpected");
    const proof = path.join(unknownDir, "proof.json");
    await mkdir(unknownDir, { recursive: true });
    await writeFile(proof, "{}", "utf8");
    const cache = createFileCache(baseDir);

    await expect(cache.clear()).resolves.toBe(0);
    await expect(readFile(proof, "utf8")).resolves.toBe("{}");
  });
});
