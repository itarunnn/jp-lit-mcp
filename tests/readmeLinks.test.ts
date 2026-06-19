import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("README public onboarding", () => {
  it("links to install guides", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("docs/install/codex-app.md");
    expect(readme).toContain("docs/install/codex-cli.md");
    expect(readme).toContain("docs/install/cursor.md");
    expect(readme).toContain("docs/install/claude-code.md");
    expect(readme).toContain("docs/install/github-skills.md");
  });

  it("presents Skill-first onboarding instead of a tool catalog", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("## Skill と MCP の役割");
    expect(readme).toContain("## 最短導入");
    expect(readme).toContain("## 最初の依頼例");
    expect(readme).toContain("## MCP 単体で使う場合");
    expect(readme).not.toContain("npx -y jp-lit-mcp install-skills codex");
    expect(readme).toContain("MCP は検索・取得の道具");
    expect(readme).toContain("Skills によって実際の調査を進めます");
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

    expect(readme).toContain("NDL Search");
    expect(readme).toContain("CiNii");
    expect(readme).toContain("J-STAGE");
    expect(readme).toContain("国書");
    expect(readme).toContain("国会・帝国議会会議録");
    expect(readme).toContain("docs/reference.md");

    expect(usageGuide).toContain("日本文学論文");
    expect(usageGuide).toContain("jp_lit_search(source=nijl_articles");
    expect(usageGuide).toContain("jp_lit_search(source=kokusho");
    expect(usageGuide).toContain("jp_lit_search_kokusho_fulltext");
    expect(usageGuide).toContain("jp_lit_search_kokusho_image_tags");
    expect(usageGuide).toContain("jp_lit_search(source=ninjal_bibliography");
    expect(usageGuide).toContain("文化資源 DB や地域アーカイブ DB は固定 source 化しません");

    expect(projectStatus).toContain("対応 source 20 種");
    expect(projectStatus).toContain("nijl_articles");
    expect(projectStatus).toContain("kokusho");
    expect(projectStatus).toContain("ninjal_bibliography");
  });

  it("documents regional public library research as a Skill-guided route", () => {
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    const regionalDoc = readFileSync("docs/regional-public-library-research.md", "utf8");

    expect(usageGuide).toContain("地方人物・地方紙・地方雑誌・郷土資料");
    expect(usageGuide).toContain("docs/regional-public-library-research.md");
    expect(usageGuide).toContain("カーリル図書館MCP");
    expect(usageGuide).toContain("地域候補を優先づけたうえで");
    expect(usageGuide).toContain("`search_libraries` で地域名・館種・ネットワーク名");
    expect(usageGuide).toContain("Web 検索はパスファインダー");
    expect(usageGuide).toContain("県立図書館を基準点として外さない");
    expect(usageGuide).toContain("該当都道府県立図書館");
    expect(usageGuide).toContain("発行地・活動地に対応する中央館");
    expect(usageGuide).toContain("隣接自治体や旧郡域の館");
    expect(usageGuide).toContain("専門図書館・資料室");
    expect(usageGuide).toContain("scripts/plan-regional-library-search.mjs");
    expect(usageGuide).toContain("`search_libraries` で地域名・館種・ネットワーク名");
    expect(usageGuide).toContain("MCP / OAuth 設定を直し");
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("地域資料・地方人物");
    expect(readme).toContain("カーリル図書館MCP");
    expect(readme).toContain("docs/regional-public-library-research.md");
    expect(regionalDoc).toContain("https://calil.jp/ai/");
    expect(regionalDoc).toContain("https://ndlsearch.ndl.go.jp/rnavi/plan/pubpath");
    expect(regionalDoc).toContain("scripts/plan-regional-library-search.mjs");
  });
});
