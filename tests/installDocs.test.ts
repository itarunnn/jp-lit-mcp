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
    expect(cursor).toContain(".cursor/skills/jp-lit-research/");
    expect(claudeCode).toContain("scripts/install-skills.ps1 -Platform claude");
  });
});
