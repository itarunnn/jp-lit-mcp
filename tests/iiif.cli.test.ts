import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runIiifCli } from "../src/iiif/cli.js";
describe("IIIF CLI JSON boundary", () => {
  it("reads relative request paths from caller cwd and emits one parseable input error", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "iiif-cli-"));
    const output: string[] = [],
      logs: string[] = [];
    try {
      await writeFile(
        path.join(dir, "request.json"),
        JSON.stringify({ api_version: "99", operation: "inspect_manifest" }),
      );
      expect(
        await runIiifCli(["--request", "request.json"], {
          cwd: dir,
          stdout: (s) => output.push(s),
          stderr: (s) => logs.push(s),
        }),
      ).toBe(2);
      expect(output).toHaveLength(1);
      expect(JSON.parse(output[0]).ok).toBe(false);
      output.length = 0;
      expect(
        await runIiifCli(["--help"], {
          cwd: dir,
          stdout: (s) => output.push(s),
          stderr: (s) => logs.push(s),
        }),
      ).toBe(0);
      expect(output.join("")).toContain("prepare_workspace");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
