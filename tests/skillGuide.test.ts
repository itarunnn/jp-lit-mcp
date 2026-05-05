import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("jp-lit-research skill guide", () => {
  it("treats research as an iterative dialogue loop", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    expect(skill).toContain("対話的な探索ループ");
    expect(skill).toContain("生の結果を会話へ抱え込まない");
    expect(skill).toContain("## 原則: 計画を立てて確認してから検索する");
    expect(skill).toContain("cache / session を再確認");
    expect(skill).toContain("通常の探索ループ");
    expect(skill).toContain("主エージェントが文脈を持って進める");
    expect(skill).toContain("cache_key");
    expect(skill).toContain("session_id");
    expect(skill).toContain("selected_items.note");
    expect(skill).toContain("検索全体の選別理由");
    expect(skill).toContain("### 検索後の分岐");
    expect(skill).toContain("jp_lit_search_guides_manuals");
    expect(skill).toContain("jp_lit_search_guides_cases");
    expect(skill).toContain("文献DBで調べて");
    expect(skill).toContain("何回の検索を束ねたものか");
    expect(skill).toContain("全N件中M件取得");
    expect(skill).toContain("highlights");
    expect(skill).toContain("table_of_contents");
    expect(skill).toContain("仮整理");
    expect(skill).toContain("根拠");
    expect(skill).toContain("確認");
    expect(skill).toContain("本文");
    expect(skill).toContain("次");
    expect(skill).toContain("availability.online=true");
    expect(skill).toContain("本文を読んだものとして扱わない");
    expect(skill).toContain("調査上の確認優先度");
  });

  it("keeps evidence and priority rules in the detailed references", () => {
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

    expect(evidence).toContain("本文: オンライン入口あり未読");
    expect(evidence).toContain("次: 発信者プロフィール確認");
    expect(evidence).toContain("長い注意書きは毎件付けない");
    expect(grading).toContain("内容把握の確からしさ");
    expect(grading).toContain("出版社・媒体・シリーズだけで文献の価値を確定しない");
    expect(workflow).toContain("本文未読の内容別・論点別分類");
    expect(workflow).toContain("優先");
  });
});
