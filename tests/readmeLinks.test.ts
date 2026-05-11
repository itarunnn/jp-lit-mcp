import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("README public onboarding", () => {
  it("links to app-specific install guides", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("docs/install/codex-app.md");
    expect(readme).toContain("docs/install/codex-cli.md");
    expect(readme).toContain("docs/install/cursor.md");
    expect(readme).toContain("docs/install/claude-code.md");
  });

  it("explains what MCP and Skills change for users", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("## 何ができるか");
    expect(readme).toContain("## Skills を使う理由");
    expect(readme).toContain("## 主な対応先");
  });

  it("links to the source usage conditions memo", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("docs/source-usage-conditions.md");
  });

  it("mentions the jp-lit verification skill and its role", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("jp-lit-verification");
    expect(readme).toContain("文献検証");
    expect(readme).toContain("実在性");
    expect(readme).toContain("最初の依頼例");
    expect(readme).toContain("使い方ガイド");
  });

  it("explains provisional organization and text-reading limits", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("仮整理");
    expect(readme).toContain("根拠");
    expect(readme).toContain("online=true");
    expect(readme).toContain("エージェントが本文を読んだことを意味しません");
    expect(readme).toContain("調査上の確認優先度");
    expect(readme).toContain("出版社や媒体だけで文献の価値を確定しません");
  });

  it("mentions session trace without changing CSL JSON expectations", () => {
    const readme = readFileSync("README.md", "utf8");
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    const reference = readFileSync("docs/reference.md", "utf8");

    expect(readme).toContain("調査経過");
    expect(readme).toContain("検索試行");
    expect(usageGuide).toContain("jp_lit_update_session_trace");
    expect(usageGuide).toContain("CSL JSON には調査経過");
    expect(reference).toContain("jp_lit_update_session_trace");
    expect(reference).toContain("source_plan_count");
    expect(reference).toContain("CSL JSON には trace を混ぜません");
  });

  it("documents offline bibliographies, indexes, and paid database limits in the usage guide", () => {
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    expect(usageGuide).toContain("参考書誌・索引・有料DB");
    expect(usageGuide).toContain("参考書誌確認");
    expect(usageGuide).toContain("有料DB");
    expect(usageGuide).toContain("要有料DB確認");
    expect(usageGuide).toContain("ざっさくプラス");
    expect(usageGuide).toContain("大宅壮一文庫");
    expect(usageGuide).toContain("毎回の注意書き");
  });

  it("documents the specialist explicit sources and fixed-source limits", () => {
    const readme = readFileSync("README.md", "utf8");
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    const projectStatus = readFileSync("docs/project-status.md", "utf8");

    expect(readme).toContain("nijl_articles");
    expect(readme).toContain("国文学論文");
    expect(readme).toContain("kokusho");
    expect(readme).toContain("国書・古典籍");
    expect(readme).toContain("jp_lit_search_kokusho_fulltext");
    expect(readme).toContain("jp_lit_search_kokusho_image_tags");
    expect(readme).toContain("ninjal_bibliography");
    expect(readme).toContain("日本語研究・日本語教育文献");

    expect(usageGuide).toContain("日本文学論文");
    expect(usageGuide).toContain("jp_lit_search(source=nijl_articles");
    expect(usageGuide).toContain("jp_lit_search(source=kokusho");
    expect(usageGuide).toContain("jp_lit_search_kokusho_fulltext");
    expect(usageGuide).toContain("jp_lit_search_kokusho_image_tags");
    expect(usageGuide).toContain("jp_lit_search(source=ninjal_bibliography");
    expect(usageGuide).toContain("文化資源 DB や地域アーカイブ DB は固定 source 化しません");

    expect(projectStatus).toContain("対応 source 19 種");
    expect(projectStatus).toContain("nijl_articles");
    expect(projectStatus).toContain("kokusho");
    expect(projectStatus).toContain("ninjal_bibliography");
  });
});
