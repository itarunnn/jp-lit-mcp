import path from "node:path";

const CACHE_ROOT = ".cache/jp-lit-mcp";

export function getPersistenceRoot(baseDir = process.cwd()) {
  return path.join(baseDir, CACHE_ROOT);
}

export function getCacheRoot(baseDir = process.cwd()) {
  return path.join(getPersistenceRoot(baseDir), "cache", "v1");
}

export function getSessionsRoot(baseDir = process.cwd()) {
  return path.join(getPersistenceRoot(baseDir), "sessions");
}

export function getExportsRoot(baseDir = process.cwd()) {
  return path.join(baseDir, "exports");
}
