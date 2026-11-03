import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const installer = path.resolve("scripts/install-skills.mjs");
const temporaryHomes: string[] = [];
function isolatedHome() {
  const directory = mkdtempSync(path.join(tmpdir(), "jp-lit-installer-"));
  temporaryHomes.push(directory);
  const edited = path.join(directory, ".agents/skills/jp-lit-research/SKILL.md");
  mkdirSync(path.dirname(edited), { recursive: true });
  writeFileSync(edited, "個別編集を保持する");
  return { directory, edited };
}
afterEach(() => {
  for (const directory of temporaryHomes.splice(0)) {
    if (path.dirname(directory) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith("jp-lit-installer-")) {
      throw new Error("Unexpected temporary installer path");
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("installer argument safety", () => {
  it.each([["--help"], ["codex", "--help"], ["-h", "all"], ["all", "-h"]])(
    "shows help without changing existing files: %j", (...args) => {
      const { directory, edited } = isolatedHome();
      const result = spawnSync(process.execPath, [installer, ...args], {
        env: { ...process.env, JP_LIT_SKILLS_HOME: directory }, encoding: "utf8"
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/Usage:|使い方/);
      expect(readFileSync(edited, "utf8")).toBe("個別編集を保持する");
      expect(readdirSync(directory)).toEqual([".agents"]);
      expect(readdirSync(path.dirname(path.dirname(edited)))).toEqual(["jp-lit-research"]);
    }
  );

  it.each([["codex", "--unknown"], ["codex", "claude"], ["invalid-platform"], ["--unknown", "--help"]])(
    "rejects invalid arguments before changing files: %j", (...args) => {
      const { directory, edited } = isolatedHome();
      const result = spawnSync(process.execPath, [installer, ...args], {
        env: { ...process.env, JP_LIT_SKILLS_HOME: directory }, encoding: "utf8"
      });
      expect(result.status).toBe(1);
      expect(readFileSync(edited, "utf8")).toBe("個別編集を保持する");
      expect(readdirSync(directory)).toEqual([".agents"]);
      expect(readdirSync(path.dirname(path.dirname(edited)))).toEqual(["jp-lit-research"]);
    }
  );

  it("installs all four Skills for an explicit valid target", () => {
    const { directory } = isolatedHome();
    const result = spawnSync(process.execPath, [installer, "codex"], {
      env: { ...process.env, JP_LIT_SKILLS_HOME: directory }, encoding: "utf8"
    });
    expect(result.status, result.stderr).toBe(0);
    expect(readdirSync(path.join(directory, ".agents/skills")).sort()).toEqual([
      "jp-lit-iiif", "jp-lit-research", "jp-lit-tei", "jp-lit-verification"
    ]);
  });

  it.skipIf(process.platform !== "win32")("propagates PowerShell wrapper failure", () => {
    const { directory } = isolatedHome();
    const shell = path.join(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
    const result = spawnSync(shell, ["-NoProfile", "-File", path.resolve("scripts/install-skills.ps1"), "invalid-platform"], {
      env: { ...process.env, JP_LIT_SKILLS_HOME: directory }, encoding: "utf8"
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
  });

  it.skipIf(process.platform !== "win32")("forwards PowerShell trailing help without writing", () => {
    const { directory, edited } = isolatedHome();
    const shell = path.join(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
    const result = spawnSync(shell, ["-NoProfile", "-File", path.resolve("scripts/install-skills.ps1"), "codex", "--help"], {
      env: { ...process.env, JP_LIT_SKILLS_HOME: directory }, encoding: "utf8"
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/Usage:|使い方/);
    expect(readFileSync(edited, "utf8")).toBe("個別編集を保持する");
  });

  it.skipIf(process.platform === "win32")("forwards shell trailing help without writing", () => {
    const { directory, edited } = isolatedHome();
    const result = spawnSync("/bin/bash", [path.resolve("scripts/install-skills.sh"), "codex", "--help"], {
      env: { ...process.env, JP_LIT_SKILLS_HOME: directory }, encoding: "utf8"
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/Usage:|使い方/);
    expect(readFileSync(edited, "utf8")).toBe("個別編集を保持する");
  });
});

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
    expect(script).toContain('cursor: join(home, ".cursor", "skills")');
    expect(script).toContain('join(repoRoot, "skills")');
    expect(script).toContain("jp-lit-verification");
    expect(script).toContain("JP_LIT_SKILLS_HOME");
  });
});
