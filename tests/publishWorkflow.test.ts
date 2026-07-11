import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface WorkflowStep {
  name?: string;
  uses?: string;
  shell?: string;
  env?: Record<string, string>;
  run?: string;
  with?: Record<string, unknown>;
}

interface WorkflowJob {
  "runs-on": string;
  steps: WorkflowStep[];
}

interface WorkflowDocument {
  on: {
    workflow_dispatch: {
      inputs: Record<string, unknown>;
    };
  };
  jobs: Record<string, WorkflowJob>;
}

function runValidator(ref?: string, version?: string) {
  const args = ["scripts/validate-publish-ref.mjs"];
  if (ref !== undefined) args.push(ref);
  if (version !== undefined) args.push(version);

  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

describe("publish ref validator", () => {
  it("accepts a stable tag that exactly matches the package version", () => {
    expect(runValidator("v0.8.1", "0.8.1")).toMatchObject({
      status: 0,
      stdout: "v0.8.1"
    });
  });

  it.each([
    ["main", "0.8.1"],
    ["v0.8.2", "0.8.1"],
    ["$(whoami)", "0.8.1"],
    ["v0.8.1-rc.1", "0.8.1-rc.1"],
    [undefined, undefined]
  ])("rejects an invalid or mismatched ref %#", (ref, version) => {
    expect(runValidator(ref, version).status).not.toBe(0);
  });
});

describe("publish workflow", () => {
  const workflowText = readFileSync(".github/workflows/publish.yml", "utf8");
  const workflow = parse(workflowText) as WorkflowDocument;
  const publishJob = workflow.jobs.publish;
  const steps = publishJob.steps;

  it("passes the dispatch ref only through checkout input or a step env", () => {
    expect(workflow.on.workflow_dispatch.inputs).toHaveProperty("package-ref");
    expect(publishJob["runs-on"]).toBe("windows-latest");

    const checkout = steps.find((step) => step.uses === "actions/checkout@v6");
    expect(checkout?.with?.ref).toBe("${{ inputs.package-ref }}");

    for (const step of steps) {
      expect(step.run ?? "").not.toContain("${{ inputs.package-ref }}");
    }
  });

  it("validates the env ref in PowerShell before running package code", () => {
    const validationIndex = steps.findIndex(
      (step) => step.name === "Validate package ref and version"
    );
    const installIndex = steps.findIndex((step) => step.run === "npm ci");
    const validation = steps[validationIndex];

    expect(validationIndex).toBeGreaterThan(-1);
    expect(validationIndex).toBeLessThan(installIndex);
    expect(validation).toMatchObject({
      shell: "pwsh",
      env: { PACKAGE_REF: "${{ inputs.package-ref }}" }
    });
    expect(validation.run).toContain(
      'node scripts/validate-publish-ref.mjs "$env:PACKAGE_REF" "$version"'
    );

    const validatorIndex = validation.run?.indexOf(
      "node scripts/validate-publish-ref.mjs"
    );
    const packageVersionCheckIndex = validation.run?.indexOf(
      '$validatedTag -cne "v$version"'
    );
    expect(validatorIndex).toBeGreaterThanOrEqual(0);
    expect(packageVersionCheckIndex).toBeGreaterThan(validatorIndex ?? -1);
  });

  it("fails closed unless npm reports that the exact version is absent", () => {
    const availability = steps.find(
      (step) => step.name === "Check package version is unpublished"
    );

    expect(availability).toMatchObject({ shell: "pwsh" });
    expect(availability?.run).toContain("npm view");
    expect(availability?.run).toContain("$viewStatus -eq 0");
    expect(availability?.run).toMatch(/E404/);
    expect(availability?.run).toMatch(/No match found for version/);
    expect(availability?.run).toContain("if (-not $versionIsAbsent)");
    expect(availability?.run).toContain("throw");
  });

  it("orders validation, unpublished confirmation, and publish", () => {
    const validationIndex = steps.findIndex(
      (step) => step.name === "Validate package ref and version"
    );
    const availabilityIndex = steps.findIndex(
      (step) => step.name === "Check package version is unpublished"
    );
    const publishIndex = steps.findIndex((step) => step.run === "npm publish");

    expect(validationIndex).toBeGreaterThan(-1);
    expect(availabilityIndex).toBeGreaterThan(validationIndex);
    expect(publishIndex).toBeGreaterThan(availabilityIndex);
  });
});
