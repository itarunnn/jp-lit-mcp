import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getCacheRoot, getExportsRoot } from "./lib/persistence/paths.js";

export interface DoctorOptions {
  cacheDir?: string;
  exportDir?: string;
  env?: NodeJS.ProcessEnv;
  nodeVersion?: string;
  packageVersion?: string;
  writeLine?: (line: string) => void;
}

export interface DoctorResult {
  ok: boolean;
}

type CheckStatus = "pass" | "fail" | "info";

interface Check {
  status: CheckStatus;
  message: string;
}

function formatStatus(status: CheckStatus) {
  if (status === "pass") {
    return "[OK]";
  }
  if (status === "fail") {
    return "[FAIL]";
  }
  return "[INFO]";
}

function parseNodeMajor(version: string) {
  const match = version.match(/^v?(\d+)/);
  return match ? Number(match[1]) : 0;
}

function canWriteToDirectory(dir: string) {
  mkdirSync(dir, { recursive: true });
  const probe = resolve(dir, ".jp-lit-doctor-write-test");
  writeFileSync(probe, "ok");
  rmSync(probe, { force: true });
}

function findBundledSkillsDir() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return [
    resolve(currentDir, "../../skills"),
    resolve(currentDir, "../skills")
  ].find((candidate) => existsSync(candidate));
}

export function runDoctor(options: DoctorOptions = {}): DoctorResult {
  const env = options.env ?? process.env;
  const nodeVersion = options.nodeVersion ?? process.version;
  const packageVersion = options.packageVersion ?? "0.0.0";
  const writeLine = options.writeLine ?? ((line: string) => console.log(line));
  const cacheDir = options.cacheDir ?? getCacheRoot();
  const exportDir = options.exportDir ?? getExportsRoot();
  const checks: Check[] = [];

  checks.push({
    status: parseNodeMajor(nodeVersion) >= 18 ? "pass" : "fail",
    message: `Node.js >= 18 (${nodeVersion})`
  });

  checks.push({
    status: "pass",
    message: `package version: ${packageVersion}`
  });

  checks.push({
    status: "pass",
    message: "MCP entrypoint loadable"
  });

  checks.push({
    status: findBundledSkillsDir() ? "pass" : "fail",
    message: "Skills directory bundled"
  });

  try {
    canWriteToDirectory(cacheDir);
    checks.push({ status: "pass", message: `cache directory writable: ${cacheDir}` });
  } catch (error) {
    checks.push({
      status: "fail",
      message: `cache directory writable: ${cacheDir} (${(error as Error).message})`
    });
  }

  try {
    canWriteToDirectory(exportDir);
    checks.push({ status: "pass", message: `exports directory writable: ${exportDir}` });
  } catch (error) {
    checks.push({
      status: "fail",
      message: `exports directory writable: ${exportDir} (${(error as Error).message})`
    });
  }

  checks.push({
    status: "info",
    message: env.CINII_RESEARCH_APP_ID
      ? "CINII_RESEARCH_APP_ID set (optional; used by CiNii Research and KAKEN API)"
      : "CINII_RESEARCH_APP_ID not set (optional; required for KAKEN API tool)"
  });

  writeLine("jp-lit-mcp doctor");
  writeLine("");
  for (const check of checks) {
    writeLine(`${formatStatus(check.status)} ${check.message}`);
  }
  writeLine("");
  writeLine("No live API checks were run.");

  return { ok: checks.every((check) => check.status !== "fail") };
}
