import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("jp-lit-research skill guide", () => {
  it("treats research as an iterative dialogue loop", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    expect(skill).toContain("対話的な探索ループ");
    expect(skill).toContain("生の結果を会話へ抱え込まない");
    expect(skill).toContain("## 原則: 計画を立てて確認してから検索する");
    expect(skill).toContain("cache / session を再確認");
    expect(skill).toContain("selected_items.note");
    expect(skill).toContain("検索全体の選別理由");
    expect(skill).toContain("### 検索後の分岐");
    expect(skill).toContain("jp_lit_search_guides_manuals");
    expect(skill).toContain("jp_lit_search_guides_cases");
    expect(skill).toContain("文献DBで調べて");
    expect(skill).toContain("何回の検索を束ねたものか");
    expect(skill).toContain("全N件中M件取得");
  });
});
