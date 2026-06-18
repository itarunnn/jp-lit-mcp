import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("install docs", () => {
  it("ships install guides for supported apps", () => {
    expect(existsSync("docs/install/codex-app.md")).toBe(true);
    expect(existsSync("docs/install/codex-cli.md")).toBe(true);
    expect(existsSync("docs/install/cursor.md")).toBe(true);
    expect(existsSync("docs/install/claude-code.md")).toBe(true);
  });

  it("documents the main setup steps for each app", () => {
    const codexApp = readFileSync("docs/install/codex-app.md", "utf8");
    const codexCli = readFileSync("docs/install/codex-cli.md", "utf8");
    const cursor = readFileSync("docs/install/cursor.md", "utf8");
    const claudeCode = readFileSync("docs/install/claude-code.md", "utf8");

    expect(codexApp).toContain("npx -y jp-lit-mcp");
    expect(codexApp).toContain("npx -y jp-lit-mcp install-skills codex");
    expect(codexCli).toContain("codex mcp add");
    expect(codexCli).toContain("npx -y jp-lit-mcp");
    expect(cursor).toContain("npx -y jp-lit-mcp install-skills cursor");
    expect.soft(cursor).toContain("~/.cursor/skills/");
    expect.soft(cursor).toContain("user-level");
    expect.soft(cursor).toContain("project-level");
    expect(claudeCode).toContain("npx -y jp-lit-mcp install-skills claude");
    expect.soft(claudeCode).toContain("claude mcp add jp-lit");
    expect.soft(claudeCode).toContain("--env");
  });

  it("documents the lightweight doctor command", () => {
    const docs = [
      readFileSync("README.md", "utf8"),
      readFileSync("docs/install/codex-app.md", "utf8"),
      readFileSync("docs/install/codex-cli.md", "utf8"),
      readFileSync("docs/install/cursor.md", "utf8"),
      readFileSync("docs/install/claude-code.md", "utf8"),
      readFileSync("docs/usage-guide.md", "utf8")
    ].join("\n");

    expect(docs.match(/npx -y jp-lit-mcp doctor/g)?.length).toBeGreaterThanOrEqual(6);
    expect(docs).toContain("CINII_RESEARCH_APP_ID");
    expect(docs).toContain("live API");
  });

  it("does not document the old clone-based Skills installer as the main path", () => {
    const docs = [
      readFileSync("README.md", "utf8"),
      readFileSync("docs/install/github-skills.md", "utf8"),
      readFileSync("docs/install/codex-app.md", "utf8"),
      readFileSync("docs/install/codex-cli.md", "utf8"),
      readFileSync("docs/install/cursor.md", "utf8"),
      readFileSync("docs/install/claude-code.md", "utf8")
    ].join("\n");

    expect(docs).not.toContain("npm run skills:install");
  });

  it("documents GitHub CLI skills as an explicit secondary route", () => {
    const githubSkills = readFileSync("docs/install/github-skills.md", "utf8");
    const githubSkillsPlain = githubSkills.replace(/`/g, "");

    expect.soft(githubSkills).toContain("public preview");
    expect.soft(githubSkills).toContain("2.90.0");
    expect.soft(githubSkills).toContain("gh 2.94.0");
    expect.soft(githubSkills).toContain("gh skills");
    expect.soft(githubSkills).toContain("最新タグ付き release");
    expect.soft(githubSkills).toContain("jp-lit-research@main");
    expect.soft(githubSkills).toContain("gh skill update --dry-run");
    expect.soft(githubSkills).toContain("--agent codex");
    expect.soft(githubSkills).toContain("--agent cursor");
    expect.soft(githubSkills).toContain("--agent claude-code");
    expect.soft(githubSkills).toContain("--scope user");
    expect.soft(githubSkillsPlain).toContain("MCP の登録までは行いません");
  });

  it("mentions verification-mode examples in install and usage docs", () => {
    const usage = readFileSync("docs/usage-guide.md", "utf8");
    expect(usage).toContain("文献検証");
    expect(usage).toContain("この文章に出てくる文献の実在性");
    expect(usage).toContain("出力例");
    expect(usage).toContain("判定理由");
  });

  it("explains provisional organization and text-reading labels in the usage guide", () => {
    const usage = readFileSync("docs/usage-guide.md", "utf8");
    expect(usage).toContain("確認・本文・優先度・根拠の読み方");
    expect(usage).toContain("availability.online=true");
    expect(usage).toContain("エージェントが本文や該当箇所を読んだことを意味しません");
    expect(usage).toContain("本文: オンライン入口あり未読");
    expect(usage).toContain("次: 発信者プロフィール確認");
    expect(usage).toContain("出版社や媒体だけで文献の価値を確定しません");
  });
});
