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
    expect(regionalDoc).toContain("Codex の MCP 設定とは別に");
    expect(regionalDoc).toContain("初回 OAuth 認可");
    expect(regionalDoc).toContain("API キー登録は不要");
    expect(regionalDoc).toContain("Codex は明示されていない");
    expect(regionalDoc).toContain("localhost のリダイレクト先 URI は既定で許可");
    expect(regionalDoc).toContain("直結できることを確認済み");
    expect(regionalDoc).toContain("oauth_resource = \"https://mcp-beta.calil.jp\"");
    expect(regionalDoc).toContain("Claude Code");
    expect(regionalDoc).toContain("Cursor");
    expect(usageGuide).toContain("codex mcp add calil --url https://mcp-beta.calil.jp/mcp");
    expect(usageGuide).toContain("codex mcp login calil");
    expect(usageGuide).toContain("oauth_resource = \"https://mcp-beta.calil.jp\"");
    expect(usageGuide).toContain("localhost");
    expect(usageGuide).toContain("MCP / OAuth 設定を直し");
  });
});
