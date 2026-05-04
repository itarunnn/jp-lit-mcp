import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitResolveAuthorityTool } from "../src/tools/jpLitResolveAuthority.js";

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

describe("jp_lit_resolve_authority", () => {
  it("人名典拠の別名義を same_identity_names と search_hints に分けて返す", async () => {
    const client = {
      resolve: vi.fn().mockResolvedValue({
        query: "色川武大",
        type: "person",
        total: 1,
        limit: 5,
        items: [
          {
            authority_uri: "https://id.ndl.go.jp/auth/ndlna/00020172",
            id: "00020172",
            type: "person",
            label: "色川, 武大, 1929-1989",
            label_reading: "イロカワ, タケヒロ, 1929-1989",
            label_romanized: "Irokawa, Takehiro, 1929-1989",
            variant_labels: ["色川, 武大 (イロカワ, ブダイ)"],
            same_identity_names: [
              {
                label: "阿佐田, 哲也, 1929-1989",
                authority_uri: "https://id.ndl.go.jp/auth/ndlna/00001930",
                relation: "pseudonym",
                relation_label: "筆名"
              }
            ],
            broader_terms: [],
            narrower_terms: [],
            related_terms: [],
            source_metadata: {}
          }
        ],
        search_hints: {
          preferred_terms: ["色川武大"],
          variant_terms: ["色川武大"],
          same_identity_terms: ["阿佐田哲也"],
          reference_terms: [],
          caution: "same_identity_terms は同一人物・同一団体の別名義です。名義別に探す場合とまとめて探す場合を分けてください。"
        }
      })
    };
    const baseDir = await createTempDir();
    const tool = createJpLitResolveAuthorityTool(
      client,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ query: "色川武大", type: "person", limit: 5 });

    expect(client.resolve).toHaveBeenCalledWith({
      query: "色川武大",
      type: "person",
      limit: 5
    });
    expect(result.structuredContent.items[0].same_identity_names[0]).toMatchObject({
      label: "阿佐田, 哲也, 1929-1989",
      relation: "pseudonym"
    });
    expect(result.structuredContent.search_hints.same_identity_terms).toEqual([
      "阿佐田哲也"
    ]);
  });
});
