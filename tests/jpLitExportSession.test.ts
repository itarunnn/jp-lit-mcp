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
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-export-"));
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

  it("writes CSL JSON export for selected records", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_get_record", {
      version: 1,
      tool: "jp_lit_get_record",
      cache_key: "sha256-csl-record",
      saved_at: new Date().toISOString(),
      input: {
        source: "jstage_articles",
        source_id: "/article/example/1/2/1/_article/-char/ja"
      },
      structured_content: {
        source: "jstage_articles",
        source_id: "/article/example/1/2/1/_article/-char/ja",
        title: "近代文学研究の一例",
        subtitle: null,
        title_reading: null,
        authors: [
          {
            name: "山田太郎",
            role: "author"
          }
        ],
        publisher: "文学会",
        journal_title: "日本文学研究",
        issued_at: "2020-04-01",
        issued_at_label: "2020-04-01",
        issued_at_precision: "day",
        summary: null,
        url: "https://www.jstage.jst.go.jp/article/example/1/2/1/_article/-char/ja",
        availability: {
          online: true,
          digital_collection: false
        },
        alternative_titles: [],
        publication_place: null,
        language: "ja",
        material_type: "article",
        extent: "vol.1, no.2, pp.12-34",
        subjects: ["近代文学"],
        identifiers: {
          doi: "10.1234/example.1",
          issn: "1234-5678"
        },
        table_of_contents: [],
        content_access: {
          has_page_images: false,
          has_text_coordinates: false,
          viewer_url: "https://www.jstage.jst.go.jp/article/example/1/2/1/_pdf",
          access_note: null
        },
        source_metadata: {
          volume: "1",
          issue: "2",
          first_page: "12",
          last_page: "34"
        },
        raw: {}
      }
    });

    await sessions.appendEntry({
      tool: "jp_lit_get_record",
      input: {
        source: "jstage_articles",
        source_id: "/article/example/1/2/1/_article/-char/ja"
      },
      cache_key: "sha256-csl-record",
      result_ref: {
        tool: "jp_lit_get_record",
        cache_key: "sha256-csl-record"
      },
      selected_items: [
        {
          source: "jstage_articles",
          source_id: "/article/example/1/2/1/_article/-char/ja",
          title: "近代文学研究の一例",
          label: "confirmed",
          note: "detail checked"
        }
      ],
      notes: []
    });

    const exportPath = path.join(baseDir, "exports", "selected.csl.json");
    const result = await tool({
      format: "csl-json",
      profile: "selected",
      output_path: exportPath
    });

    const written = JSON.parse(await readFile(exportPath, "utf8")) as Array<{
      type: string;
      title: string;
      author: Array<{ literal: string }>;
      issued: { "date-parts": number[][] };
      "container-title"?: string;
      DOI?: string;
      ISSN?: string;
      volume?: string;
      issue?: string;
      page?: string;
      URL?: string;
      note?: string;
    }>;

    expect(result.structuredContent.format).toBe("csl-json");
    expect(result.structuredContent.item_count).toBe(1);
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      type: "article-journal",
      title: "近代文学研究の一例",
      author: [{ literal: "山田太郎" }],
      issued: { "date-parts": [[2020, 4, 1]] },
      "container-title": "日本文学研究",
      DOI: "10.1234/example.1",
      ISSN: "1234-5678",
      volume: "1",
      issue: "2",
      page: "12-34",
      URL: "https://www.jstage.jst.go.jp/article/example/1/2/1/_article/-char/ja"
    });
    expect(written[0]?.note).toContain("source: jstage_articles");
    expect(written[0]?.note).toContain("selection: confirmed");
    expect(written[0]?.note).toContain("selection note: detail checked");
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
