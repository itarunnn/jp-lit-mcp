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

  it("writes markdown export with selected profile", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-c",
      saved_at: new Date().toISOString(),
      input: { query: "baz" },
      structured_content: {
        query: "baz",
        source: null,
        page: 1,
        limit: 2,
        total: 2,
        items: [
          {
            source: "ndl_catalog",
            source_id: "123",
            title: "confirmed item",
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
            title: "unselected item",
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
      input: { query: "baz" },
      cache_key: "sha256-c",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-c"
      },
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "123",
          title: "confirmed item",
          label: "confirmed",
          note: "keep"
        }
      ],
      notes: ["memo"]
    });

    const exportPath = path.join(baseDir, "exports", "selected-only.md");
    await tool({
      format: "markdown",
      output_path: exportPath,
      profile: "selected",
      include_unselected: true
    });

    const written = await readFile(exportPath, "utf8");

    expect(written).toContain("Selected Items");
    expect(written).toContain("confirmed item");
    expect(written).not.toContain("Unselected Results");
    expect(written).not.toContain("unselected item");
  });

  it("writes json export with unselected profile", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-d",
      saved_at: new Date().toISOString(),
      input: { query: "qux" },
      structured_content: {
        query: "qux",
        source: null,
        page: 1,
        limit: 3,
        total: 3,
        items: [
          {
            source: "ndl_catalog",
            source_id: "111",
            title: "confirmed item",
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
            source_id: "222",
            title: "candidate item",
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
          },
          {
            source: "jstage_articles",
            source_id: "333",
            title: "unselected item",
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
      input: { query: "qux" },
      cache_key: "sha256-d",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-d"
      },
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "111",
          title: "confirmed item",
          label: "confirmed",
          note: "ok"
        },
        {
          source: "ndl_digital",
          source_id: "222",
          title: "candidate item",
          label: "strong_candidate",
          note: "review later"
        }
      ],
      notes: []
    });

    const exportPath = path.join(baseDir, "exports", "unselected-only.json");
    await tool({
      format: "json",
      output_path: exportPath,
      profile: "unselected",
      include_unselected: true
    });

    const written = JSON.parse(await readFile(exportPath, "utf8")) as {
      entries: Array<{ selected_items: Array<{ title: string; label: string }>; unselected_items?: Array<{ title: string }> }>;
    };

    expect(written.entries[0]?.selected_items).toHaveLength(0);
    expect(written.entries[0]?.unselected_items).toHaveLength(1);
    expect(written.entries[0]?.unselected_items?.[0]?.title).toBe("unselected item");
  });

  it("uses different default export paths for selected and unselected profiles", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: "sha256-e",
      saved_at: new Date().toISOString(),
      input: { query: "paths" },
      structured_content: {
        query: "paths",
        source: null,
        page: 1,
        limit: 2,
        total: 2,
        items: [
          {
            source: "ndl_catalog",
            source_id: "111",
            title: "selected item",
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
            source_id: "222",
            title: "unselected item",
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
      input: { query: "paths" },
      cache_key: "sha256-e",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-e"
      },
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "111",
          title: "selected item",
          label: "confirmed",
          note: "keep"
        }
      ],
      notes: []
    });

    const selectedResult = await tool({
      format: "markdown",
      profile: "selected"
    });
    const unselectedResult = await tool({
      format: "markdown",
      profile: "unselected"
    });

    expect(selectedResult.structuredContent.path).toBe(
      path.join(baseDir, "exports", `${session.session_id}.selected.md`)
    );
    expect(unselectedResult.structuredContent.path).toBe(
      path.join(baseDir, "exports", `${session.session_id}.unselected.md`)
    );
    expect(selectedResult.structuredContent.path).not.toBe(
      unselectedResult.structuredContent.path
    );
  });
});
