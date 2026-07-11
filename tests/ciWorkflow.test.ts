import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CI workflow", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

  it("runs for pull requests and pushes to main across the supported matrix", () => {
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("os: [windows-latest, ubuntu-latest]");
    expect(workflow).toContain("node: [22, 24]");
  });

  it("uses current setup actions and cross-platform npm commands in order", () => {
    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("uses: actions/setup-node@v6");
    expect(workflow).toContain("node-version: $" + "{{ matrix.node }}");
    expect(workflow).toContain("cache: npm");

    const commands = [
      "run: npm ci",
      "run: npm run build",
      "run: npm run typecheck:scripts",
      "run: npm test",
      "run: npm run smoke:mcp"
    ];
    const positions = commands.map((command) => workflow.indexOf(command));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
