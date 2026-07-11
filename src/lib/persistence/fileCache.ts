import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { InvalidRequestError } from "../errors.js";
import {
  cachedToolSchema,
  cacheKeySchema,
  resolveContainedCachePath
} from "./cacheIdentity.js";
import { getCacheRoot, getLegacyCacheRoot } from "./paths.js";
import type { CacheEnvelope } from "./types.js";

export interface FileCache {
  read<T>(tool: string, key: string): Promise<CacheEnvelope<T> | null>;
  write<T>(tool: string, envelope: CacheEnvelope<T>): Promise<void>;
  delete(tool: string, key: string): Promise<boolean>;
  clear(tool?: string): Promise<number>;
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

function getToolDir(root: string, tool: string) {
  return resolveContainedCachePath(root, parseCacheTool(tool));
}

function getCacheFilePath(root: string, tool: string, key: string) {
  return resolveContainedCachePath(
    root,
    parseCacheTool(tool),
    `${parseCacheKey(key)}.json`
  );
}

async function listJsonFilenames(directory: string) {
  try {
    return (await readdir(directory)).filter((name) => name.endsWith(".json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [] as string[];
    }
    throw error;
  }
}

async function listChildDirs(directory: string) {
  try {
    return await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [] as string[];
    }
    throw error;
  }
}

export function createFileCache(baseDir = process.cwd()): FileCache {
  const cacheRoot = getCacheRoot(baseDir);
  const legacyCacheRoot = getLegacyCacheRoot(baseDir);

  return {
    async read<T>(tool: string, key: string) {
      const target = getCacheFilePath(cacheRoot, tool, key);
      const legacyTarget = getCacheFilePath(legacyCacheRoot, tool, key);

      try {
        const text = await readFile(target, "utf8");
        return JSON.parse(text) as CacheEnvelope<T>;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          process.stderr.write(`[fileCache] read error (${target}): ${error}\n`);
          return null;
        }

        try {
          const legacyText = await readFile(legacyTarget, "utf8");
          return JSON.parse(legacyText) as CacheEnvelope<T>;
        } catch (legacyError) {
          if ((legacyError as NodeJS.ErrnoException).code === "ENOENT") {
            return null;
          }

          process.stderr.write(`[fileCache] read error (${legacyTarget}): ${legacyError}\n`);
          return null;
        }
      }
    },

    async write<T>(tool: string, envelope: CacheEnvelope<T>) {
      const directory = getToolDir(cacheRoot, tool);
      const target = getCacheFilePath(cacheRoot, tool, envelope.cache_key);
      const temp = resolveContainedCachePath(
        cacheRoot,
        `${path.relative(cacheRoot, target)}.tmp`
      );

      await mkdir(directory, { recursive: true });
      resolveContainedCachePath(cacheRoot, path.relative(cacheRoot, directory));
      resolveContainedCachePath(cacheRoot, path.relative(cacheRoot, target));
      resolveContainedCachePath(cacheRoot, path.relative(cacheRoot, temp));
      await writeFile(temp, JSON.stringify(envelope, null, 2), "utf8");
      await rm(target, { force: true });
      await rename(temp, target);
    },

    async delete(tool: string, key: string) {
      const target = getCacheFilePath(cacheRoot, tool, key);
      const legacyTarget = getCacheFilePath(legacyCacheRoot, tool, key);
      try {
        await rm(target, { force: false });
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }

      try {
        await rm(legacyTarget, { force: false });
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return false;
        }
        throw error;
      }
    },

    async clear(tool) {
      if (tool) {
        const parsedTool = parseCacheTool(tool);
        const directories = [
          getToolDir(cacheRoot, parsedTool),
          getToolDir(legacyCacheRoot, parsedTool)
        ];
        const targets = (
          await Promise.all(directories.map((directory) => listJsonFilenames(directory)))
        ).flatMap((filenames, index) =>
          filenames.map((filename) =>
            resolveContainedCachePath(
              index === 0 ? cacheRoot : legacyCacheRoot,
              parsedTool,
              filename
            )
          )
        );
        await Promise.all(
          targets.map((target) => rm(target, { force: true }))
        );
        return targets.length;
      }

      const toolDirs = Array.from(
        new Set([
          ...(await listChildDirs(resolveContainedCachePath(cacheRoot))),
          ...(await listChildDirs(resolveContainedCachePath(legacyCacheRoot)))
        ])
      );

      let removed = 0;
      for (const toolName of toolDirs) {
        const parsedTool = cachedToolSchema.safeParse(toolName);
        if (parsedTool.success) {
          removed += await this.clear(parsedTool.data);
        }
      }
      return removed;
    }
  };
}
