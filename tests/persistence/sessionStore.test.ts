import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSessionStore } from "../../src/lib/persistence/sessionStore.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ndl-jp-lit-session-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("session store", () => {
  it("creates current session and appends entries", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);

    const session = await store.appendEntry({
      tool: "jp_lit_search",
      input: { query: "foo" },
      cache_key: "sha256-a",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-a"
      },
      selected_items: [],
      notes: []
    });

    expect(session.entries).toHaveLength(1);
    expect(session.entries[0]?.tool).toBe("jp_lit_search");
  });

  it("updates selected items by tool and cache key", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);

    await store.appendEntry({
      tool: "jp_lit_search",
      input: { query: "foo" },
      cache_key: "sha256-a",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-a"
      },
      selected_items: [],
      notes: []
    });

    const session = await store.annotateEntry({
      tool: "jp_lit_search",
      cache_key: "sha256-a",
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "123",
          title: "foo",
          label: "strong_candidate",
          note: "first pass"
        }
      ],
      notes: ["kept for review"]
    });

    expect(session.entries[0]?.selected_items).toHaveLength(1);
    expect(session.entries[0]?.notes).toEqual(["kept for review"]);
  });

  it("fails when annotation target does not exist", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);

    await expect(
      store.annotateEntry({
        tool: "jp_lit_search",
        cache_key: "missing",
        selected_items: [],
        notes: []
      })
    ).rejects.toThrow("Session entry not found");
  });
});
