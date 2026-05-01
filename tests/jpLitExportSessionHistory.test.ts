import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionExporter } from "../src/lib/persistence/exportSession.js";
import { getSessionsRoot } from "../src/lib/persistence/paths.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import type { SessionDocument } from "../src/lib/persistence/types.js";
import { createJpLitExportSessionTool } from "../src/tools/jpLitExportSession.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ndl-jp-lit-export-history-"));
  tempDirs.push(dir);
  return dir;
}

async function writeArchiveSession(baseDir: string, session: SessionDocument) {
  const sessionsDir = getSessionsRoot(baseDir);
  await mkdir(sessionsDir, { recursive: true });
  await writeFile(
    path.join(sessionsDir, `${session.session_id}.json`),
    JSON.stringify(session, null, 2),
    "utf8"
  );
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_export_session history", () => {
  it("uses the current session when session_id is omitted", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-current-history",
      saved_at: new Date().toISOString(),
      input: { query: "current session" },
      structured_content: {
        query: "current session",
        source: null,
        page: 1,
        limit: 1,
        total: 1,
        items: [
          {
            source: "ndl_catalog",
            source_id: "current-1",
            title: "current result",
            subtitle: null,
            title_reading: null,
            authors: [],
            publisher: null,
            journal_title: null,
            issued_at: null,
            issued_at_label: null,
            issued_at_precision: "unknown",
            summary: null,
            url: null,
            availability: {
              online: false,
              digital_collection: false
            },
            material_type: null,
            subjects: [],
            table_of_contents: [],
            duplicate_key: null,
            duplicate_count: 1,
            related_records: []
          }
        ]
      }
    });

    const currentSession = await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "current session" },
      cache_key: "sha256-current-history",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-current-history"
      },
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "current-1",
          title: "current result",
          label: "confirmed",
          note: null
        }
      ],
      notes: []
    });

    const exportPath = path.join(baseDir, "exports", "current.md");
    const result = await tool({
      format: "markdown",
      output_path: exportPath
    });

    const written = await readFile(exportPath, "utf8");

    expect(result.structuredContent.session_id).toBe(currentSession.session_id);
    expect(written).toContain("current result");
  });

  it("exports an archived session when session_id is provided", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-archived-history",
      saved_at: new Date().toISOString(),
      input: { query: "archived session" },
      structured_content: {
        query: "archived session",
        source: null,
        page: 1,
        limit: 2,
        total: 2,
        items: [
          {
            source: "ndl_catalog",
            source_id: "archived-1",
            title: "archived selected",
            subtitle: null,
            title_reading: null,
            authors: [],
            publisher: null,
            journal_title: null,
            issued_at: null,
            issued_at_label: null,
            issued_at_precision: "unknown",
            summary: null,
            url: null,
            availability: {
              online: false,
              digital_collection: false
            },
            material_type: null,
            subjects: [],
            table_of_contents: [],
            duplicate_key: null,
            duplicate_count: 1,
            related_records: []
          },
          {
            source: "ndl_digital",
            source_id: "archived-2",
            title: "archived unselected",
            subtitle: null,
            title_reading: null,
            authors: [],
            publisher: null,
            journal_title: null,
            issued_at: null,
            issued_at_label: null,
            issued_at_precision: "unknown",
            summary: null,
            url: null,
            availability: {
              online: false,
              digital_collection: true
            },
            material_type: null,
            subjects: [],
            table_of_contents: [],
            duplicate_key: null,
            duplicate_count: 1,
            related_records: []
          }
        ]
      }
    });

    const archivedSession: SessionDocument = {
      session_id: "2026-04-30-101010",
      created_at: "2026-04-30T10:10:10.000Z",
      updated_at: "2026-04-30T10:15:10.000Z",
      entries: [
        {
          tool: "jp_lit_search",
          input: { query: "archived session" },
          cache_key: "sha256-archived-history",
          result_ref: {
            tool: "jp_lit_search",
            cache_key: "sha256-archived-history"
          },
          selected_items: [
            {
              source: "ndl_catalog",
              source_id: "archived-1",
              title: "archived selected",
              label: "confirmed",
              note: "archive note"
            }
          ],
          notes: ["archived memo"]
        }
      ]
    };

    await writeArchiveSession(baseDir, archivedSession);

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-current-other",
      saved_at: new Date().toISOString(),
      input: { query: "other current session" },
      structured_content: {
        query: "other current session",
        source: null,
        page: 1,
        limit: 1,
        total: 1,
        items: [
          {
            source: "jstage_articles",
            source_id: "current-other-1",
            title: "current other result",
            subtitle: null,
            title_reading: null,
            authors: [],
            publisher: null,
            journal_title: null,
            issued_at: null,
            issued_at_label: null,
            issued_at_precision: "unknown",
            summary: null,
            url: null,
            availability: {
              online: true,
              digital_collection: false
            },
            material_type: null,
            subjects: [],
            table_of_contents: [],
            duplicate_key: null,
            duplicate_count: 1,
            related_records: []
          }
        ]
      }
    });

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "other current session" },
      cache_key: "sha256-current-other",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-current-other"
      },
      selected_items: [],
      notes: []
    });

    const exportPath = path.join(baseDir, "exports", "archived.json");
    const result = await tool({
      session_id: archivedSession.session_id,
      format: "json",
      profile: "full_log",
      output_path: exportPath,
      include_unselected: true
    });

    const written = JSON.parse(await readFile(exportPath, "utf8")) as {
      session_id: string;
      entries: Array<{
        selected_items: Array<{ title: string }>;
        unselected_items: Array<{ title: string }>;
      }>;
    };

    expect(result.structuredContent.session_id).toBe(archivedSession.session_id);
    expect(written.session_id).toBe(archivedSession.session_id);
    expect(written.entries[0]?.selected_items[0]?.title).toBe("archived selected");
    expect(written.entries[0]?.unselected_items[0]?.title).toBe("archived unselected");
    expect(JSON.stringify(written)).not.toContain("current other result");
  });

  it("throws an error when the requested session_id does not exist", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await expect(
      tool({
        session_id: "2026-05-01-999999",
        format: "markdown"
      })
    ).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("rejects invalid session_id values at schema validation time", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await expect(
      tool({
        session_id: "../package",
        format: "markdown"
      })
    ).rejects.toMatchObject({
      name: "ZodError"
    });
  });
});
