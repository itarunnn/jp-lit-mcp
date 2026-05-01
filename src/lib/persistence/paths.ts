import path from "node:path";

const CACHE_ROOT = ".cache/jp-lit-mcp";
const LEGACY_CACHE_ROOT = ".cache/ndl-jp-lit-mcp";

export function getPersistenceRoot(baseDir = process.cwd()) {
  return path.join(baseDir, CACHE_ROOT);
}

export function getLegacyPersistenceRoot(baseDir = process.cwd()) {
  return path.join(baseDir, LEGACY_CACHE_ROOT);
}

export function getCacheRoot(baseDir = process.cwd()) {
  return path.join(getPersistenceRoot(baseDir), "cache", "v1");
}

export function getLegacyCacheRoot(baseDir = process.cwd()) {
  return path.join(getLegacyPersistenceRoot(baseDir), "cache", "v1");
}

export function getSessionsRoot(baseDir = process.cwd()) {
  return path.join(getPersistenceRoot(baseDir), "sessions");
}

export function getLegacySessionsRoot(baseDir = process.cwd()) {
  return path.join(getLegacyPersistenceRoot(baseDir), "sessions");
}

export function getExportsRoot(baseDir = process.cwd()) {
  return path.join(baseDir, "exports");
}
