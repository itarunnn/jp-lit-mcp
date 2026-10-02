import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("TEI Skill installation", () => {
  it("installs the TEI Skill and its references into a temporary Codex home", () => {
    const home = mkdtempSync(path.join(tmpdir(), "jp-lit-skills-"));
    const installed = spawnSync(process.execPath, [path.resolve("scripts/install-skills.mjs"), "codex"], {
      env: { ...process.env, JP_LIT_SKILLS_HOME: home }, encoding: "utf8"
    });
    expect(installed.status, installed.stderr).toBe(0);
    const directory = path.join(home, ".agents/skills/jp-lit-tei");
    expect(existsSync(path.join(directory, "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(directory, "references/workflow.md"))).toBe(true);
    expect(existsSync(path.join(home, ".agents/skills/jp-lit-research/SKILL.md"))).toBe(true);
    expect(existsSync(path.join(home, ".agents/skills/jp-lit-verification/SKILL.md"))).toBe(true);
    const skill = readFileSync(path.join(directory, "SKILL.md"), "utf8");
    expect(skill).not.toMatch(/J:[/\\]|C:[/\\]Users[/\\]|docs\/research|tei-pilot/);
  });
});
