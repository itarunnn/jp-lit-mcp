import { createHash } from "node:crypto";
import { mkdtemp, rm, readFile, readdir, symlink, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createSessionExporter } from "../src/lib/persistence/exportSession.js";
import { createJpLitExportSessionTool } from "../src/tools/jpLitExportSession.js";
import { createJpLitSearchTool } from "../src/tools/jpLitSearch.js";
import { createSearchService } from "../src/services/searchService.js";

const dirs: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); for (const dir of dirs.splice(0))
  await rm(dir, {
    recursive: true,
    force: true
  }); });
async function hashes(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await readdir(root, {
    withFileTypes: true
  })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory())
      Object.assign(result, await hashes(file));
    else
      result[file] = createHash("sha256").update(await readFile(file)).digest("hex");
  }
  return result;
}
async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-method-export-"));
  dirs.push(dir);
  const cache = createFileCache(dir), sessions = createSessionStore(dir), session = await sessions.startSession({
    research_goal: "検索方法の検証"
  });
  const tool = createJpLitSearchTool(createSearchService([{
      source: "cinii_articles",
      getRecord: async () => null,
      search: async () => ({
        total: 0,
        items: [],
        summary: {
          outcome: "completed",
          reported_total: 0,
          total_basis: "source_reported"
        }
      })
    }]), cache, sessions);
  await tool({
    session_id: session.session_id,
    query: "q",
    source: "cinii_articles"
  });
  const exporter = createJpLitExportSessionTool(sessions, createSessionExporter(cache, dir));
  return {
    dir,
    session,
    exporter,
    cache,
    sessions
  };
}
it("exports methods markdown and JSON without modifying saved state or fetching", async () => {
  const { dir, session, exporter } = await fixture();
  const before = await hashes(path.join(dir, ".cache"));
  const fetch = vi.fn(() => { throw Error("network denied"); });
  vi.stubGlobal("fetch", fetch);
  for (const format of ["markdown", "json"] as const) {
    const result = await exporter({
      session_id: session.session_id,
      profile: "methods",
      format,
      include_unselected: true
    });
    expect(result.structuredContent).toMatchObject({
      item_count: 0,
      search_count: 1,
      profile: "methods"
    });
    expect(path.dirname(result.structuredContent.path)).toBe(path.join(dir, "exports"));
    const text = await readFile(result.structuredContent.path, "utf8");
    if (format === "markdown")
      expect(text).toContain("# 調査方法");
    else {
      const manifest = JSON.parse(text);
      expect(manifest.methods[0].evidence_origin).toBe("session_snapshot");
      expect(manifest.methods[0].snapshot.context.producer_version).toBe("0.15.2");
    }
  }
  expect(await hashes(path.join(dir, ".cache"))).toEqual(before);
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects CSL JSON before writing", async () => {
  const { dir, session, exporter } = await fixture();
  await expect(exporter({
    session_id: session.session_id,
    profile: "methods",
    format: "csl-json"
  })).rejects.toThrow();
  await expect(readdir(path.join(dir, "exports"))).rejects.toThrow();
});
it("preserves overwrite, explicit external paths and junction boundaries", async () => {
  const { dir, session, exporter } = await fixture();
  const input = {
    session_id: session.session_id,
    profile: "methods",
    format: "json"
  };
  const first = await exporter(input);
  await expect(exporter(input)).rejects.toThrow();
  await exporter({
    ...input,
    overwrite: true
  });
  const external = await mkdtemp(path.join(os.tmpdir(), "jp-lit-external-"));
  dirs.push(external);
  const output = path.join(external, "methods.json");
  await expect(exporter({
    ...input,
    output_path: output
  })).rejects.toThrow();
  await exporter({
    ...input,
    output_path: output,
    allow_external_path: true
  });
  await mkdir(path.join(dir, "exports"), {
    recursive: true
  });
  await symlink(external, path.join(dir, "exports", "escape"), process.platform === "win32" ? "junction" : "dir");
  await expect(exporter({
    ...input,
    output_path: path.join(dir, "exports", "escape", "blocked.json")
  })).rejects.toThrow();
});
it("exports the saved snapshot after its result cache is deleted", async () => {
  const { dir, session, exporter, cache, sessions } = await fixture();
  const entry = (await sessions.readById(session.session_id)).entries[0]!;
  await cache.delete(entry.tool, entry.cache_key);
  const result = await exporter({
    session_id: session.session_id,
    profile: "methods",
    format: "json"
  });
  const manifest = JSON.parse(await readFile(result.structuredContent.path, "utf8"));
  expect(manifest.methods[0].evidence_origin).toBe("session_snapshot");
  expect(manifest.methods[0].snapshot.context).toEqual(entry.method_snapshot!.context);
});
