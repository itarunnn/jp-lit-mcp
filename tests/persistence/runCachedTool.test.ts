import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../../src/lib/persistence/fileCache.js";
import { runCachedTool } from "../../src/lib/persistence/runCachedTool.js";
import { createSessionStore } from "../../src/lib/persistence/sessionStore.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ndl-jp-lit-run-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runCachedTool", () => {
  it("returns cached structured content on second call", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const live = vi.fn(async () => ({ total: 1 }));

    const first = await runCachedTool({
      tool: "jp_lit_search",
      input: { query: "foo", page: 1 },
      live,
      cache,
      sessions
    });

    const second = await runCachedTool({
      tool: "jp_lit_search",
      input: { page: 1, query: "foo" },
      live,
      cache,
      sessions
    });

    expect(first.structuredContent).toEqual({ total: 1 });
    expect(second.structuredContent).toEqual({ total: 1 });
    expect(live).toHaveBeenCalledTimes(1);

    const session = await sessions.readCurrent();
    expect(session.entries).toHaveLength(1);
    expect(session.entries[0]?.cache_key).toBe(first.cacheKey);
  });
});
