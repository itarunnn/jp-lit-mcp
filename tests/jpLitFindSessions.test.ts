import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { getSessionsRoot } from "../src/lib/persistence/paths.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitFindSessionsTool } from "../src/tools/jpLitFindSessions.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ndl-jp-lit-find-sessions-"));
  tempDirs.push(dir);
  return dir;
}

async function createSession(
  baseDir: string,
  sessionId: string,
  createdAt: string,
  updatedAt: string,
  entry: {
    query: string;
    selectedTitles?: string[];
    notes?: string[];
  }
) {
  const sessionsRoot = getSessionsRoot(baseDir);
  await mkdir(sessionsRoot, { recursive: true });
  const document = {
    session_id: sessionId,
    created_at: createdAt,
    updated_at: updatedAt,
    entries: [
      {
        tool: "jp_lit_search",
        input: { query: entry.query },
        cache_key: `sha256-${sessionId}`,
        result_ref: {
          tool: "jp_lit_search",
          cache_key: `sha256-${sessionId}`
        },
        selected_items: (entry.selectedTitles ?? []).map((title, index) => ({
          source: "ndl_catalog",
          source_id: `${sessionId}-${index}`,
          title,
          label: "strong_candidate" as const,
          note: null
        })),
        notes: entry.notes ?? []
      }
    ]
  };

  await writeFile(
    path.join(sessionsRoot, `${sessionId}.json`),
    JSON.stringify(document, null, 2),
    "utf8"
  );
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_find_sessions", () => {
  it("matches query text", async () => {
    const baseDir = await createTempDir();
    await createSession(
      baseDir,
      "2026-05-01-090000",
      "2026-05-01T09:00:00.000Z",
      "2026-05-01T09:10:00.000Z",
      { query: "夏目漱石 初版" }
    );
    const tool = createJpLitFindSessionsTool(createSessionStore(baseDir));

    const result = await tool({ query: "夏目漱石" });

    expect(result.structuredContent.query).toBe("夏目漱石");
    expect(result.structuredContent.limit).toBe(10);
    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.items[0]?.query_preview).toBe("夏目漱石 初版");
    expect(result.structuredContent.items[0]?.matched_fields).toEqual(["query"]);
  });

  it("matches selected item titles", async () => {
    const baseDir = await createTempDir();
    await createSession(
      baseDir,
      "2026-05-01-091000",
      "2026-05-01T09:10:00.000Z",
      "2026-05-01T09:20:00.000Z",
      { query: "文学", selectedTitles: ["坊っちゃん" ] }
    );
    const tool = createJpLitFindSessionsTool(createSessionStore(baseDir));

    const result = await tool({ query: "坊っちゃん" });

    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.items[0]?.query_preview).toBe("文学");
    expect(result.structuredContent.items[0]?.matched_fields).toEqual(["selected_title"]);
  });

  it("matches notes text", async () => {
    const baseDir = await createTempDir();
    await createSession(
      baseDir,
      "2026-05-01-092000",
      "2026-05-01T09:20:00.000Z",
      "2026-05-01T09:30:00.000Z",
      { query: "近代文学", notes: ["復刻版を後で確認"] }
    );
    const tool = createJpLitFindSessionsTool(createSessionStore(baseDir));

    const result = await tool({ query: "復刻版" });

    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.items[0]?.matched_fields).toEqual(["notes"]);
  });

  it("returns null query_preview when a matched session has no query text", async () => {
    const baseDir = await createTempDir();
    const sessionsRoot = getSessionsRoot(baseDir);
    await mkdir(sessionsRoot, { recursive: true });
    await writeFile(
      path.join(sessionsRoot, "2026-05-01-092500.json"),
      JSON.stringify(
        {
          session_id: "2026-05-01-092500",
          created_at: "2026-05-01T09:25:00.000Z",
          updated_at: "2026-05-01T09:26:00.000Z",
          entries: [
            {
              tool: "jp_lit_search",
              input: {},
              cache_key: "sha256-null-query",
              result_ref: {
                tool: "jp_lit_search",
                cache_key: "sha256-null-query"
              },
              selected_items: [],
              notes: ["近世資料を確認"]
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );
    const tool = createJpLitFindSessionsTool(createSessionStore(baseDir));

    const result = await tool({ query: "近世資料" });

    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.items[0]?.query_preview).toBeNull();
  });

  it("returns empty items when there are no matches", async () => {
    const baseDir = await createTempDir();
    await createSession(
      baseDir,
      "2026-05-01-093000",
      "2026-05-01T09:30:00.000Z",
      "2026-05-01T09:40:00.000Z",
      { query: "国文学" }
    );
    const tool = createJpLitFindSessionsTool(createSessionStore(baseDir));

    const result = await tool({ query: "該当なし" });

    expect(result.structuredContent.query).toBe("該当なし");
    expect(result.structuredContent.limit).toBe(10);
    expect(result.structuredContent.total).toBe(0);
    expect(result.structuredContent.items).toEqual([]);
  });

  it("applies limit after sorting by updated_at descending", async () => {
    const baseDir = await createTempDir();
    await createSession(
      baseDir,
      "2026-05-01-094000",
      "2026-05-01T09:40:00.000Z",
      "2026-05-01T09:41:00.000Z",
      { query: "和歌" }
    );
    await createSession(
      baseDir,
      "2026-05-01-095000",
      "2026-05-01T09:50:00.000Z",
      "2026-05-01T09:51:00.000Z",
      { query: "和歌集" }
    );
    const tool = createJpLitFindSessionsTool(createSessionStore(baseDir));

    const result = await tool({ query: "和歌", limit: 1 });

    expect(result.structuredContent.limit).toBe(1);
    expect(result.structuredContent.total).toBe(2);
    expect(result.structuredContent.items).toHaveLength(1);
    expect(result.structuredContent.items[0]?.session_id).toBe("2026-05-01-095000");
  });

  it("returns matches in updated_at descending order", async () => {
    const baseDir = await createTempDir();
    await createSession(
      baseDir,
      "2026-05-01-100000",
      "2026-05-01T10:00:00.000Z",
      "2026-05-01T10:01:00.000Z",
      { query: "俳句" }
    );
    await createSession(
      baseDir,
      "2026-05-01-101000",
      "2026-05-01T10:10:00.000Z",
      "2026-05-01T10:11:00.000Z",
      { query: "俳句選集" }
    );
    const tool = createJpLitFindSessionsTool(createSessionStore(baseDir));

    const result = await tool({ query: "俳句" });

    expect(result.structuredContent.items.map((item) => item.session_id)).toEqual([
      "2026-05-01-101000",
      "2026-05-01-100000"
    ]);
  });

  it("normalizes ascii case and whitespace before matching", async () => {
    const baseDir = await createTempDir();
    await createSession(
      baseDir,
      "2026-05-01-102000",
      "2026-05-01T10:20:00.000Z",
      "2026-05-01T10:21:00.000Z",
      { query: "NDL　Search API" }
    );
    const tool = createJpLitFindSessionsTool(createSessionStore(baseDir));

    const result = await tool({ query: "ndl search" });

    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.items[0]?.matched_fields).toEqual(["query"]);
    expect(result.structuredContent.items[0]?.query_preview).toBe("NDL Search API");
  });
});
