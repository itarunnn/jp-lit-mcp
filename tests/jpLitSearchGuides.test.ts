import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitSearchGuidesCasesTool as createExplicitJpLitSearchGuidesCasesTool } from "../src/tools/jpLitSearchGuidesCases.js";
import { createJpLitSearchGuidesManualsTool as createExplicitJpLitSearchGuidesManualsTool } from "../src/tools/jpLitSearchGuidesManuals.js";
import { bindToolToCurrentSession } from "./helpers/explicitSession.js";

function createJpLitSearchGuidesCasesTool(...args: Parameters<typeof createExplicitJpLitSearchGuidesCasesTool>) {
  const sessions = args[2] ?? createSessionStore();
  return bindToolToCurrentSession(createExplicitJpLitSearchGuidesCasesTool(...args), sessions);
}

function createJpLitSearchGuidesManualsTool(...args: Parameters<typeof createExplicitJpLitSearchGuidesManualsTool>) {
  const sessions = args[2] ?? createSessionStore();
  return bindToolToCurrentSession(createExplicitJpLitSearchGuidesManualsTool(...args), sessions);
}

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-guides-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("jp_lit_search_guides_*", () => {
  it("調べ方マニュアル検索ツールが結果を返す", async () => {
    const baseDir = await createTempDir();
    const client = {
      searchManuals: vi.fn().mockResolvedValue({
        query: "常陸国風土記",
        type: "manual",
        page: 1,
        limit: 5,
        total: 1,
        items: [
          {
            id: "2000022249",
            title: "『常陸国風土記』について調べるには",
            provider: "茨城県立歴史館（閲覧室）",
            url: "https://crd.ndl.go.jp/reference/detail?page=man_view&id=2000022249",
            categories: ["常陸国風土記"],
            summary: "(1) 常陸国風土記とは",
            published_at: "Wed, 21 Aug 2013 12:26:46 JST",
            search_keywords: ["風土記"],
            guide_headings: ["原文を読む"],
            description: "full"
          }
        ],
        raw: {}
      }),
      searchCases: vi.fn()
    };
    const tool = createJpLitSearchGuidesManualsTool(
      client as never,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ query: "常陸国風土記", limit: 5, page: 1 });

    expect(client.searchManuals).toHaveBeenCalledWith({
      query: "常陸国風土記",
      limit: 5,
      page: 1
    });
    expect(result.structuredContent.items[0]).toMatchObject({
      id: "2000022249",
      provider: "茨城県立歴史館（閲覧室）"
    });
  });

  it("レファレンス事例検索ツールが結果を返す", async () => {
    const baseDir = await createTempDir();
    const client = {
      searchManuals: vi.fn(),
      searchCases: vi.fn().mockResolvedValue({
        query: "世界線",
        type: "reference",
        page: 1,
        limit: 5,
        total: 1,
        items: [
          {
            id: "1000322589",
            title: "「世界線」という言葉の語源は何か。なぜ使われるようになったのか。",
            provider: "京都府立高等学校図書館協議会司書部会",
            url: "https://crd.ndl.go.jp/reference/detail?page=ref_view&id=1000322589",
            categories: ["世界線"],
            summary: "『三省堂国語辞典 第八版』によると...",
            published_at: "Mon, 01 May 2023 14:04:22 JST",
            question: "「世界線」という言葉の語源は何か。なぜ使われるようになったのか。",
            answer_process: "まず国語辞典を確認した。",
            preliminary_research: "歌詞で見た",
            reference_sources: ["三省堂国語辞典 第8版"],
            description: "full"
          }
        ],
        raw: {}
      })
    };
    const tool = createJpLitSearchGuidesCasesTool(
      client as never,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ query: "世界線", limit: 5, page: 1 });

    expect(client.searchCases).toHaveBeenCalledWith({
      query: "世界線",
      limit: 5,
      page: 1
    });
    expect(result.structuredContent.items[0]).toMatchObject({
      id: "1000322589",
      provider: "京都府立高等学校図書館協議会司書部会"
    });
  });
});
