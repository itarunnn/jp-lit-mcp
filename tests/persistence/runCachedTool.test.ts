import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../../src/lib/persistence/fileCache.js";
import { runCachedTool } from "../../src/lib/persistence/runCachedTool.js";
import { createSessionStore } from "../../src/lib/persistence/sessionStore.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-run-"));
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
    const targetSession = await sessions.readCurrent();
    const live = vi.fn(async () => ({ total: 1 }));

    const first = await runCachedTool({
      tool: "jp_lit_search",
      input: { query: "foo", page: 1 },
      sessionId: targetSession.session_id,
      live,
      cache,
      sessions
    });

    const second = await runCachedTool({
      tool: "jp_lit_search",
      input: { page: 1, query: "foo" },
      sessionId: targetSession.session_id,
      live,
      cache,
      sessions
    });

    expect(first.structuredContent).toEqual({ total: 1 });
    expect(second.structuredContent).toEqual({ total: 1 });
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(live).toHaveBeenCalledTimes(1);

    const storedSession = await sessions.readCurrent();
    expect(storedSession.entries).toHaveLength(1);
    expect(storedSession.entries[0]?.cache_key).toBe(first.cacheKey);
  });

  it("bypassCache=true のときは毎回 live を実行する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const targetSession = await sessions.readCurrent();
    const live = vi
      .fn()
      .mockResolvedValueOnce({ total: 1 })
      .mockResolvedValueOnce({ total: 2 });

    const first = await runCachedTool({
      tool: "jp_lit_search",
      input: { query: "foo", page: 1 },
      sessionId: targetSession.session_id,
      live,
      cache,
      sessions,
      bypassCache: true
    });
    const second = await runCachedTool({
      tool: "jp_lit_search",
      input: { query: "foo", page: 1 },
      sessionId: targetSession.session_id,
      live,
      cache,
      sessions,
      bypassCache: true
    });

    expect(live).toHaveBeenCalledTimes(2);
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(false);
    expect(second.structuredContent).toEqual({ total: 2 });
  });

  it("shares cache results while routing entries to explicit sessions", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const firstSession = await sessions.startSession({ research_goal: "first" });
    const secondSession = await sessions.startSession({ research_goal: "second" });
    const live = vi.fn(async () => ({ total: 1 }));

    const first = await runCachedTool({
      tool: "jp_lit_search",
      input: { query: "foo", page: 1 },
      sessionId: firstSession.session_id,
      live,
      cache,
      sessions
    });
    const second = await runCachedTool({
      tool: "jp_lit_search",
      input: { query: "foo", page: 1 },
      sessionId: secondSession.session_id,
      live,
      cache,
      sessions
    });

    expect(second.cacheKey).toBe(first.cacheKey);
    expect(live).toHaveBeenCalledTimes(1);
    expect((await sessions.readById(firstSession.session_id)).entries).toHaveLength(1);
    expect((await sessions.readById(secondSession.session_id)).entries).toHaveLength(1);
  });
});
