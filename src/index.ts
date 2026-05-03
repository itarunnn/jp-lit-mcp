#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { startServer } from "./server.js";

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
