import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitSearchKakenProjectsTool } from "../src/tools/jpLitSearchKakenProjects.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-kaken-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("jp_lit_search_kaken_projects", () => {
  it("KAKEN 課題検索をキャッシュ可能な MCP tool として返す", async () => {
    const baseDir = await createTempDir();
    const client = {
      searchProjects: vi.fn().mockResolvedValue({
        query: "IIIF",
        page: 1,
        limit: 1,
        total: 1,
        items: [
          {
            project_id: "19K20626",
            title: "IIIFとTEIを用いたオンライン翻刻支援システムの開発",
            url: "https://kaken.nii.ac.jp/ja/grant/KAKENHI-PROJECT-19K20626/",
            principal_investigator: {
              name: "中村 覚",
              affiliation: "東京大学 史料編纂所",
              researcher_number: "80802743"
            },
            fiscal_years: "2019-04-01 - 2023-03-31",
            project_type: "若手研究",
            fields: ["人文情報学"],
            keywords: ["IIIF"],
            summary: "研究概要",
            detail_fetched: true,
            detail_omitted_reason: null,
            report_pdf_status: "found",
            report_pdfs: [
              {
                label: "研究成果報告書",
                fiscal_year: null,
                url: "https://kaken.nii.ac.jp/file/KAKENHI-PROJECT-19K20626/19K20626seika.pdf"
              }
            ],
            outputs_preview: [],
            search_hints: {
              project_terms: ["IIIFとTEIを用いたオンライン翻刻支援システムの開発"],
              researcher_terms: ["中村 覚"],
              keyword_terms: ["IIIF"],
              caution:
                "KAKEN は研究課題・報告書の入口です。成果リスト中の論文・図書は、CiNii / J-STAGE / IRDB / NDL などで文献として確認してください。"
            }
          }
        ]
      })
    };
    const tool = createJpLitSearchKakenProjectsTool(
      client as never,
      createFileCache(baseDir),
      createSessionStore(baseDir)
    );

    const result = await tool({ query: "IIIF", limit: 1, detail_limit: 1 });

    expect(client.searchProjects).toHaveBeenCalledWith({
      query: "IIIF",
      limit: 1,
      page: 1,
      detail_limit: 1,
      include_outputs: true
    });
    expect(result.structuredContent.items[0].report_pdf_status).toBe("found");
    expect(result.structuredContent.items[0].search_hints.caution).toContain("KAKEN は研究課題");
  });
});
