import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCacheKey } from "../src/lib/persistence/cacheKeys.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionExporter } from "../src/lib/persistence/exportSession.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitExportSessionTool as createExplicitJpLitExportSessionTool } from "../src/tools/jpLitExportSession.js";

function createJpLitExportSessionTool(...args: Parameters<typeof createExplicitJpLitExportSessionTool>) {
  const [sessions] = args;
  const tool = createExplicitJpLitExportSessionTool(...args);
  return async (input: unknown) => {
    const current = await sessions.readCurrent();
    const payload = input && typeof input === "object" && !Array.isArray(input)
      ? input as Record<string, unknown>
      : {};
    return tool({ session_id: current.session_id, ...payload });
  };
}

const tempDirs: string[] = [];

function fixtureCacheKey(label: string) {
  return createCacheKey("jp_lit_search", { fixture: label });
}

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-export-"));
  tempDirs.push(dir);
  return dir;
}

async function createExportSessionFixture() {
  const baseDir = await createTempDir();
  const cache = createFileCache(baseDir);
  const sessions = createSessionStore(baseDir);
  const exporter = createSessionExporter(cache, baseDir);
  const tool = createJpLitExportSessionTool(sessions, exporter);
  await sessions.appendEntry({
    tool: "jp_lit_search",
    input: { query: "boundary" },
    cache_key: fixtureCacheKey("boundary"),
    result_ref: {
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("boundary")
    },
    selected_items: [],
    notes: []
  });
  return { baseDir, tool };
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
      cache_key: fixtureCacheKey("sha256-a"),
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
            source_id: "R100000039-I456",
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
            url: "https://ndlsearch.ndl.go.jp/books/R100000039-I456",
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
      cache_key: fixtureCacheKey("sha256-a"),
      result_ref: {
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("sha256-a")
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
    expect(written).not.toContain("Research Goal");
    expect(written).not.toContain("Search Attempt");
  });

  it("writes trace sections in markdown export without changing selected item output", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("sha256-trace"),
      saved_at: new Date().toISOString(),
      input: { query: "trace" },
      structured_content: {
        query: "trace",
        source: "ndl_catalog",
        page: 1,
        limit: 1,
        total: 1,
        items: [
          {
            source: "ndl_catalog",
            source_id: "T1",
            title: "trace item",
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

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "trace" },
      cache_key: fixtureCacheKey("sha256-trace"),
      result_ref: {
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("sha256-trace")
      },
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "T1",
          title: "trace item",
          label: "strong_candidate",
          note: "still selected"
        }
      ],
      notes: ["memo"]
    });

    await sessions.updateTrace({
      research_goal: "trace を確認する",
      scope_note: "session-level trace のみ確認",
      source_plans: [
        {
          source: "ndl_catalog",
          status: "used",
          reason: "初動確認",
          expected_contribution: "書誌確認"
        }
      ],
      open_questions: [
        {
          question: "本文を見るか",
          reason: "内容確認には本文が必要",
          evidence_refs: [
            {
              tool: "jp_lit_search",
              cache_key: fixtureCacheKey("sha256-trace"),
              source: "ndl_catalog",
              source_id: "T1"
            }
          ]
        }
      ],
      next_actions: [
        {
          action: "本文確認",
          reason: "メタデータのみでは不足",
          priority: "high",
          source: "ndl_digital",
          evidence_refs: [
            {
              evidence_type: "agent_web",
              stability: "ephemeral",
              discovery_source: "Yahoo!リアルタイム検索",
              query: "河野有理 McMullen Nakai",
              url: "https://search.yahoo.co.jp/realtime/example-post",
              author: "河野有理",
              published_at: "2026-08-10T09:00:00+09:00",
              checked_at: "2026-08-10T10:00:00+09:00",
              linked_urls: ["https://example.org/review"],
              quote_or_summary: "書評と掲載誌情報へ進む発見経路"
            }
          ]
        }
      ]
    });

    await sessions.annotateEntry({
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("sha256-trace"),
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "T1",
          title: "trace item",
          label: "strong_candidate",
          note: "still selected"
        }
      ],
      trace: {
        agent_label: "NDL/CiNii 担当",
        task_scope: "書誌と本文入口の確認",
        search_attempt: {
          source: "ndl_catalog",
          query: "trace",
          purpose: "trace export の確認",
          total: 1,
          returned_count: 1,
          extracted_count: 1,
          outcome: "useful"
        },
        decisions: [
          {
            kind: "hold",
            target: {
              source: "ndl_catalog",
              source_id: "T1",
              title: "trace item"
            },
            reason: "本文未確認のため保留",
            evidence_refs: [
              {
                tool: "jp_lit_search",
                cache_key: fixtureCacheKey("sha256-trace"),
                source: "ndl_catalog",
                source_id: "T1"
              }
            ]
          }
        ],
        evidence_scope: [
          {
            target: {
              source: "ndl_catalog",
              source_id: "T1",
              title: "trace item"
            },
            checked: "metadata",
            body_status: "not_checked",
            note: "書誌のみ",
            evidence_refs: []
          }
        ]
      }
    });

    const exportPath = path.join(baseDir, "exports", "trace.md");
    await tool({
      format: "markdown",
      output_path: exportPath
    });

    const written = await readFile(exportPath, "utf8");

    expect(written).toContain("## Research Goal");
    expect(written).toContain("trace を確認する");
    expect(written).toContain("## Source Plan");
    expect(written).toContain("ndl_catalog");
    expect(written).toContain("## Open Questions");
    expect(written).toContain("本文を見るか");
    expect(written).toContain("evidence:");
    expect(written).toContain("ndl_catalog/T1");
    expect(written).toContain("## Next Actions");
    expect(written).toContain("本文確認");
    expect(written).toContain("agent_web / ephemeral");
    expect(written).toContain("Yahoo!リアルタイム検索");
    expect(written).toContain("河野有理 McMullen Nakai");
    expect(written).toContain("河野有理");
    expect(written).toContain("2026-08-10T09:00:00+09:00");
    expect(written).toContain("2026-08-10T10:00:00+09:00");
    expect(written).toContain(
      "https://search.yahoo.co.jp/realtime/example-post"
    );
    expect(written).toContain("https://example.org/review");
    expect(written).toContain("### Agent Scope");
    expect(written).toContain("NDL/CiNii 担当");
    expect(written).toContain("書誌と本文入口の確認");
    expect(written).toContain("### Search Attempt");
    expect(written).toContain("trace export の確認");
    expect(written).toContain("### Decisions");
    expect(written).toContain("[hold]");
    expect(written).toContain("本文未確認のため保留");
    expect(written).toContain("### Evidence Scope");
    expect(written).toContain("metadata / not_checked");
    expect(written).toContain("[strong_candidate] trace item (ndl_catalog/T1) - still selected");
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
      cache_key: fixtureCacheKey("sha256-b"),
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
            source_id: "R100000039-I456",
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
            url: "https://ndlsearch.ndl.go.jp/books/R100000039-I456",
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
      cache_key: fixtureCacheKey("sha256-b"),
      result_ref: {
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("sha256-b")
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
      cache_key: fixtureCacheKey("sha256-csl-record"),
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
      cache_key: fixtureCacheKey("sha256-csl-record"),
      result_ref: {
        tool: "jp_lit_get_record",
        cache_key: fixtureCacheKey("sha256-csl-record")
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
    expect(JSON.stringify(written)).not.toContain("trace");
    expect(JSON.stringify(written)).not.toContain("Search Attempt");
  });

  it("normalizes fulltext candidate cache for selected and unselected session exports", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);
    const cacheKey = fixtureCacheKey("sha256-fulltext-candidates");

    await cache.write("jp_lit_search_fulltext", {
      version: 1,
      tool: "jp_lit_search_fulltext",
      cache_key: cacheKey,
      saved_at: "2026-09-05T03:00:00.000Z",
      input: { keyword: "普通選挙法" },
      structured_content: {
        keyword: "普通選挙法",
        searchfield: "contentonly",
        total: 2,
        from: 0,
        items: [
          {
            pid: "1907653",
            viewer_url: "https://dl.ndl.go.jp/pid/1907653",
            title: "帝国憲法大要",
            volume: null,
            responsibility: "斉藤隆夫 著",
            publisher: "憲政公論社",
            published: "大正15",
            publishyear: 1926,
            ndc: "323",
            bib_id: "000000000001",
            call_no: "特1-1",
            page_count: 123,
            is_classic: false,
            highlights: ["普通選挙法"]
          },
          {
            pid: "1907654",
            viewer_url: "https://dl.ndl.go.jp/pid/1907654",
            title: "普通選挙法要義",
            volume: null,
            responsibility: "田中一郎 著",
            publisher: "公論社",
            published: "昭和2",
            publishyear: 1927,
            ndc: "314",
            bib_id: "000000000002",
            call_no: "特1-2",
            page_count: 88,
            is_classic: false,
            highlights: ["普通選挙法"]
          }
        ],
        raw: {}
      }
    });
    await sessions.appendEntry({
      tool: "jp_lit_search_fulltext",
      input: { keyword: "普通選挙法" },
      cache_key: cacheKey,
      result_ref: { tool: "jp_lit_search_fulltext", cache_key: cacheKey },
      selected_items: [{
        source: "ndl_digital",
        source_id: "R100000039-I1907653",
        title: "帝国憲法大要",
        label: "strong_candidate",
        note: "selected fulltext"
      }],
      notes: []
    });

    const selectedPath = path.join(baseDir, "exports", "fulltext-selected.csl.json");
    const unselectedPath = path.join(baseDir, "exports", "fulltext-unselected.csl.json");
    const unselectedJsonPath = path.join(baseDir, "exports", "fulltext-unselected.json");
    await tool({ format: "csl-json", profile: "selected", output_path: selectedPath });
    await tool({ format: "csl-json", profile: "unselected", output_path: unselectedPath });
    await tool({ format: "json", profile: "unselected", output_path: unselectedJsonPath });

    const selected = JSON.parse(await readFile(selectedPath, "utf8")) as Array<Record<string, unknown>>;
    const unselected = JSON.parse(await readFile(unselectedPath, "utf8")) as Array<Record<string, unknown>>;
    const unselectedJson = JSON.parse(await readFile(unselectedJsonPath, "utf8")) as {
      entries: Array<{ unselected_items: Array<Record<string, unknown>> }>;
    };
    expect(selected).toMatchObject([{
      type: "book",
      id: "ndl_digital:R100000039-I1907653",
      title: "帝国憲法大要",
      author: [{ literal: "斉藤隆夫 著" }],
      publisher: "憲政公論社",
      issued: { "date-parts": [[1926]] }
    }]);
    expect(unselected).toMatchObject([{
      type: "book",
      id: "ndl_digital:R100000039-I1907654",
      title: "普通選挙法要義",
      author: [{ literal: "田中一郎 著" }]
    }]);
    expect(unselectedJson.entries[0]?.unselected_items).toMatchObject([{
      source: "ndl_digital",
      source_id: "R100000039-I1907654",
      material_type: "図書",
      source_metadata: {
        candidate_origins: ["next_digital_library_fulltext"]
      }
    }]);
  });

  it("adds latest browser provenance to the CSL note without replacing bibliography fields", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);
    const cacheKey = fixtureCacheKey("sha256-browser-csl");
    const olderObservation = {
      checked_at: "2026-09-06T00:30:00+14:00",
      login_state: "logged_out",
      query: "普通選挙法",
      access_scope: "ndl_onsite_only",
      access_label: "国立国会図書館内限定",
      snippets: [],
      item_fulltext_state: "unavailable",
      hit_locations: [],
      content_state: "restricted",
      print_file_state: "unavailable"
    };
    const latestObservation = {
      checked_at: "2026-09-05T23:45:00-12:00",
      login_state: "logged_in_existing_session",
      query: "普通選挙法",
      access_scope: "individual_transmission",
      access_label: "個人送信で閲覧可能",
      snippets: [{ text: "普通選挙法", locator_type: "koma", locator: "67" }],
      item_fulltext_state: "searched",
      hit_locations: ["67–73コマ"],
      content_state: "page_image_checked",
      print_file_state: "dialog_available"
    };

    await cache.write("jp_lit_record_ndl_browser_search", {
      version: 1,
      tool: "jp_lit_record_ndl_browser_search",
      cache_key: cacheKey,
      saved_at: "2026-09-05T03:00:00.000Z",
      input: { query: "普通選挙法" },
      structured_content: {
        query: "普通選挙法",
        source: "ndl_digital",
        page: 1,
        limit: 100,
        total: 1,
        items: [{
          source: "ndl_digital",
          source_id: "R100000039-I1907653",
          title: "帝国憲法大要",
          subtitle: null,
          title_reading: null,
          authors: [{ name: "斉藤隆夫", role: null }],
          publisher: "憲政公論社",
          journal_title: null,
          issued_at: "1926",
          issued_at_label: "1926",
          issued_at_precision: "year",
          summary: null,
          url: "https://dl.ndl.go.jp/pid/1907653",
          availability: { online: true, digital_collection: true },
          material_type: "図書",
          subjects: [],
          table_of_contents: [],
          source_metadata: {
            pid: "1907653",
            candidate_origins: ["ndl_digital_browser"],
            browser_observations: [olderObservation, latestObservation]
          },
          duplicate_key: null,
          duplicate_count: 1,
          related_records: []
        }],
        observation: {
          method: "browser",
          service: "ndl_digital_collections",
          checked_at: latestObservation.checked_at,
          login_state: latestObservation.login_state,
          reported_total: 1,
          total_relation: "reported_exact",
          observed_count: 1,
          filters: {
            access_scopes: ["transmission"],
            material_types: ["図書"],
            raw_labels: ["送信サービスで閲覧可能"]
          }
        }
      }
    });
    await sessions.appendEntry({
      tool: "jp_lit_record_ndl_browser_search",
      input: { query: "普通選挙法" },
      cache_key: cacheKey,
      result_ref: { tool: "jp_lit_record_ndl_browser_search", cache_key: cacheKey },
      selected_items: [{
        source: "ndl_digital",
        source_id: "R100000039-I1907653",
        title: "帝国憲法大要",
        label: "strong_candidate",
        note: "review after browser check"
      }],
      notes: []
    });

    const outputPath = path.join(baseDir, "exports", "browser.csl.json");
    await tool({ format: "csl-json", profile: "selected", output_path: outputPath });
    const written = JSON.parse(await readFile(outputPath, "utf8")) as Array<{
      type: string;
      title: string;
      author: Array<{ literal: string }>;
      publisher: string;
      issued: { "date-parts": number[][] };
      note: string;
    }>;

    expect(written[0]).toMatchObject({
      type: "book",
      title: "帝国憲法大要",
      author: [{ literal: "斉藤隆夫" }],
      publisher: "憲政公論社",
      issued: { "date-parts": [[1926]] }
    });
    expect(written[0]?.note).toContain("selection note: review after browser check");
    expect(written[0]?.note).toContain("acquisition: ndl_digital_browser");
    expect(written[0]?.note).toContain("browser checked_at: 2026-09-05T23:45:00-12:00");
    expect(written[0]?.note).toContain("browser access: individual_transmission");
    expect(written[0]?.note).toContain(
      "browser evidence: item_fulltext=searched, content=page_image_checked, print=dialog_available"
    );
    expect(written[0]?.note).not.toContain("2026-09-06T00:30:00+14:00");
  });

  it("writes cinii_dissertations records as CSL thesis items", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_get_record", {
      version: 1,
      tool: "jp_lit_get_record",
      cache_key: fixtureCacheKey("sha256-csl-dissertation-record"),
      saved_at: new Date().toISOString(),
      input: {
        source: "cinii_dissertations",
        source_id: "1910848250911873152"
      },
      structured_content: {
        source: "cinii_dissertations",
        source_id: "1910848250911873152",
        title: "源氏物語受容史の研究",
        authors: [{ name: "山田太郎", role: "author" }],
        publisher: "京都大学",
        journal_title: null,
        issued_at: "2022",
        issued_at_label: "2022",
        material_type: "doctoral thesis",
        identifiers: {},
        source_metadata: {},
        content_access: {},
        url: "https://cir.nii.ac.jp/crid/1910848250911873152"
      }
    });

    await sessions.appendEntry({
      tool: "jp_lit_get_record",
      input: {
        source: "cinii_dissertations",
        source_id: "1910848250911873152"
      },
      cache_key: fixtureCacheKey("sha256-csl-dissertation-record"),
      result_ref: {
        tool: "jp_lit_get_record",
        cache_key: fixtureCacheKey("sha256-csl-dissertation-record")
      },
      selected_items: [
        {
          source: "cinii_dissertations",
          source_id: "1910848250911873152",
          title: "源氏物語受容史の研究",
          label: "confirmed",
          note: null
        }
      ],
      notes: []
    });

    const exportPath = path.join(baseDir, "exports", "dissertation.csl.json");
    await tool({
      format: "csl-json",
      profile: "selected",
      output_path: exportPath
    });

    const written = JSON.parse(await readFile(exportPath, "utf8")) as Array<{
      type: string;
      publisher?: string;
      note?: string;
    }>;

    expect(written[0]).toMatchObject({
      type: "thesis",
      publisher: "京都大学"
    });
    expect(written[0]?.note).toContain("source: cinii_dissertations");
  });

  it("reports CSL JSON item_count from the written items", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_get_record", {
      version: 1,
      tool: "jp_lit_get_record",
      cache_key: fixtureCacheKey("sha256-csl-unselected-record"),
      saved_at: new Date().toISOString(),
      input: {
        source: "ndl_catalog",
        source_id: "R100"
      },
      structured_content: {
        source: "ndl_catalog",
        source_id: "R100",
        title: "単一レコード",
        authors: [],
        publisher: "出版社",
        journal_title: null,
        issued_at: "1999",
        issued_at_label: "1999",
        material_type: "book",
        identifiers: {},
        source_metadata: {},
        content_access: {},
        url: null
      }
    });

    await sessions.appendEntry({
      tool: "jp_lit_get_record",
      input: {
        source: "ndl_catalog",
        source_id: "R100"
      },
      cache_key: fixtureCacheKey("sha256-csl-unselected-record"),
      result_ref: {
        tool: "jp_lit_get_record",
        cache_key: fixtureCacheKey("sha256-csl-unselected-record")
      },
      selected_items: [],
      notes: []
    });

    const exportPath = path.join(baseDir, "exports", "unselected.csl.json");
    const result = await tool({
      format: "csl-json",
      profile: "unselected",
      output_path: exportPath
    });

    const written = JSON.parse(await readFile(exportPath, "utf8")) as Array<{
      title: string;
    }>;

    expect(written).toHaveLength(1);
    expect(written[0]?.title).toBe("単一レコード");
    expect(result.structuredContent.item_count).toBe(written.length);
  });

  it("keeps CSL JSON full_log focused on selected records", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const exporter = createSessionExporter(cache, baseDir);
    const tool = createJpLitExportSessionTool(sessions, exporter);

    await cache.write("jp_lit_search", {
      version: 1,
      tool: "jp_lit_search",
      cache_key: fixtureCacheKey("sha256-csl-full-log"),
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
            source_id: "S1",
            title: "採用する本",
            subtitle: null,
            title_reading: null,
            authors: [],
            publisher: null,
            journal_title: null,
            issued_at: null,
            issued_at_label: null,
            issued_at_precision: "unknown",
            summary: null,
            material_type: "book",
            availability: { online: false, digital_collection: false },
            subjects: [],
            table_of_contents: [],
            duplicate_key: null,
            duplicate_count: 1,
            related_records: [],
            identifiers: {},
            source_metadata: {},
            content_access: {},
            url: null
          },
          {
            source: "ndl_catalog",
            source_id: "S2",
            title: "採用しない本",
            subtitle: null,
            title_reading: null,
            authors: [],
            publisher: null,
            journal_title: null,
            issued_at: null,
            issued_at_label: null,
            issued_at_precision: "unknown",
            summary: null,
            material_type: "book",
            availability: { online: false, digital_collection: false },
            subjects: [],
            table_of_contents: [],
            duplicate_key: null,
            duplicate_count: 1,
            related_records: [],
            identifiers: {},
            source_metadata: {},
            content_access: {},
            url: null
          }
        ]
      }
    });

    await sessions.appendEntry({
      tool: "jp_lit_search",
      input: { query: "foo" },
      cache_key: fixtureCacheKey("sha256-csl-full-log"),
      result_ref: {
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("sha256-csl-full-log")
      },
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "S1",
          title: "採用する本",
          label: "confirmed",
          note: null
        }
      ],
      notes: []
    });

    const exportPath = path.join(baseDir, "exports", "full-log.csl.json");
    const result = await tool({
      format: "csl-json",
      profile: "full_log",
      include_unselected: true,
      output_path: exportPath
    });

    const written = JSON.parse(await readFile(exportPath, "utf8")) as Array<{
      title: string;
    }>;

    expect(written).toHaveLength(1);
    expect(written[0]?.title).toBe("採用する本");
    expect(result.structuredContent.item_count).toBe(1);
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
      cache_key: fixtureCacheKey("sha256-c"),
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
            source_id: "R100000039-I456",
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
            url: "https://ndlsearch.ndl.go.jp/books/R100000039-I456",
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
      cache_key: fixtureCacheKey("sha256-c"),
      result_ref: {
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("sha256-c")
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
      cache_key: fixtureCacheKey("sha256-d"),
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
            source_id: "R100000039-I222",
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
            url: "https://ndlsearch.ndl.go.jp/books/R100000039-I222",
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
      cache_key: fixtureCacheKey("sha256-d"),
      result_ref: {
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("sha256-d")
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
          source_id: "R100000039-I222",
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
      cache_key: fixtureCacheKey("sha256-e"),
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
            source_id: "R100000039-I222",
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
            url: "https://ndlsearch.ndl.go.jp/books/R100000039-I222",
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
      cache_key: fixtureCacheKey("sha256-e"),
      result_ref: {
        tool: "jp_lit_search",
        cache_key: fixtureCacheKey("sha256-e")
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

  it("requires explicit flags for external paths and existing files", async () => {
    const { baseDir, tool } = await createExportSessionFixture();
    const externalDir = await createTempDir();
    const relativeSandbox = await mkdtemp(path.join(process.cwd(), ".jp-lit-export-test-"));
    tempDirs.push(relativeSandbox);
    const escapedRelativePath = [
      path.relative(process.cwd(), relativeSandbox),
      "exports",
      "..",
      "outside.md"
    ].join(path.sep);
    const externalPath = path.join(externalDir, "external.md");
    const existingInternalPath = path.join(baseDir, "exports", "existing.md");
    const existingExternalPath = path.join(externalDir, "existing-external.md");

    await expect(tool({
      format: "markdown",
      include_unselected: false,
      output_path: escapedRelativePath
    })).rejects.toThrow(/allow_external_path/);

    await expect(tool({
      format: "markdown",
      include_unselected: false,
      output_path: externalPath
    })).rejects.toThrow(/allow_external_path/);

    const relativeResult = await tool({
      format: "markdown",
      include_unselected: false,
      output_path: path.join("exports", "relative.md")
    });
    expect(relativeResult.structuredContent.path).toBe(
      path.join(baseDir, "exports", "relative.md")
    );

    await writeFile(existingInternalPath, "sentinel", "utf8");
    await expect(tool({
      format: "markdown",
      include_unselected: false,
      output_path: existingInternalPath
    })).rejects.toThrow(/overwrite/);
    await expect(tool({
      format: "markdown",
      include_unselected: false,
      output_path: existingInternalPath,
      overwrite: true
    })).resolves.toBeDefined();
    expect(await readFile(existingInternalPath, "utf8")).not.toBe("sentinel");

    await writeFile(existingExternalPath, "external sentinel", "utf8");
    await expect(tool({
      format: "markdown",
      include_unselected: false,
      output_path: existingExternalPath,
      allow_external_path: true
    })).rejects.toThrow(/overwrite/);
    await expect(tool({
      format: "markdown",
      include_unselected: false,
      output_path: existingExternalPath,
      allow_external_path: true,
      overwrite: true
    })).resolves.toBeDefined();
    expect(await readFile(existingExternalPath, "utf8")).not.toBe("external sentinel");
  });

  it("rejects an exports junction that resolves outside the exports root", async () => {
    const { baseDir, tool } = await createExportSessionFixture();
    const externalDir = await createTempDir();
    const exportsDir = path.join(baseDir, "exports");
    const linkedDir = path.join(exportsDir, "linked");
    await mkdir(exportsDir, { recursive: true });
    await symlink(externalDir, linkedDir, process.platform === "win32" ? "junction" : "dir");

    await expect(tool({
      format: "markdown",
      include_unselected: false,
      output_path: path.join(linkedDir, "escaped.md")
    })).rejects.toThrow(/allow_external_path/);
  });

  it.runIf(process.platform === "win32")(
    "accepts the exports root when only Windows path casing differs",
    async () => {
      const { baseDir, tool } = await createExportSessionFixture();
      await mkdir(path.join(baseDir, "Exports"), { recursive: true });

      await expect(tool({
        format: "markdown",
        include_unselected: false,
        output_path: path.join(baseDir, "exports", "case-insensitive.md")
      })).resolves.toBeDefined();
    }
  );
});
