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
});
