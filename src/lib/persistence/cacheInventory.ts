import { readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

import { getCacheRoot, getLegacyCacheRoot } from "./paths.js";
import type { CacheEnvelope } from "./types.js";

export type CacheRootKind = "current" | "legacy";

export interface CacheInventoryItem {
  tool: string;
  cache_key: string;
  saved_at: string;
  bytes: number;
  path: string;
  root: CacheRootKind;
}

export interface SkippedCacheFile {
  path: string;
  reason: string;
}

async function listDirs(directory: string) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function listJsonFiles(directory: string) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function parseEnvelope(text: string): CacheEnvelope<unknown> | null {
  try {
    return JSON.parse(text) as CacheEnvelope<unknown>;
  } catch {
    return null;
  }
}

async function collectRoot(
  rootPath: string,
  root: CacheRootKind,
  toolFilter?: string
) {
  const items: CacheInventoryItem[] = [];
  const skipped: SkippedCacheFile[] = [];
  const tools = toolFilter ? [toolFilter] : await listDirs(rootPath);

  for (const tool of tools) {
    const toolDir = path.join(rootPath, tool);
    for (const filename of await listJsonFiles(toolDir)) {
      const filePath = path.join(toolDir, filename);
      const text = await readFile(filePath, "utf8");
      const envelope = parseEnvelope(text);
      if (!envelope) {
        skipped.push({ path: filePath, reason: "invalid JSON" });
        continue;
      }
      if (
        typeof envelope.tool !== "string" ||
        typeof envelope.cache_key !== "string" ||
        typeof envelope.saved_at !== "string"
      ) {
        skipped.push({ path: filePath, reason: "missing cache metadata" });
        continue;
      }
      if (Number.isNaN(Date.parse(envelope.saved_at))) {
        skipped.push({ path: filePath, reason: "invalid saved_at" });
        continue;
      }
      if (envelope.tool !== tool) {
        skipped.push({
          path: filePath,
          reason: "tool directory does not match cache metadata"
        });
        continue;
      }
      const stats = await stat(filePath);
      items.push({
        tool: envelope.tool,
        cache_key: envelope.cache_key,
        saved_at: envelope.saved_at,
        bytes: stats.size,
        path: filePath,
        root
      });
    }
  }

  return { items, skipped };
}

export async function listCacheInventory(baseDir = process.cwd(), tool?: string) {
  const current = await collectRoot(getCacheRoot(baseDir), "current", tool);
  const legacy = await collectRoot(getLegacyCacheRoot(baseDir), "legacy", tool);
  return {
    items: [...current.items, ...legacy.items],
    skipped: [...current.skipped, ...legacy.skipped]
  };
}

function isPathInside(parent: string, target: string) {
  const relative = path.relative(path.resolve(parent), path.resolve(target));
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function removeInventoryItem(
  item: CacheInventoryItem,
  baseDir = process.cwd()
) {
  const rootPath =
    item.root === "current" ? getCacheRoot(baseDir) : getLegacyCacheRoot(baseDir);
  if (!isPathInside(rootPath, item.path)) {
    throw new Error(`Refusing to remove cache file outside cache root: ${item.path}`);
  }
  await rm(item.path, { force: false });
}
