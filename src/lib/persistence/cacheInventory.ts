import { readdir, readFile, rm, stat } from "node:fs/promises";

import { InvalidRequestError } from "../errors.js";
import {
  cachedToolSchema,
  cacheKeySchema,
  resolveContainedCachePath
} from "./cacheIdentity.js";
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

function parseCacheTool(tool: string) {
  try {
    return cachedToolSchema.parse(tool);
  } catch {
    throw new InvalidRequestError("invalid cache tool");
  }
}

function parseCacheKey(key: string) {
  try {
    return cacheKeySchema.parse(key);
  } catch {
    throw new InvalidRequestError("invalid cache key");
  }
}

async function collectRoot(
  rootPath: string,
  root: CacheRootKind,
  toolFilter?: string
) {
  const items: CacheInventoryItem[] = [];
  const skipped: SkippedCacheFile[] = [];
  const containedRoot = resolveContainedCachePath(rootPath);
  const tools = toolFilter
    ? [parseCacheTool(toolFilter)]
    : (await listDirs(containedRoot)).flatMap((tool) => {
        const parsed = cachedToolSchema.safeParse(tool);
        return parsed.success ? [parsed.data] : [];
      });

  for (const tool of tools) {
    const toolDir = resolveContainedCachePath(containedRoot, tool);
    for (const filename of await listJsonFiles(toolDir)) {
      const filePath = resolveContainedCachePath(containedRoot, tool, filename);
      const filenameKey = filename.endsWith(".json")
        ? filename.slice(0, -".json".length)
        : filename;
      const parsedFilenameKey = cacheKeySchema.safeParse(filenameKey);
      if (!parsedFilenameKey.success) {
        skipped.push({ path: filePath, reason: "invalid cache key filename" });
        continue;
      }
      const text = await readFile(filePath, "utf8");
      const envelope = parseEnvelope(text);
      if (!envelope) {
        skipped.push({ path: filePath, reason: "invalid JSON" });
        continue;
      }
      if (
        !cachedToolSchema.safeParse(envelope.tool).success ||
        !cacheKeySchema.safeParse(envelope.cache_key).success ||
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
      if (envelope.cache_key !== parsedFilenameKey.data) {
        skipped.push({
          path: filePath,
          reason: "cache filename does not match cache metadata"
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

export async function removeInventoryItem(
  item: CacheInventoryItem,
  baseDir = process.cwd()
) {
  const rootPath =
    item.root === "current" ? getCacheRoot(baseDir) : getLegacyCacheRoot(baseDir);
  const tool = parseCacheTool(item.tool);
  const cacheKey = parseCacheKey(item.cache_key);
  const target = resolveContainedCachePath(
    rootPath,
    tool,
    `${cacheKey}.json`
  );
  await rm(target, { force: false });
}
