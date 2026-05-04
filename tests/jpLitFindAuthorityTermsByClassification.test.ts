import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitFindAuthorityTermsByClassificationTool } from "../src/tools/jpLitFindAuthorityTermsByClassification.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-authority-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_find_authority_terms_by_classification", () => {
  it("分類から件名標目候補と検索ヒントを返す", async () => {
    const client = {
      findTermsByClassification: vi.fn().mockResolvedValue({
        classification: { scheme: "NDC10", notation: "596.7" },
        total: 2,
        limit: 20,
        items: [
          {
            authority_uri: "https://id.ndl.go.jp/auth/ndlsh/00566222",
            id: "00566222",
            type: "subject",
            label: "コーヒー",
            label_reading: null,
            label_romanized: null,
            variant_labels: ["珈琲"],
            same_identity_names: [],
            broader_terms: [],
            narrower_terms: [],
            related_terms: [],
            source_metadata: {
              classification: "http://id.ndl.go.jp/class/ndc10/596.7"
            }
          },
          {
            authority_uri: "https://id.ndl.go.jp/auth/ndlsh/00573562",
            id: "00573562",
            type: "subject",
            label: "茶",
            label_reading: null,
            label_romanized: null,
            variant_labels: [],
            same_identity_names: [],
            broader_terms: [],
            narrower_terms: [],
            related_terms: [],
            source_metadata: {
              classification: "http://id.ndl.go.jp/class/ndc10/596.7"
            }
          }
        ],
        search_hints: {
          preferred_terms: ["コーヒー", "茶"],
          reference_terms: ["珈琲"],
          caution: "分類から得た件名標目は探索語候補です。分類範囲が広い場合は、調査意図に合わせて絞り込んでください。"
        }
      })
    };
    const baseDir = await createTempDir();
    const tool = createJpLitFindAuthorityTermsByClassificationTool(
      client,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ classification: "596.7", scheme: "NDC10" });

    expect(client.findTermsByClassification).toHaveBeenCalledWith({
      classification: "596.7",
      scheme: "NDC10",
      limit: 20
    });
    expect(result.structuredContent.search_hints.preferred_terms).toEqual([
      "コーヒー",
      "茶"
    ]);
  });
});
