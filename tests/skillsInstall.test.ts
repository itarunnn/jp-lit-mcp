import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public skill layout", () => {
  it("ships jp-lit-research under skills/", () => {
    expect(existsSync("skills/jp-lit-research/SKILL.md")).toBe(true);
    expect(existsSync("skills/jp-lit-research/heuristics/source-selection.md")).toBe(
      true
    );
    expect(
      existsSync("skills/jp-lit-research/workflows/topic-literature-review.md")
    ).toBe(true);
  });

  it("ships jp-lit-verification under skills/", () => {
    expect(existsSync("skills/jp-lit-verification/SKILL.md")).toBe(true);
    expect(
      existsSync("skills/jp-lit-verification/workflows/pasted-text-verification.md")
    ).toBe(true);
    expect(
      existsSync("skills/jp-lit-verification/heuristics/classification-rules.md")
    ).toBe(true);
    expect(
      existsSync("skills/jp-lit-verification/heuristics/extraction-rules.md")
    ).toBe(true);
    expect(
      existsSync("skills/jp-lit-verification/heuristics/source-followup.md")
    ).toBe(true);
  });
});

describe("install script messaging", () => {
  it("mentions Codex and Claude targets explicitly", () => {
    const script = readFileSync("scripts/install-skills.mjs", "utf8");
    expect(script).toContain("Codex / Claude Code");
    expect(script).toContain("Cursor はリポジトリ内 .cursor/skills/");
    expect(script).toContain('join(repoRoot, "skills")');
    expect(script).toContain("jp-lit-verification");
  });
});
