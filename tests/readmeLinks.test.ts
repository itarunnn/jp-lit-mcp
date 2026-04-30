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
    expect(readme).toContain("## この MCP はどういうものか");
    expect(readme).toContain("## Skills を入れると何が変わるか");
    expect(readme).toContain("## 主な source の紹介");
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
    expect(readme).toContain("入力例");
    expect(readme).toContain("出力イメージ");
  });
});
