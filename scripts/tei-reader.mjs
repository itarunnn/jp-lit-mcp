#!/usr/bin/env node
// 任意のTEI読解CLI。Python環境をnpm packageの外へ置く。
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/tei-reader");
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--request" && args[i + 1] && args[i + 1] !== "-") {
    args[i + 1] = resolve(args[i + 1]);
    i++;
  } else if (args[i].startsWith("--request=") && args[i] !== "--request=-") {
    args[i] = "--request=" + resolve(args[i].slice("--request=".length));
  }
}

const cache = process.env.XDG_CACHE_HOME ?? process.env.LOCALAPPDATA ?? join(homedir(), ".cache");
const identity = createHash("sha256").update(project).digest("hex").slice(0, 16);
const env = {
  ...process.env,
  UV_PROJECT_ENVIRONMENT: process.env.UV_PROJECT_ENVIRONMENT ??
    join(cache, "jp-lit-mcp", "tei-reader", identity),
};
const child = spawnSync("uv", [
  "run", "--quiet", "--frozen", "--no-dev",
  "--project", project, "--directory", project,
  "python", "-B", "-m", "tei_reader", ...args,
], { env, shell: false, stdio: ["inherit", "pipe", "pipe"], maxBuffer: 2 * 1024 * 1024 });

function fail() {
  process.stdout.write(JSON.stringify({
    api_version: "0.1", operation: null, ok: false,
    error: {
      code: "runtime_launch_failed",
      message: "uvとPython 3.13の実行環境を確認してください。",
      details: {},
    },
  }) + "\n");
  process.exitCode = 4;
}

if (child.error || child.signal || child.status === null) {
  fail();
} else {
  const textMode = args.some((arg) => arg === "--help" || arg === "--version");
  let valid = textMode && child.status === 0;
  if (!valid) {
    try {
      const response = JSON.parse(child.stdout.toString("utf8"));
      valid = response.api_version === "0.1" &&
        typeof response.ok === "boolean" &&
        (response.ok ? child.status === 0 : [2, 3, 4].includes(child.status));
    } catch {
      valid = false;
    }
  }
  if (!valid || child.stderr.length) {
    fail();
  } else {
    process.stdout.write(child.stdout);
    process.exitCode = child.status;
  }
}
