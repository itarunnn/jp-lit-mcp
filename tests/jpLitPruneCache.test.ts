import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCacheKey } from "../src/lib/persistence/cacheKeys.js";
import {
  listCacheInventory,
  removeInventoryItem
} from "../src/lib/persistence/cacheInventory.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import {
  getCacheRoot,
  getLegacyCacheRoot
} from "../src/lib/persistence/paths.js";
import { createJpLitPruneCacheTool } from "../src/tools/jpLitPruneCache.js";

const tempDirs: string[] = [];

function fixtureCacheKey(label: string) {
  return createCacheKey("jp_lit_search", { fixture: label });
}

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-prune-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

async function writeCache(
  baseDir: string,
  tool: string,
  cacheKey: string,
  savedAt: string,
  structuredContent: Record<string, unknown> = { ok: true }
) {
  const fileCache = createFileCache(baseDir);
  await fileCache.write(tool, {
    version: 1,
    tool,
    cache_key: cacheKey,
    saved_at: savedAt,
    input: { query: cacheKey },
    structured_content: structuredContent
  });
}

async function readCacheFile(baseDir: string, root: "current" | "legacy", tool: string, cacheKey: string) {
  const cacheRoot =
    root === "current"
      ? ".cache/jp-lit-mcp/cache/v1"
      : ".cache/ndl-jp-lit-mcp/cache/v1";
  return readFile(path.join(baseDir, cacheRoot, tool, `${cacheKey}.json`), "utf8");
}

async function writeRawCacheFile(
  baseDir: string,
  root: "current" | "legacy",
  toolDir: string,
  filename: string,
  content: string
) {
  const cacheRoot =
    root === "current"
      ? ".cache/jp-lit-mcp/cache/v1"
      : ".cache/ndl-jp-lit-mcp/cache/v1";
  const directory = path.join(baseDir, cacheRoot, toolDir);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), content, "utf8");
}

