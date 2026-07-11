import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface PackageJson {
  bin?: Record<string, string>;
  files?: string[];
  scripts?: Record<string, string>;
}

function collectFiles(directory: string, extension: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectFiles(entryPath, extension);
    }

    return entry.isFile() && entry.name.endsWith(extension) ? [entryPath] : [];
  });
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

  it("documents the doctor command in the CLI entrypoint", () => {
    const entrypoint = readFileSync("src/index.ts", "utf8");
    expect(entrypoint).toContain('process.argv[2] === "doctor"');
    expect(entrypoint).toContain("jp-lit-mcp doctor");
  });

  it("builds before packing and ships the compiled server", () => {
    expect(packageJson.scripts?.prepack).toBe("npm run build");
    expect(packageJson.files).toContain("dist/");
  });

  it("keeps local planning notes out of the npm package allowlist", () => {
    expect(packageJson.files ?? []).not.toContain("plans/");
    expect(packageJson.files ?? []).not.toContain("advice_0504.md");
  });

  it("デジコレ本体内部APIを公開runtime・workflow・packageから除外する", () => {
    expect(packageJson.files ?? []).not.toContain("docs/research/");

    const publicRuntimeFiles = [
      ...collectFiles("src", ".ts"),
      ...collectFiles(".github/workflows", ".yml")
    ];
    const publicRuntimeText = publicRuntimeFiles
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const internalApiPattern =
      /dl\.ndl\.go\.jp\/api\/(?:item|fulltext)\/search/;

    expect("dl.ndl.go.jp/api/item/search").toMatch(internalApiPattern);
    expect("dl.ndl.go.jp/api/fulltext/search").toMatch(internalApiPattern);
    expect(publicRuntimeText).not.toMatch(internalApiPattern);
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
