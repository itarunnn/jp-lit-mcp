#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { runDoctor } from "./doctor.js";
import { readPackageVersion } from "./lib/packageInfo.js";
import { startServer } from "./server.js";

function printHelp() {
  console.log(`jp-lit-mcp

Usage:
  jp-lit-mcp                         Start the MCP server over stdio
  jp-lit-mcp doctor                  Check local setup without live API calls
  jp-lit-mcp install-skills <target>  Install bundled Skills
  jp-lit-mcp --help                   Show this help
  jp-lit-mcp --version                Show package version

Targets:
  codex
  cursor
  claude
  all

Examples:
  npx -y jp-lit-mcp
  npx -y jp-lit-mcp doctor
  npx -y jp-lit-mcp install-skills codex`);
}

async function runSkillsInstaller() {
  process.argv.splice(2, 1);

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const installerPath = [
    resolve(currentDir, "../../scripts/install-skills.mjs"),
    resolve(currentDir, "../scripts/install-skills.mjs")
  ].find((candidate) => existsSync(candidate));

  if (!installerPath) {
    throw new Error("scripts/install-skills.mjs not found");
  }

  await import(pathToFileURL(installerPath).href);
}

async function main() {
  if (process.argv[2] === "--help" || process.argv[2] === "-h") {
    printHelp();
    return;
  }

  if (process.argv[2] === "--version" || process.argv[2] === "-v") {
    console.log(readPackageVersion());
    return;
  }

  if (process.argv[2] === "doctor") {
    const result = runDoctor({ packageVersion: readPackageVersion() });
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (process.argv[2] === "install-skills") {
    await runSkillsInstaller();
    return;
  }

  await startServer();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
