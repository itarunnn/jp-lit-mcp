import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("jp-lit-research skill guide", () => {
  it("keeps SKILL.md as a lightweight router with mandatory output contracts", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");

    const lineCount = skill.split(/\r?\n/).length;
    expect(lineCount).toBeLessThanOrEqual(200);

    expect(skill).toContain("## 起動条件");
    expect(skill).toContain("## 必ず守る");
    expect(skill).toContain("## 最小ワークフロー");
    expect(skill).toContain("## intent 分類");
    expect(skill).toContain("## 参照ファイル");
    expect(skill).toContain("## 標準出力テンプレート");
    expect(skill).toContain("## 最終回答前チェック");

    expect(skill).toContain("文献DBで調べて");
    expect(skill).toContain("一度発火したらセッション中は継続");
    expect(skill).toContain("検索前に短い調査方針");
    expect(skill).toContain("継続指示");
    expect(skill).toContain("調査ログ");
    expect(skill).toContain("| # | source | query | total | 取得件数 | 抽出件数 | 備考 |");
    expect(skill).toContain("availability.online=true");
    expect(skill).toContain("本文: オンライン入口あり未読");
    expect(skill).toContain("本文: 確認済み");
    expect(skill).toContain("今回の確認範囲");
  });

  it("routes detailed workflow, source, evidence, and cache guidance to references", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    expect(skill).toContain("reference/01-core-workflow.md");
    expect(skill).toContain("reference/02-source-and-query.md");
    expect(skill).toContain("reference/03-evidence-and-output.md");
    expect(skill).toContain("heuristics/source-selection.md");
    expect(skill).toContain("heuristics/query-expansion.md");
    expect(skill).toContain("heuristics/evidence-grading.md");
    expect(skill).toContain("heuristics/failure-modes.md");
    expect(skill).toContain("workflows/");

    const workflowCore = readFileSync(
      "skills/jp-lit-research/reference/01-core-workflow.md",
      "utf8"
    );
    const sourceAndQuery = readFileSync(
      "skills/jp-lit-research/reference/02-source-and-query.md",
      "utf8"
    );
    const evidence = readFileSync(
      "skills/jp-lit-research/reference/03-evidence-and-output.md",
      "utf8"
    );
    const grading = readFileSync(
      "skills/jp-lit-research/heuristics/evidence-grading.md",
      "utf8"
    );
    const workflow = readFileSync(
      "skills/jp-lit-research/workflows/topic-literature-review.md",
      "utf8"
    );

    expect(workflowCore).toContain("対話的な探索ループ");
    expect(workflowCore).toContain("cache_key");
    expect(workflowCore).toContain("session_id");
    expect(workflowCore).toContain("jp_lit_refine_results");
    expect(sourceAndQuery).toContain("jp_lit_search_guides_manuals");
    expect(sourceAndQuery).toContain("jp_lit_search_guides_cases");
    expect(sourceAndQuery).toContain("全N件中M件取得");
    expect(sourceAndQuery).toContain("source 未指定の横断検索は `page=1` のみ対応");
    expect(evidence).toContain("本文: オンライン入口あり未読");
    expect(evidence).toContain("availability.online=true");
    expect(evidence).toContain("highlights");
    expect(evidence).toContain("table_of_contents");
    expect(evidence).toContain("selected_items.note");
    expect(evidence).toContain("検索全体の選別理由");
    expect(evidence).toContain("次: 発信者プロフィール確認");
    expect(evidence).toContain("長い注意書きは毎件付けない");
    expect(grading).toContain("内容把握の確からしさ");
    expect(grading).toContain("出版社・媒体・シリーズだけで文献の価値を確定しない");
    expect(workflow).toContain("本文未読の内容別・論点別分類");
    expect(workflow).toContain("優先");
  });
});
