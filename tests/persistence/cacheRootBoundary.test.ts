import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCacheKey } from "../../src/lib/persistence/cacheKeys.js";
import { createFileCache } from "../../src/lib/persistence/fileCache.js";
import {
  getCacheRoot,
  getLegacyCacheRoot
} from "../../src/lib/persistence/paths.js";
import { createSessionStore } from "../../src/lib/persistence/sessionStore.js";
import { createJpLitListCacheTool } from "../../src/tools/jpLitListCache.js";
import { createJpLitPruneCacheTool } from "../../src/tools/jpLitPruneCache.js";
import { createJpLitSearchCacheIndexTool } from "../../src/tools/jpLitSearchCacheIndex.js";

type RootKind = "current" | "legacy";
type LinkLocation = "root" | "parent";
type Route =
  | "read"
  | "write"
  | "delete"
  | "clear"
  | "list"
  | "prune"
  | "search-index";

const tempDirs: string[] = [];

async function createTempSandbox() {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "jp-lit-cache-root-"));
  tempDirs.push(sandbox);
  return sandbox;
}

function cacheRoot(baseDir: string, rootKind: RootKind) {
  return rootKind === "current"
    ? getCacheRoot(baseDir)
    : getLegacyCacheRoot(baseDir);
}

function envelope(cacheKey: string) {
  return {
    version: 1 as const,
    tool: "jp_lit_search",
    cache_key: cacheKey,
    saved_at: "2026-01-01T00:00:00.000Z",
    input: { query: "boundary proof" },
    structured_content: {
      query: "boundary proof",
      source: "ndl_catalog" as const,
      page: 1,
      limit: 50,
      total: 0,
      items: []
    }
  };
}

async function redirectCacheRoot(
  sandbox: string,
  baseDir: string,
  rootKind: RootKind,
  linkLocation: LinkLocation
) {
  const root = cacheRoot(baseDir, rootKind);
  const linkPath = linkLocation === "root" ? root : path.dirname(root);
  const outside = path.join(
    sandbox,
    `outside-${rootKind}-${linkLocation}`
  );
  await mkdir(path.dirname(linkPath), { recursive: true });
  await mkdir(outside, { recursive: true });
  await symlink(
    outside,
    linkPath,
    process.platform === "win32" ? "junction" : "dir"
  );
  return linkLocation === "root" ? outside : path.join(outside, path.basename(root));
}

const routeMatrix: Array<{ rootKind: RootKind; route: Route }> = [
  { rootKind: "current", route: "read" },
  { rootKind: "current", route: "write" },
  { rootKind: "current", route: "delete" },
  { rootKind: "current", route: "clear" },
  { rootKind: "current", route: "list" },
  { rootKind: "current", route: "prune" },
  { rootKind: "current", route: "search-index" },
  { rootKind: "legacy", route: "read" },
  { rootKind: "legacy", route: "delete" },
  { rootKind: "legacy", route: "clear" },
  { rootKind: "legacy", route: "list" },
  { rootKind: "legacy", route: "prune" },
  { rootKind: "legacy", route: "search-index" }
];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("cache root realpath boundary", () => {
  it.each(
    routeMatrix.flatMap(({ rootKind, route }) =>
      (["root", "parent"] as const).map((linkLocation) => ({
        rootKind,
        route,
        linkLocation
      }))
    )
  )(
    "$rootKind cache $route rejects an outside $linkLocation junction",
    async ({ rootKind, route, linkLocation }) => {
      const sandbox = await createTempSandbox();
      const baseDir = path.join(sandbox, "base");
      await mkdir(baseDir);
      const redirectedRoot = await redirectCacheRoot(
        sandbox,
        baseDir,
        rootKind,
        linkLocation
      );
      const cacheKey = createCacheKey("jp_lit_search", {
        rootKind,
        route,
        linkLocation
      });
      const redirectedFile = path.join(
        redirectedRoot,
        "jp_lit_search",
        `${cacheKey}.json`
      );
      await mkdir(path.dirname(redirectedFile), { recursive: true });
      if (route !== "write") {
        await writeFile(
          redirectedFile,
          JSON.stringify(envelope(cacheKey), null, 2),
          "utf8"
        );
      }

      const cache = createFileCache(baseDir);
      const sessions = createSessionStore(baseDir);
      if (route === "search-index") {
        await sessions.appendEntry({
          tool: "jp_lit_search",
          input: { query: "boundary proof" },
          cache_key: cacheKey,
          result_ref: { tool: "jp_lit_search", cache_key: cacheKey },
          selected_items: [],
          notes: []
        });
      }

      const action =
        route === "read"
          ? () => cache.read("jp_lit_search", cacheKey)
          : route === "write"
            ? () => cache.write("jp_lit_search", envelope(cacheKey))
            : route === "delete"
              ? () => cache.delete("jp_lit_search", cacheKey)
              : route === "clear"
                ? () => cache.clear("jp_lit_search")
                : route === "list"
                  ? () =>
                      createJpLitListCacheTool(cache, sessions, baseDir)({
                        tool: "jp_lit_search"
                      })
                  : route === "prune"
                    ? () =>
                        createJpLitPruneCacheTool(
                          baseDir,
                          () => new Date("2026-07-11T00:00:00.000Z")
                        )({ tool: "jp_lit_search", dry_run: false })
                    : () =>
                        createJpLitSearchCacheIndexTool(
                          cache,
                          sessions,
                          baseDir
                        )({ query: "boundary proof" });

      await expect(action()).rejects.toThrow(/cache/i);
      if (route === "write") {
        await expect(access(redirectedFile)).rejects.toThrow();
      } else {
        await expect(readFile(redirectedFile, "utf8")).resolves.toContain(
          "boundary proof"
        );
      }
    }
  );

  it("allows cache operations when baseDir itself is a junction", async () => {
    const sandbox = await createTempSandbox();
    const realBaseDir = path.join(sandbox, "real-base");
    const linkedBaseDir = path.join(sandbox, "linked-base");
    await mkdir(realBaseDir);
    await symlink(
      realBaseDir,
      linkedBaseDir,
      process.platform === "win32" ? "junction" : "dir"
    );
    const cache = createFileCache(linkedBaseDir);
    const cacheKey = createCacheKey("jp_lit_search", { linkedBaseDir: true });

    await cache.write("jp_lit_search", envelope(cacheKey));

    await expect(cache.read("jp_lit_search", cacheKey)).resolves.toMatchObject({
      cache_key: cacheKey
    });
    await expect(
      readFile(
        path.join(
          getCacheRoot(realBaseDir),
          "jp_lit_search",
          `${cacheKey}.json`
        ),
        "utf8"
      )
    ).resolves.toContain("boundary proof");
  });
});
