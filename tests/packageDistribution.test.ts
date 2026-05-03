import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface PackageJson {
  bin?: Record<string, string>;
  files?: string[];
  scripts?: Record<string, string>;
}

describe("npm package distribution", () => {
  const packageJson = JSON.parse(
    readFileSync("package.json", "utf8")
  ) as PackageJson;

  it("exposes an npx executable for the MCP server", () => {
    expect(packageJson.bin?.["jp-lit-mcp"]).toBe("dist/src/index.js");
  });

  it("exposes an npx executable for installing bundled Skills", () => {
    expect(packageJson.bin?.["jp-lit-mcp-install-skills"]).toBe(
      "scripts/install-skills.mjs"
    );
  });

  it("supports installing bundled Skills through the main npx command", () => {
    const entrypoint = readFileSync("src/index.ts", "utf8");
    expect(entrypoint).toContain('process.argv[2] === "install-skills"');
    expect(entrypoint).toContain("scripts/install-skills.mjs");
  });

  it("documents help and version flags in the CLI entrypoint", () => {
    const entrypoint = readFileSync("src/index.ts", "utf8");
    expect(entrypoint).toContain('process.argv[2] === "--help"');
    expect(entrypoint).toContain('process.argv[2] === "--version"');
    expect(entrypoint).toContain("jp-lit-mcp install-skills <target>");
  });

  it("builds before packing and ships the compiled server", () => {
    expect(packageJson.scripts?.prepack).toBe("npm run build");
    expect(packageJson.files).toContain("dist/");
  });

  it("keeps local planning notes out of the npm package allowlist", () => {
    expect(packageJson.files ?? []).not.toContain("plans/");
    expect(packageJson.files ?? []).not.toContain("advice_0504.md");
  });

  it("uses a node shebang in the TypeScript entrypoint", () => {
    const entrypoint = readFileSync("src/index.ts", "utf8");
    expect(entrypoint).toMatch(/^#!\/usr\/bin\/env node\r?\n/);
  });

  it("uses a node shebang in the Skills installer", () => {
    const installer = readFileSync("scripts/install-skills.mjs", "utf8");
    expect(installer).toMatch(/^#!\/usr\/bin\/env node\r?\n/);
  });
});
