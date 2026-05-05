import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runDoctor } from "../src/doctor.js";

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "jp-lit-doctor-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("CLI doctor", () => {
  it("reports local environment checks without making live API calls", () => {
    const cacheDir = createTempDir();
    const exportDir = createTempDir();
    const lines: string[] = [];

    const result = runDoctor({
      cacheDir,
      exportDir,
      env: {},
      nodeVersion: "v20.11.1",
      packageVersion: "0.1.3",
      writeLine: (line) => lines.push(line)
    });

    expect(result.ok).toBe(true);
    expect(lines.join("\n")).toContain("jp-lit-mcp doctor");
    expect(lines.join("\n")).toContain("Node.js >= 18");
    expect(lines.join("\n")).toContain("package version: 0.1.3");
    expect(lines.join("\n")).toContain("MCP entrypoint loadable");
    expect(lines.join("\n")).toContain("Skills directory bundled");
    expect(lines.join("\n")).toContain("cache directory writable");
    expect(lines.join("\n")).toContain("exports directory writable");
    expect(lines.join("\n")).toContain("CINII_RESEARCH_APP_ID not set (optional; required for KAKEN API tool)");
    expect(lines.join("\n")).toContain("No live API checks were run.");
  });

  it("fails when the Node.js runtime is too old", () => {
    const lines: string[] = [];

    const result = runDoctor({
      cacheDir: createTempDir(),
      exportDir: createTempDir(),
      env: { CINII_RESEARCH_APP_ID: "dummy" },
      nodeVersion: "v16.20.2",
      packageVersion: "0.1.3",
      writeLine: (line) => lines.push(line)
    });

    expect(result.ok).toBe(false);
    expect(lines.join("\n")).toContain("Node.js >= 18");
    expect(lines.join("\n")).toContain("CINII_RESEARCH_APP_ID set (optional; used by CiNii Research and KAKEN API)");
  });
});
