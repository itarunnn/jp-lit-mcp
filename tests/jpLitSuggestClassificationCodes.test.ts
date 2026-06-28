import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitSuggestClassificationCodesTool } from "../src/tools/jpLitSuggestClassificationCodes.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-class-codes-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_suggest_classification_codes", () => {
  it("件名語から CiNii Books category 候補と suggested_search を返す", async () => {
    const client = {
      suggestClassificationCodes: vi.fn().mockResolvedValue({
        term: "近代日本文学",
        schemes: ["NDC10", "NDLC"],
        concept_limit: 5,
        max_codes: 10,
        total_concepts: 1,
        total_codes: 2,
        used_codes: [
          {
            scheme: "NDC10",
            notation: "910.26",
            uri: "http://id.ndl.go.jp/class/ndc10/910.26"
          },
          {
            scheme: "NDLC",
            notation: "KG311",
            uri: "http://id.ndl.go.jp/class/ndlc/KG311"
          }
        ],
        items: [
          {
            authority_uri: "https://id.ndl.go.jp/auth/ndlsh/00563962",
            id: "00563962",
            label: "日本文学--歴史--明治以後",
            variant_labels: ["近代日本文学"],
            classification_codes: [
              {
                scheme: "NDC10",
                notation: "910.26",
                uri: "http://id.ndl.go.jp/class/ndc10/910.26"
              },
              {
                scheme: "NDLC",
                notation: "KG311",
                uri: "http://id.ndl.go.jp/class/ndlc/KG311"
              }
            ]
          }
        ],
        suggested_category_param: "910.26 KG311",
        suggested_search: {
          tool: "jp_lit_search",
          args: {
            query: "近代日本文学",
            source: "cinii_books",
            filters: {
              cinii: {
                category: "910.26 KG311"
              }
            }
          }
        },
        caution: "分類記号は未知の図書探索を広げる補助線です。"
      })
    };
    const baseDir = await createTempDir();
    const tool = createJpLitSuggestClassificationCodesTool(
      client,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({
      term: "近代日本文学",
      schemes: ["NDC10", "NDLC"]
    });

    expect(client.suggestClassificationCodes).toHaveBeenCalledWith({
      term: "近代日本文学",
      schemes: ["NDC10", "NDLC"],
      concept_limit: 5,
      max_codes: 10
    });
    expect(result.structuredContent.suggested_category_param).toBe("910.26 KG311");
    expect(result.structuredContent.suggested_search?.args.filters.cinii.category).toBe("910.26 KG311");
    expect(result.structuredContent.cache?.hit).toBe(false);
  });
});
