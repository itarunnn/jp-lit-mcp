import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "docs/architecture-guide");
const read = (name: string) => readFileSync(resolve(root, name), "utf8");

describe("architecture guide", () => {
  it("ships a self-contained semantic learning path", () => {
    const html = read("index.html");

    expect(html).toContain('lang="ja"');
    for (const id of [
      "frameworks", "flow", "journey", "layers", "decisions",
      "persistence", "extensions", "testing", "reading-routes"
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    for (const path of [
      "src/index.ts", "src/server.ts", "src/tools/jpLitSearch.ts",
      "src/services/searchService.ts", "src/sources/types.ts",
      "src/lib/persistence/runCachedTool.ts"
    ]) {
      expect(html).toContain(path);
    }
    expect(html).toContain('href="styles.css"');
    expect(html).toContain('src="app.js"');
    expect(html).toContain('aria-labelledby="architecture-title architecture-desc"');
    expect(html).toContain("data-layer=");
    expect(html).toContain("data-view=");
  });

  it("documents local viewing and maintenance", () => {
    const readme = read("README.md");
    expect(readme).toContain("index.html");
    expect(readme).toContain("現行コード");
  });

  it("provides accessible responsive and printable styling", () => {
    const css = read("styles.css");
    expect(css).toContain(":root");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (max-width:");
    expect(css).toContain("@media print");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("progressively enhances navigation diagrams and code notes", () => {
    const js = read("app.js");
    expect(js).toContain("IntersectionObserver");
    expect(js).toContain("data-layer");
    expect(js).toContain("data-view");
    expect(js).toContain("data-code-note");
    expect(js).toContain('event.key === "Enter"');
  });
});
