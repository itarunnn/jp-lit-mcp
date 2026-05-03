import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("jp-lit-verification skill guide", () => {
  it("describes pasted-text bibliography verification", () => {
    const skill = readFileSync("skills/jp-lit-verification/SKILL.md", "utf8");
    expect(skill).toContain("文献検証");
    expect(skill).toContain("ndl_search");
    expect(skill).toContain("実在確認済み");
    expect(skill).toContain("混線の疑い");
    expect(skill).toContain("表");
  });

  it("requires detailed reasons and a main table plus weak-candidate section", () => {
    const skill = readFileSync("skills/jp-lit-verification/SKILL.md", "utf8");
    expect(skill).toContain("判定理由");
    expect(skill).toContain("文献候補として弱い抽出");
    expect(skill).toContain("一致した根拠");
    expect(skill).toContain("不一致点");
    expect(skill).toContain("highlights");
    expect(skill).toContain("table_of_contents");
  });

  it("uses ndl_search as the first verification gate and source-specific follow-up only when needed", () => {
    const skill = readFileSync("skills/jp-lit-verification/SKILL.md", "utf8");
    expect(skill).toContain("jp_lit_search(source=ndl_search");
    expect(skill).toContain("必要なら個別 source で再確認");
    expect(skill).toContain("cinii_articles");
    expect(skill).toContain("ndl_catalog");
  });

  it("documents context-saving behavior for long verification sessions", () => {
    const skill = readFileSync("skills/jp-lit-verification/SKILL.md", "utf8");
    expect(skill).toContain("生の検索結果を会話へ大量に貼り付けず");
    expect(skill).toContain("必要時だけ再読込");
    expect(skill).toContain("候補抽出、一次検証、判定理由の確定は主エージェント");
    expect(skill).toContain("単独エージェントで成立");
  });
});