describe("jp_lit_prune_cache", () => {
  it("dry-runs old cache deletion without removing files", async () => {
    const baseDir = await createTempDir();
    await writeCache(baseDir, "jp_lit_search", fixtureCacheKey("old"), "2026-04-01T00:00:00.000Z");
    await writeCache(baseDir, "jp_lit_search", fixtureCacheKey("new"), "2026-05-04T00:00:00.000Z");
    const tool = createJpLitPruneCacheTool(
      baseDir,
      () => new Date("2026-05-05T00:00:00.000Z")
    );

    const result = await tool({ older_than_days: 30 });

    expect(result.structuredContent.dry_run).toBe(true);
    expect(result.structuredContent.matched_count).toBe(1);
    expect(result.structuredContent.pruned_count).toBe(0);
    expect(result.structuredContent.candidates.map((item) => item.cache_key)).toEqual([
      fixtureCacheKey("old")
    ]);
    await expect(
      readFile(
        path.join(baseDir, ".cache/jp-lit-mcp/cache/v1/jp_lit_search", `${fixtureCacheKey("old")}.json`),
        "utf8"
      )
    ).resolves.toContain(fixtureCacheKey("old"));
  });

  it("deletes old cache only when dry_run is false", async () => {
    const baseDir = await createTempDir();
    await writeCache(baseDir, "jp_lit_search", fixtureCacheKey("old"), "2026-04-01T00:00:00.000Z");
    await writeCache(baseDir, "jp_lit_search", fixtureCacheKey("new"), "2026-05-04T00:00:00.000Z");
    const tool = createJpLitPruneCacheTool(
      baseDir,
      () => new Date("2026-05-05T00:00:00.000Z")
    );

    const result = await tool({ older_than_days: 30, dry_run: false });

    expect(result.structuredContent.matched_count).toBe(1);
    expect(result.structuredContent.pruned_count).toBe(1);
    await expect(
      readCacheFile(baseDir, "current", "jp_lit_search", fixtureCacheKey("old"))
    ).rejects.toThrow();
    await expect(
      readCacheFile(baseDir, "current", "jp_lit_search", fixtureCacheKey("new"))
    ).resolves.toContain(fixtureCacheKey("new"));
  });

  it("filters candidates by tool and respects limit", async () => {
    const baseDir = await createTempDir();
    await writeCache(baseDir, "jp_lit_search", fixtureCacheKey("search-old"), "2026-04-01T00:00:00.000Z");
    await writeCache(baseDir, "jp_lit_get_record", fixtureCacheKey("record-old-1"), "2026-03-01T00:00:00.000Z");
    await writeCache(baseDir, "jp_lit_get_record", fixtureCacheKey("record-old-2"), "2026-03-02T00:00:00.000Z");
    const tool = createJpLitPruneCacheTool(
      baseDir,
      () => new Date("2026-05-05T00:00:00.000Z")
    );

    const result = await tool({
      older_than_days: 30,
      tool: "jp_lit_get_record",
      limit: 1
    });

    expect(result.structuredContent.tool).toBe("jp_lit_get_record");
    expect(result.structuredContent.matched_count).toBe(1);
    expect(result.structuredContent.candidates.map((item) => item.cache_key)).toEqual([
      fixtureCacheKey("record-old-1")
    ]);
  });

  it("includes legacy cache root candidates", async () => {
    const baseDir = await createTempDir();
    await writeRawCacheFile(
      baseDir,
      "legacy",
      "jp_lit_search",
      `${fixtureCacheKey("legacy-old")}.json`,
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("legacy-old"),
        saved_at: "2026-03-01T00:00:00.000Z",
        input: {},
        structured_content: { ok: true }
      })
    );
    const tool = createJpLitPruneCacheTool(
      baseDir,
      () => new Date("2026-05-05T00:00:00.000Z")
    );

    const result = await tool({ older_than_days: 30 });

    expect(result.structuredContent.candidates).toEqual([
      expect.objectContaining({
        cache_key: fixtureCacheKey("legacy-old"),
        root: "legacy"
      })
    ]);
  });

  it("removes the exact legacy path without deleting same-key current cache", async () => {
    const baseDir = await createTempDir();
    await writeCache(baseDir, "jp_lit_search", fixtureCacheKey("same-key"), "2026-05-04T00:00:00.000Z");
    await writeRawCacheFile(
      baseDir,
      "legacy",
      "jp_lit_search",
      `${fixtureCacheKey("same-key")}.json`,
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("same-key"),
        saved_at: "2026-03-01T00:00:00.000Z",
        input: {},
        structured_content: { legacy: true }
      })
    );
    const tool = createJpLitPruneCacheTool(
      baseDir,
      () => new Date("2026-05-05T00:00:00.000Z")
    );

    const result = await tool({ older_than_days: 30, dry_run: false });

    expect(result.structuredContent.pruned_count).toBe(1);
    await expect(readCacheFile(baseDir, "legacy", "jp_lit_search", fixtureCacheKey("same-key"))).rejects.toThrow();
    await expect(readCacheFile(baseDir, "current", "jp_lit_search", fixtureCacheKey("same-key"))).resolves.toContain(
      fixtureCacheKey("same-key")
    );
  });

  it("skips malformed files and tool directory mismatches", async () => {
    const baseDir = await createTempDir();
    await writeRawCacheFile(
      baseDir,
      "current",
      "jp_lit_search",
      `${fixtureCacheKey("bad-json")}.json`,
      "{"
    );
    await writeRawCacheFile(
      baseDir,
      "current",
      "jp_lit_search",
      `${fixtureCacheKey("bad-date")}.json`,
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("bad-date"),
        saved_at: "not-a-date",
        input: {},
        structured_content: {}
      })
    );
    await writeRawCacheFile(
      baseDir,
      "current",
      "jp_lit_search",
      `${fixtureCacheKey("wrong-tool")}.json`,
      JSON.stringify({
        version: 1,
        tool: "jp_lit_get_record",
        cache_key: fixtureCacheKey("wrong-tool"),
        saved_at: "2026-03-01T00:00:00.000Z",
        input: {},
        structured_content: {}
      })
    );
    const tool = createJpLitPruneCacheTool(
      baseDir,
      () => new Date("2026-05-05T00:00:00.000Z")
    );

    const result = await tool({ older_than_days: 30 });

    expect(result.structuredContent.matched_count).toBe(0);
    expect(result.structuredContent.skipped_count).toBe(3);
    expect(result.structuredContent.skipped.map((item) => item.reason).sort()).toEqual([
      "invalid JSON",
      "invalid saved_at",
      "tool directory does not match cache metadata"
    ]);
  });

  it("rejects tool traversal at the public prune schema", async () => {
    const baseDir = await createTempDir();
    const tool = createJpLitPruneCacheTool(baseDir);

    await expect(
      tool({ tool: "../../../../victim", dry_run: false })
    ).rejects.toThrow();
  });

  it("skips non-SHA cache filenames and metadata", async () => {
    const baseDir = await createTempDir();
    await writeRawCacheFile(
      baseDir,
      "current",
      "jp_lit_search",
      "not-sha.json",
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: "not-sha",
        saved_at: "2026-03-01T00:00:00.000Z",
        input: {},
        structured_content: {}
      })
    );

    const result = await createJpLitPruneCacheTool(
      baseDir,
      () => new Date("2026-05-05T00:00:00.000Z")
    )({ older_than_days: 30, dry_run: false });

    expect(result.structuredContent.matched_count).toBe(0);
    expect(result.structuredContent.pruned_count).toBe(0);
    expect(result.structuredContent.skipped.map((item) => item.reason)).toContain(
      "invalid cache key filename"
    );
  });

  it("skips cache metadata whose key differs from the filename", async () => {
    const baseDir = await createTempDir();
    const filenameKey = fixtureCacheKey("filename-key");
    const metadataKey = fixtureCacheKey("metadata-key");
    const proof = path.join(
      getCacheRoot(baseDir),
      "jp_lit_search",
      `${filenameKey}.json`
    );
    await writeRawCacheFile(
      baseDir,
      "current",
      "jp_lit_search",
      `${filenameKey}.json`,
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: metadataKey,
        saved_at: "2026-03-01T00:00:00.000Z",
        input: {},
        structured_content: { proof: true }
      })
    );

    const result = await createJpLitPruneCacheTool(
      baseDir,
      () => new Date("2026-05-05T00:00:00.000Z")
    )({ older_than_days: 30, dry_run: false });

    expect(result.structuredContent.matched_count).toBe(0);
    expect(result.structuredContent.skipped.map((item) => item.reason)).toContain(
      "cache filename does not match cache metadata"
    );
    await expect(readFile(proof, "utf8")).resolves.toContain("proof");
  });

  it("ignores unknown tool directories when pruning every tool", async () => {
    const baseDir = await createTempDir();
    const unknownDir = path.join(getCacheRoot(baseDir), "unexpected");
    const proof = path.join(unknownDir, `${fixtureCacheKey("unknown")}.json`);
    await mkdir(unknownDir, { recursive: true });
    await writeFile(
      proof,
      JSON.stringify({
        version: 1,
        tool: "unexpected",
        cache_key: fixtureCacheKey("unknown"),
        saved_at: "2026-03-01T00:00:00.000Z",
        input: {},
        structured_content: {}
      }),
      "utf8"
    );

    const result = await createJpLitPruneCacheTool(
      baseDir,
      () => new Date("2026-05-05T00:00:00.000Z")
    )({ older_than_days: 30, dry_run: false });

    expect(result.structuredContent.matched_count).toBe(0);
    await expect(readFile(proof, "utf8")).resolves.toContain("unexpected");
  });

  it.each(["current", "legacy"] as const)(
    "rejects prune through an outside %s junction without deleting the proof",
    async (rootKind) => {
      const baseDir = await createTempDir();
      const cacheRoot =
        rootKind === "current"
          ? getCacheRoot(baseDir)
          : getLegacyCacheRoot(baseDir);
      const victim = path.join(baseDir, `${rootKind}-victim`);
      const key = fixtureCacheKey(`${rootKind}-junction`);
      const proof = path.join(victim, `${key}.json`);
      await mkdir(victim, { recursive: true });
      await writeFile(
        proof,
        JSON.stringify({
          version: 1,
          tool: "jp_lit_search",
          cache_key: key,
          saved_at: "2026-03-01T00:00:00.000Z",
          input: {},
          structured_content: { proof: true }
        }),
        "utf8"
      );
      await mkdir(cacheRoot, { recursive: true });
      await symlink(
        victim,
        path.join(cacheRoot, "jp_lit_search"),
        process.platform === "win32" ? "junction" : "dir"
      );

      const prune = createJpLitPruneCacheTool(
        baseDir,
        () => new Date("2026-05-05T00:00:00.000Z")
      );
      await expect(
        prune({
          older_than_days: 30,
          tool: "jp_lit_search",
          dry_run: false
        })
      ).rejects.toThrow(/cache/i);
      await expect(readFile(proof, "utf8")).resolves.toContain("proof");
    }
  );

  it("rejects prune through a dangling junction", async () => {
    const baseDir = await createTempDir();
    const cacheRoot = getCacheRoot(baseDir);
    await mkdir(cacheRoot, { recursive: true });
    await symlink(
      path.join(baseDir, "missing-victim"),
      path.join(cacheRoot, "jp_lit_search"),
      process.platform === "win32" ? "junction" : "dir"
    );

    await expect(
      createJpLitPruneCacheTool(baseDir)({
        tool: "jp_lit_search",
        dry_run: false
      })
    ).rejects.toThrow(/cache/i);
  });

  it("reconstructs the removal target instead of trusting item.path", async () => {
    const baseDir = await createTempDir();
    const firstKey = fixtureCacheKey("inventory-first");
    const secondKey = fixtureCacheKey("inventory-second");
    await writeCache(
      baseDir,
      "jp_lit_search",
      firstKey,
      "2026-03-01T00:00:00.000Z"
    );
    await writeCache(
      baseDir,
      "jp_lit_search",
      secondKey,
      "2026-03-02T00:00:00.000Z"
    );
    const inventory = await listCacheInventory(baseDir, "jp_lit_search");
    const first = inventory.items.find((item) => item.cache_key === firstKey)!;
    const secondPath = path.join(
      getCacheRoot(baseDir),
      "jp_lit_search",
      `${secondKey}.json`
    );

    await removeInventoryItem({ ...first, path: secondPath }, baseDir);

    await expect(
      readCacheFile(baseDir, "current", "jp_lit_search", firstKey)
    ).rejects.toThrow();
    await expect(
      readCacheFile(baseDir, "current", "jp_lit_search", secondKey)
    ).resolves.toContain(secondKey);
  });
});
