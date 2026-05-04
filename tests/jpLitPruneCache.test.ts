import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createJpLitPruneCacheTool } from "../src/tools/jpLitPruneCache.js";

const tempDirs: string[] = [];

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
    await writeCache(baseDir, "jp_lit_search", "old", "2026-04-01T00:00:00.000Z");
    await writeCache(baseDir, "jp_lit_search", "new", "2026-05-04T00:00:00.000Z");
    const tool = createJpLitPruneCacheTool(
      baseDir,
      () => new Date("2026-05-05T00:00:00.000Z")
    );

    const result = await tool({ older_than_days: 30 });

    expect(result.structuredContent.dry_run).toBe(true);
    expect(result.structuredContent.matched_count).toBe(1);
    expect(result.structuredContent.pruned_count).toBe(0);
    expect(result.structuredContent.candidates.map((item) => item.cache_key)).toEqual(["old"]);
    await expect(
      readFile(
        path.join(baseDir, ".cache/jp-lit-mcp/cache/v1/jp_lit_search/old.json"),
        "utf8"
      )
    ).resolves.toContain("old");
  });

  it("deletes old cache only when dry_run is false", async () => {
    const baseDir = await createTempDir();
    await writeCache(baseDir, "jp_lit_search", "old", "2026-04-01T00:00:00.000Z");
    await writeCache(baseDir, "jp_lit_search", "new", "2026-05-04T00:00:00.000Z");
    const tool = createJpLitPruneCacheTool(
      baseDir,
      () => new Date("2026-05-05T00:00:00.000Z")
    );

    const result = await tool({ older_than_days: 30, dry_run: false });

    expect(result.structuredContent.matched_count).toBe(1);
    expect(result.structuredContent.pruned_count).toBe(1);
    await expect(readCacheFile(baseDir, "current", "jp_lit_search", "old")).rejects.toThrow();
    await expect(readCacheFile(baseDir, "current", "jp_lit_search", "new")).resolves.toContain("new");
  });

  it("filters candidates by tool and respects limit", async () => {
    const baseDir = await createTempDir();
    await writeCache(baseDir, "jp_lit_search", "search-old", "2026-04-01T00:00:00.000Z");
    await writeCache(baseDir, "jp_lit_get_record", "record-old-1", "2026-03-01T00:00:00.000Z");
    await writeCache(baseDir, "jp_lit_get_record", "record-old-2", "2026-03-02T00:00:00.000Z");
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
      "record-old-1"
    ]);
  });

  it("includes legacy cache root candidates", async () => {
    const baseDir = await createTempDir();
    await writeRawCacheFile(
      baseDir,
      "legacy",
      "jp_lit_search",
      "legacy-old.json",
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: "legacy-old",
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
        cache_key: "legacy-old",
        root: "legacy"
      })
    ]);
  });

  it("removes the exact legacy path without deleting same-key current cache", async () => {
    const baseDir = await createTempDir();
    await writeCache(baseDir, "jp_lit_search", "same-key", "2026-05-04T00:00:00.000Z");
    await writeRawCacheFile(
      baseDir,
      "legacy",
      "jp_lit_search",
      "same-key.json",
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: "same-key",
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
    await expect(readCacheFile(baseDir, "legacy", "jp_lit_search", "same-key")).rejects.toThrow();
    await expect(readCacheFile(baseDir, "current", "jp_lit_search", "same-key")).resolves.toContain(
      "same-key"
    );
  });

  it("skips malformed files and tool directory mismatches", async () => {
    const baseDir = await createTempDir();
    await writeRawCacheFile(baseDir, "current", "jp_lit_search", "bad-json.json", "{");
    await writeRawCacheFile(
      baseDir,
      "current",
      "jp_lit_search",
      "bad-date.json",
      JSON.stringify({
        version: 1,
        tool: "jp_lit_search",
        cache_key: "bad-date",
        saved_at: "not-a-date",
        input: {},
        structured_content: {}
      })
    );
    await writeRawCacheFile(
      baseDir,
      "current",
      "jp_lit_search",
      "wrong-tool.json",
      JSON.stringify({
        version: 1,
        tool: "jp_lit_get_record",
        cache_key: "wrong-tool",
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
});
