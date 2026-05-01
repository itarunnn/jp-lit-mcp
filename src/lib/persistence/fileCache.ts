import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCacheRoot } from "./paths.js";
import type { CacheEnvelope } from "./types.js";

export interface FileCache {
  read<T>(tool: string, key: string): Promise<CacheEnvelope<T> | null>;
  write<T>(tool: string, envelope: CacheEnvelope<T>): Promise<void>;
}

function getToolDir(baseDir: string, tool: string) {
  return path.join(getCacheRoot(baseDir), tool);
}

function getCacheFilePath(baseDir: string, tool: string, key: string) {
  return path.join(getToolDir(baseDir, tool), `${key}.json`);
}

export function createFileCache(baseDir = process.cwd()): FileCache {
  return {
    async read<T>(tool: string, key: string) {
      const target = getCacheFilePath(baseDir, tool, key);

      try {
        const text = await readFile(target, "utf8");
        return JSON.parse(text) as CacheEnvelope<T>;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          process.stderr.write(`[fileCache] read error (${target}): ${error}\n`);
        }
        return null;
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
    }
  };
}
