import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/server.js";

interface PackageJson {
  bin?: Record<string, string>;
  files?: string[];
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
}

interface JsonSchemaNode {
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  anyOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
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

function collectPackagePath(packagePath: string): string[] {
  const stats = statSync(packagePath);
  if (stats.isFile()) {
    return [path.normalize(packagePath)];
  }
  if (!stats.isDirectory()) {
    return [];
  }
  return readdirSync(packagePath, { withFileTypes: true }).flatMap((entry) =>
    collectPackagePath(path.join(packagePath, entry.name))
  );
}

function collectEffectivePackageFiles(packageJson: PackageJson) {
  return Array.from(
    new Set(
      [
        "package.json",
        "README.md",
        "LICENSE",
        ...(packageJson.files ?? [])
      ].flatMap(collectPackagePath)
    )
  );
}

function collectSchemaPropertyNames(schema: JsonSchemaNode | undefined): string[] {
  if (!schema) {
    return [];
  }

  return [
    ...Object.entries(schema.properties ?? {}).flatMap(([name, property]) => [
      name,
      ...collectSchemaPropertyNames(property)
    ]),
    ...collectSchemaPropertyNames(schema.items),
    ...(schema.anyOf ?? []).flatMap(collectSchemaPropertyNames),
    ...(schema.allOf ?? []).flatMap(collectSchemaPropertyNames),
    ...(schema.oneOf ?? []).flatMap(collectSchemaPropertyNames)
  ];
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

  it("provides a deterministic offline smoke command without replacing manual live smoke", () => {
    expect(packageJson.scripts?.["smoke:mcp"]).toBe("tsx scripts/smoke-mcp.ts");
    expect(packageJson.scripts?.["smoke:mcp:offline"]).toBe(
      "cross-env SMOKE_OFFLINE=1 tsx scripts/smoke-mcp.ts"
    );
    expect(packageJson.scripts?.["smoke:mcp:live-matrix"]).toContain(
      "SMOKE_LIVE_MATRIX=1"
    );
  });

  it("デジコレ本体内部APIを公開runtime・workflow・package全体から除外する", () => {
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

    const effectivePackageFiles = collectEffectivePackageFiles(packageJson);
    const effectivePackageText = effectivePackageFiles
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(effectivePackageFiles).toEqual(
      expect.arrayContaining([
        "README.md",
        path.join("docs", "api-notes", "next-digital-library.md"),
        path.join("docs", "install", "codex-app.md"),
        path.join("skills", "jp-lit-research", "SKILL.md"),
        path.join("scripts", "install-skills.mjs"),
        path.join("scripts", "install-skills.ps1"),
        path.join("scripts", "install-skills.sh")
      ])
    );
    expect(effectivePackageText).not.toMatch(internalApiPattern);
  });

  it("browser観測記録toolはbrowser runtimeとcredential・binary・path入力を公開しない", async () => {
    const forbiddenBrowserRuntimes = [
      "playwright",
      "chrome-launcher",
      "puppeteer"
    ];
    const runtimeDependencies = Object.keys(packageJson.dependencies ?? {});
    const publicRuntimeText = collectFiles("src", ".ts")
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    for (const runtime of forbiddenBrowserRuntimes) {
      expect(runtimeDependencies).not.toContain(runtime);
      expect(publicRuntimeText).not.toMatch(
        new RegExp(`(?:from\\s+|import\\(\\s*)["']${runtime}(?:/[^"']*)?["']`)
      );
    }

    const server = createServer();
    const client = new Client({
      name: "jp-lit-package-boundary-test-client",
      version: "0.1.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const { tools } = await client.listTools();
      const tool = tools.find(
        (entry) => entry.name === "jp_lit_record_ndl_browser_search"
      );
      const propertyNames = collectSchemaPropertyNames(
        tool?.inputSchema as JsonSchemaNode | undefined
      ).map((name) => name.toLowerCase());

      expect(tool).toBeDefined();
      for (const forbiddenProperty of [
        "cookie",
        "password",
        "session_token",
        "user_id",
        "user_name",
        "pdf_path",
        "screenshot",
        "image"
      ]) {
        expect(propertyNames).not.toContain(forbiddenProperty);
      }
    } finally {
      await client.close();
      await server.close();
    }
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
