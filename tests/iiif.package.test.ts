import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
describe("optional IIIF distribution", () => {
  it("launches the declared bin from a different cwd with Node alone", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const result = spawnSync(
      process.execPath,
      [path.resolve(pkg.bin["jp-lit-iiif"]), "--help"],
      {
        cwd: tmpdir(),
        encoding: "utf8",
        env: { ...process.env, PATH: "", Path: "" },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("prepare_workspace");
  });
  it("installs all four Skills including IIIF workflow into an isolated home", () => {
    const home = mkdtempSync(path.join(tmpdir(), "iiif-skills-"));
    try {
      const result = spawnSync(
        process.execPath,
        [path.resolve("scripts/install-skills.mjs"), "all"],
        { env: { ...process.env, JP_LIT_SKILLS_HOME: home }, encoding: "utf8" },
      );
      expect(result.status, result.stderr).toBe(0);
      for (const platform of [".agents", ".claude", ".cursor"])
        for (const name of [
          "jp-lit-research",
          "jp-lit-verification",
          "jp-lit-tei",
          "jp-lit-iiif",
        ])
          expect(
            existsSync(path.join(home, platform, "skills", name, "SKILL.md")),
          ).toBe(true);
      expect(
        existsSync(
          path.join(home, ".agents/skills/jp-lit-iiif/references/workflow.md"),
        ),
      ).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
