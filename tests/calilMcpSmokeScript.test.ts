import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Calil Remote MCP smoke test support", () => {
  it("ships a dedicated live smoke script for Calil Remote MCP", () => {
    expect(existsSync("scripts/smoke-calil-mcp.ts")).toBe(true);

    const script = readFileSync("scripts/smoke-calil-mcp.ts", "utf8");
    expect(script).toContain("https://mcp-beta.calil.jp/mcp");
    expect(script).toContain("StreamableHTTPClientTransport");
    expect(script).toContain("search_libraries");
    expect(script).toContain("search_books");
    expect(script).toContain("CALIL_MCP_SKIP_BOOK_SEARCH");
    expect(script).toContain("CALIL_MCP_OPEN_BROWSER");
  });

  it("documents the live smoke command and OAuth expectations", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    const readme = readFileSync("README.md", "utf8");
    const regionalDoc = readFileSync("docs/regional-public-library-research.md", "utf8");
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");

    expect(packageJson.scripts?.["smoke:calil-mcp"]).toBe(
      "tsx scripts/smoke-calil-mcp.ts"
    );
    expect(readme).toContain("npm run smoke:calil-mcp");
    expect(regionalDoc).toContain("npm run smoke:calil-mcp");
    expect(usageGuide).toContain("npm run smoke:calil-mcp");
    expect(regionalDoc).toContain("初回 OAuth 認可");
    expect(regionalDoc).toContain("API キー登録は不要");
  });
});
