import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const launcher = path.resolve("scripts/tei-reader.mjs");

function run(args: string[], cwd: string, input?: string, extraEnv: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [launcher, ...args], {
    cwd, input, encoding: "utf8", timeout: 60000,
    env: { ...process.env, ...extraEnv }
  });
}

describe("optional TEI launcher", () => {
  it("keeps Python bytecode and virtual environments outside the package", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "jp-lit-tei-package-"));
    mkdirSync(path.join(directory, "scripts"));
    cpSync(launcher, path.join(directory, "scripts/tei-reader.mjs"));
    cpSync(path.resolve("packages/tei-reader"), path.join(directory, "packages/tei-reader"), {
      recursive: true,
      filter: (source) => !["__pycache__", ".venv", "tests"].some(part => source.split(path.sep).includes(part))
    });
    const completed = spawnSync(process.execPath, [path.join(directory, "scripts/tei-reader.mjs"), "--version"], {
      cwd: tmpdir(), encoding: "utf8", timeout: 60000
    });
    expect(completed.status, completed.stderr).toBe(0);
    expect(existsSync(path.join(directory, "packages/tei-reader/tei_reader/__pycache__"))).toBe(false);
    expect(existsSync(path.join(directory, "packages/tei-reader/.venv"))).toBe(false);
  });
  it("reads relative requests from another cwd and resolves an outside-scope target", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "jp-lit-tei-"));
    const xml = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><p xml:id="outside"/><div ref="#outside"><p>前<choice><orig>舊</orig><reg>旧</reg></choice>後</p></div></TEI>';
    const file = path.join(directory, "資料 空白.xml");
    writeFileSync(file, xml, "utf8");
    const sha = createHash("sha256").update(xml).digest("hex");
    writeFileSync(path.join(directory, "要求 空白.json"), JSON.stringify({
      operation: "check_references", file_path: file, expected_sha256: sha,
      attributes: ["ref"], scope_xpath: "/t:TEI[1]/t:div[1]"
    }), "utf8");
    const completed = run(["--request", "要求 空白.json"], directory);
    expect(completed.status, completed.stderr).toBe(0);
    expect(completed.stderr).toBe("");
    const response = JSON.parse(completed.stdout);
    expect(response.ok).toBe(true);
    expect(response.document.sha256).toBe(sha);
    expect(response.result.total_occurrences).toBe(1);
    expect(response.result.items[0].target_locator.xpath).toBe("/t:TEI[1]/t:p[1]");
  });

  it("passes stdin unchanged and keeps parser failures private", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "jp-lit-tei-"));
    const file = path.join(directory, "bad.xml");
    writeFileSync(file, "<TEI>PRIVATE_SOURCE_FRAGMENT");
    const completed = run(["--request", "-"], directory, JSON.stringify({
      operation: "inspect_document", file_path: file
    }));
    expect(completed.status).toBe(3);
    expect(completed.stderr).toBe("");
    const response = JSON.parse(completed.stdout);
    expect(response.error.code).toBe("invalid_xml");
    expect(completed.stdout).not.toContain("PRIVATE_SOURCE_FRAGMENT");
    expect(completed.stdout.trim().split("\n")).toHaveLength(1);
  });

  it("returns a JSON launch failure when uv cannot be found", () => {
    const completed = run(["--request", "-"], tmpdir(), "{}", { PATH: "", Path: "" });
    expect(completed.status).toBe(4);
    expect(completed.stderr).toBe("");
    expect(JSON.parse(completed.stdout).error.code).toBe("runtime_launch_failed");
  });

  it("shows the reader version and rejects unknown CLI arguments", () => {
    const version = run(["--version"], tmpdir());
    expect(version.status, version.stderr).toBe(0);
    expect(version.stdout.trim()).toBe("0.2.0");
    const invalid = run(["--unknown"], tmpdir());
    expect(invalid.status).toBe(2);
    expect(JSON.parse(invalid.stdout).error.code).toBe("invalid_request");
  });

  it("includes the optional launcher and precise Python runtime paths in package metadata", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.bin["jp-lit-tei-reader"]).toBe("scripts/tei-reader.mjs");
    expect(pkg.files).toContain("packages/tei-reader/tei_reader/protocol.py");
    expect(pkg.files).not.toContain("packages/");
    expect(pkg.files).not.toContain("packages/tei-reader/");
  });
});
