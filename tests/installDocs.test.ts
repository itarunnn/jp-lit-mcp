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

    expect(codexApp).toContain("npm run skills:install");
    expect(codexCli).toContain("codex mcp add");
    expect(cursor).toContain("npm run skills:install -- cursor");
    expect(claudeCode).toContain("scripts/install-skills.ps1 -Platform claude");
  });

  it("mentions verification-mode examples in install and usage docs", () => {
    const usage = readFileSync("docs/usage-guide.md", "utf8");
    expect(usage).toContain("文献検証");
    expect(usage).toContain("この文章に出てくる文献の実在性");
    expect(usage).toContain("出力例");
    expect(usage).toContain("判定理由");
  });
});
