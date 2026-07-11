import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface WorkflowStep {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

interface WorkflowJob {
  "runs-on": string;
  strategy: {
    "fail-fast": boolean;
    matrix: { os: string[]; node: number[] };
  };
  steps: WorkflowStep[];
}

interface WorkflowDocument {
  on: {
    pull_request: null;
    push: { branches: string[] };
  };
  permissions: { contents: string };
  jobs: Record<string, WorkflowJob>;
}

describe("CI workflow", () => {
  const workflowText = readFileSync(".github/workflows/ci.yml", "utf8");
  const workflow = parse(workflowText) as WorkflowDocument;

  it("parses pull request and main push triggers as YAML hierarchy", () => {
    expect(workflow.on).toEqual({
      pull_request: null,
      push: { branches: ["main"] }
    });
    expect(workflow.permissions).toEqual({ contents: "read" });
  });

  it("parses the supported matrix and ordered cross-platform steps", () => {
    expect(Object.keys(workflow.jobs)).toEqual(["verify"]);
    expect(workflow.jobs.verify).toEqual({
      "runs-on": "${{ matrix.os }}",
      strategy: {
        "fail-fast": false,
        matrix: {
          os: ["windows-latest", "ubuntu-latest"],
          node: [22, 24]
        }
      },
      steps: [
        { uses: "actions/checkout@v6" },
        {
          uses: "actions/setup-node@v6",
          with: {
            "node-version": "${{ matrix.node }}",
            cache: "npm"
          }
        },
        { run: "npm ci" },
        { run: "npm run build" },
        { run: "npm run typecheck:scripts" },
        { run: "npm test" },
        { run: "npm run smoke:mcp:offline" }
      ]
    });
  });
});
