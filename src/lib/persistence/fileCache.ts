import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCacheRoot, getLegacyCacheRoot } from "./paths.js";
import type { CacheEnvelope } from "./types.js";

export interface FileCache {
  read<T>(tool: string, key: string): Promise<CacheEnvelope<T> | null>;
  write<T>(tool: string, envelope: CacheEnvelope<T>): Promise<void>;
  delete(tool: string, key: string): Promise<boolean>;
  clear(tool?: string): Promise<number>;
}

function getToolDir(baseDir: string, tool: string) {
  return path.join(getCacheRoot(baseDir), tool);
}

function getCacheFilePath(baseDir: string, tool: string, key: string) {
  return path.join(getToolDir(baseDir, tool), `${key}.json`);
}

function getLegacyCacheFilePath(baseDir: string, tool: string, key: string) {
  return path.join(getLegacyCacheRoot(baseDir), tool, `${key}.json`);
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
  return {
    async read<T>(tool: string, key: string) {
      const target = getCacheFilePath(baseDir, tool, key);
      const legacyTarget = getLegacyCacheFilePath(baseDir, tool, key);

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
      const directory = getToolDir(baseDir, tool);
      const target = getCacheFilePath(baseDir, tool, envelope.cache_key);
      const temp = `${target}.tmp`;

      await mkdir(directory, { recursive: true });
      await writeFile(temp, JSON.stringify(envelope, null, 2), "utf8");
      await rm(target, { force: true });
      await rename(temp, target);
    },

    async delete(tool: string, key: string) {
      const target = getCacheFilePath(baseDir, tool, key);
      const legacyTarget = getLegacyCacheFilePath(baseDir, tool, key);
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
        const directories = [
          getToolDir(baseDir, tool),
          path.join(getLegacyCacheRoot(baseDir), tool)
        ];
        const targets = (
          await Promise.all(directories.map((directory) => listJsonFilenames(directory)))
        ).flatMap((filenames, index) =>
          filenames.map((filename) => path.join(directories[index]!, filename))
        );
        await Promise.all(
          targets.map((target) => rm(target, { force: true }))
        );
        return targets.length;
      }

      const toolDirs = Array.from(
        new Set([
          ...(await listChildDirs(getCacheRoot(baseDir))),
          ...(await listChildDirs(getLegacyCacheRoot(baseDir)))
        ])
      );

      let removed = 0;
      for (const toolName of toolDirs) {
        removed += await this.clear(toolName);
      }
      return removed;
    }
  };
}
