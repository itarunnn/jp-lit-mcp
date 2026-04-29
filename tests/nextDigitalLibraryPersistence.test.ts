import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { getCacheRoot, getSessionsRoot } from "../src/lib/persistence/paths.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitGetFulltextTool } from "../src/tools/jpLitGetFulltext.js";
import { createJpLitSearchFulltextTool } from "../src/tools/jpLitSearchFulltext.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ndl-jp-lit-nextdl-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const BASE_RECORD = {
  source: "ndl_digital",
  source_id: "R100000039-I1000732",
  title: "国立国会図書館年報",
  source_metadata: {
    next_digital_library: {
      pid: "1000732",
      available: true,
      reason: null,
      book_api_url: "https://lab.ndl.go.jp/dl/api/book/1000732"
    }
  }
};

function makeRecordService(record: unknown) {
  return {
    getRecord: vi.fn().mockResolvedValue(record)
  } as ReturnType<typeof import("../src/services/recordService.js").createRecordService>;
}

describe("next digital library persistence", () => {
  it("stores heavy fulltext payloads in cache and reuses them on the second call", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const fulltextPayload = {
      list: [{ id: "1000732_1", page: 1, contents: "国立国会図書館" }],
      hit: 1,
      from: 0
    };
    const nextDlClient = {
      getBook: vi.fn(),
      getPage: vi.fn(),
      getFulltextJson: vi.fn().mockResolvedValue(fulltextPayload)
    };
    const tool = createJpLitGetFulltextTool(
      makeRecordService(BASE_RECORD),
      nextDlClient,
      cache,
      sessions
    );

    const first = await tool({ source: "ndl_digital", source_id: "R100000039-I1000732" });
    const second = await tool({ source: "ndl_digital", source_id: "R100000039-I1000732" });

    expect(first.structuredContent).toEqual(second.structuredContent);
    expect(nextDlClient.getFulltextJson).toHaveBeenCalledTimes(1);

    const sessionText = await readFile(path.join(getSessionsRoot(baseDir), "current.json"), "utf8");
    expect(sessionText).not.toContain("国立国会図書館");

    const toolCacheDir = path.join(getCacheRoot(baseDir), "jp_lit_get_fulltext");
    const cacheFiles = (await import("node:fs/promises")).readdir(toolCacheDir);
    await expect(cacheFiles).resolves.toHaveLength(1);
  });

  it("stores fulltext search results in cache and session only keeps the cache reference", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const searchPayload = {
      list: [
        {
          id: "897115",
          title: "帝国図書館一覧",
          responsibility: "帝国図書館 編",
          page: 62,
          isClassic: false,
          highlights: ["大政奉還後の図書館行政について"]
        }
      ],
      hit: 1,
      from: 0
    };
    const nextDlClient = {
      getBook: vi.fn(),
      getPage: vi.fn(),
      getFulltextJson: vi.fn(),
      searchPages: vi.fn(),
      searchBooks: vi.fn().mockResolvedValue(searchPayload)
    };
    const tool = createJpLitSearchFulltextTool(nextDlClient, cache, sessions);

    await tool({ keyword: "大政奉還" });
    await tool({ keyword: "大政奉還" });

    expect(nextDlClient.searchBooks).toHaveBeenCalledTimes(1);

    const sessionText = await readFile(path.join(getSessionsRoot(baseDir), "current.json"), "utf8");
    const session = JSON.parse(sessionText) as { entries: Array<{ result_ref: { tool: string } }> };
    expect(session.entries).toHaveLength(1);
    expect(session.entries[0]?.result_ref.tool).toBe("jp_lit_search_fulltext");
    expect(sessionText).not.toContain("帝国図書館一覧");
  });
});
