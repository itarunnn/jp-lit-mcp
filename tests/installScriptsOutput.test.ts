import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("install script messaging", () => {
  it("mentions Codex and Claude targets explicitly", () => {
    const js = readFileSync("scripts/install-skills.mjs", "utf8");
    const ps1 = readFileSync("scripts/install-skills.ps1", "utf8");
    const sh = readFileSync("scripts/install-skills.sh", "utf8");

    expect(js).toContain("Codex / Claude Code");
    expect(js).toContain("jp-lit-verification");
    expect(ps1).toContain("Codex / Claude Code");
    expect(sh).toContain("Codex / Claude Code");
  });
});
