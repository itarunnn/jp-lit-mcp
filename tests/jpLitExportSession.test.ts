import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionExporter } from "../src/lib/persistence/exportSession.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitExportSessionTool } from "../src/tools/jpLitExportSession.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ndl-jp-lit-export-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_export_session", () => {
  it("writes markdown export for the current session", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-a",
      saved_at: new Date().toISOString(),
      input: { query: "foo" },
      structured_content: {
        query: "foo",
        source: null,
        page: 1,
        limit: 2,
        total: 2,
        items: [
          {
            source: "ndl_catalog",
            source_id: "123",
            title: "foo",
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
            source_id: "456",
            title: "bar",
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

    const session = await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "foo" },
      cache_key: "sha256-a",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-a"
      },
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "123",
          title: "foo",
          label: "confirmed",
          note: "done"
        }
      ],
      notes: ["memo"]
    });

    const exportPath = path.join(baseDir, "exports", "session.md");
    const result = await tool({
      format: "markdown",
      output_path: exportPath,
      include_unselected: true
    });

    const written = await readFile(exportPath, "utf8");

    expect(result.structuredContent.session_id).toBe(session.session_id);
    expect(result.structuredContent.item_count).toBe(2);
    expect(written).toContain("Selected Items");
    expect(written).toContain("Unselected Results");
    expect(written).toContain("foo");
    expect(written).toContain("bar");
    expect(written).not.toContain("- foo (ndl_catalog/123)");
  });

  it("writes json export with unselected items", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-b",
      saved_at: new Date().toISOString(),
      input: { query: "bar" },
      structured_content: {
        query: "bar",
        source: null,
        page: 1,
        limit: 1,
        total: 1,
        items: [
          {
            source: "ndl_digital",
            source_id: "456",
            title: "bar",
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

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "bar" },
      cache_key: "sha256-b",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-b"
      },
      selected_items: [],
      notes: []
    });

    const exportPath = path.join(baseDir, "exports", "session.json");
    await tool({
      format: "json",
      output_path: exportPath,
      include_unselected: true
    });

    const written = JSON.parse(await readFile(exportPath, "utf8")) as {
      entries: Array<{ unselected_items: Array<{ title: string }> }>;
    };

    expect(written.entries[0]?.unselected_items).toHaveLength(1);
    expect(written.entries[0]?.unselected_items[0]?.title).toBe("bar");
  });
});
