import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface WorkflowStep {
  id?: string;
  name?: string;
  uses?: string;
  shell?: string;
  env?: Record<string, string>;
  run?: string;
  "working-directory"?: string;
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
  it("accepts a stable tag without a version during trusted precheck", () => {
    expect(runValidator("v0.8.1")).toMatchObject({
      status: 0,
      stdout: "v0.8.1"
    });
  });

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

  it("prechecks raw input from a separately checked out trusted commit", () => {
    expect(workflow.on.workflow_dispatch.inputs).toHaveProperty("package-ref");
    expect(publishJob["runs-on"]).toBe("windows-latest");

    const trustedCheckout = steps.find(
      (step) => step.name === "Check out trusted workflow source"
    );
    const precheck = steps.find((step) => step.name === "Precheck package tag");

    expect(trustedCheckout).toMatchObject({
      uses: "actions/checkout@v6",
      with: {
        ref: "${{ github.sha }}",
        path: "trusted",
        "persist-credentials": false
      }
    });
    expect(precheck).toMatchObject({
      id: "package-tag",
      shell: "pwsh",
      "working-directory": "trusted",
      env: { PACKAGE_REF: "${{ inputs.package-ref }}" }
    });
    expect(precheck?.run).toContain(
      'node scripts/validate-publish-ref.mjs "$env:PACKAGE_REF"'
    );
    expect(precheck?.run).toContain("$env:GITHUB_OUTPUT");

    for (const step of steps) {
      expect(step.run ?? "").not.toContain("${{ inputs.package-ref }}");
    }
  });

  it("checks out only the fully qualified validated tag into the package path", () => {
    const packageCheckout = steps.find(
      (step) => step.name === "Check out qualified package tag"
    );

    expect(packageCheckout).toMatchObject({
      uses: "actions/checkout@v6",
      with: {
        ref: "refs/tags/${{ steps.package-tag.outputs.tag }}",
        path: "package",
        "persist-credentials": false,
        "fetch-depth": 1
      }
    });
    expect(packageCheckout?.with?.ref).not.toContain("inputs.package-ref");
  });

  it("requires the fetched tag to peel to the checked out package HEAD", () => {
    const verification = steps.find(
      (step) => step.name === "Verify tag commit matches package HEAD"
    );

    expect(verification).toMatchObject({
      shell: "pwsh",
      "working-directory": "package",
      env: { VALIDATED_TAG: "${{ steps.package-tag.outputs.tag }}" }
    });
    expect(verification?.run).toContain("git show-ref --verify --quiet");
    expect(verification?.run).toContain('git rev-parse "$tagRef^{commit}"');
    expect(verification?.run).toContain("git rev-parse HEAD");
    expect(verification?.run).toContain("$tagCommit -cne $headCommit");
    expect(verification?.run).toContain(
      "Fetched tag ref does not exist"
    );
    expect(verification?.run).toContain("does not match package HEAD");
  });

  it("uses the trusted validator for the target package version", () => {
    const validation = steps.find(
      (step) => step.name === "Validate package version"
    );

    expect(validation).toMatchObject({
      shell: "pwsh",
      "working-directory": "package",
      env: { VALIDATED_TAG: "${{ steps.package-tag.outputs.tag }}" }
    });
    expect(validation?.run).toContain(
      '"trusted/scripts/validate-publish-ref.mjs"'
    );
    expect(validation?.run).toContain(
      '"$env:VALIDATED_TAG" "$version"'
    );
    expect(validation?.run).not.toContain(
      "node scripts/validate-publish-ref.mjs"
    );
  });

  it("fails closed unless npm reports that the exact version is absent", () => {
    const availability = steps.find(
      (step) => step.name === "Check package version is unpublished"
    );

    expect(availability).toMatchObject({
      shell: "pwsh",
      "working-directory": "package"
    });
    expect(availability?.run).toContain("npm view");
    expect(availability?.run).toContain("$viewStatus -eq 0");
    expect(availability?.run).toMatch(/E404/);
    expect(availability?.run).toMatch(/No match found for version/);
    expect(availability?.run).toContain("if (-not $versionIsAbsent)");
    expect(availability?.run).toContain("throw");
  });

  it("explicitly succeeds after accepting npm's nonzero not-found result", () => {
    const availability = steps.find(
      (step) => step.name === "Check package version is unpublished"
    );

    expect(availability?.run?.trimEnd()).toMatch(
      /Write-Host "Confirmed jp-lit-mcp@\$env:PACKAGE_VERSION is unpublished"\s+exit 0$/
    );
  });

  it("runs the trusted boundary checks before package commands in order", () => {
    const stepIndex = (name: string) =>
      steps.findIndex((step) => step.name === name);
    const orderedNames = [
      "Check out trusted workflow source",
      "Precheck package tag",
      "Check out qualified package tag",
      "Verify tag commit matches package HEAD",
      "Set up Node.js",
      "Set up uv",
      "Install reader Python",
      "Validate package version",
      "Check package version is unpublished",
      "Install dependencies",
      "Build",
      "Set up image analysis",
      "Test",
      "Test TEI reader",
      "Test image analysis",
      "Publish to npm"
    ];

    const indexes = orderedNames.map(stepIndex);
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));

    const setupNode = steps[stepIndex("Set up Node.js")];
    expect(setupNode?.with).toMatchObject({
      cache: "npm",
      "cache-dependency-path": "package/package-lock.json"
    });

    const packageCommands = {
      "Install dependencies": "npm ci",
      Build: "npm run build",
      Test: "npm test -- --maxWorkers=2",
      "Test TEI reader": "npm run test:tei",
      "Set up image analysis": "node scripts/iiif-images.mjs --setup",
      "Test image analysis": "npm run test:images",
      "Publish to npm": "npm publish"
    };
    for (const [name, command] of Object.entries(packageCommands)) {
      expect(steps[stepIndex(name)]).toMatchObject({
        "working-directory": "package",
        run: command
      });
    }
    expect(steps[stepIndex("Set up uv")]?.with?.version).toBe("0.12.10");
    expect(steps[stepIndex("Install reader Python")]?.run).toBe("uv python install 3.13.15");
  });
});
