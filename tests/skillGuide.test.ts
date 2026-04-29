import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("jp-lit-research skill guide", () => {
  it("treats research as an iterative dialogue loop", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    expect(skill).toContain("対話的な探索ループ");
    expect(skill).toContain("## 原則: まず小さく試し、結果を見て次を決める");
    expect(skill).toContain("### 検索後の分岐");
  });
});
