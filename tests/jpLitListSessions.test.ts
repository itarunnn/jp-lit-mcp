import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { getSessionsRoot } from "../src/lib/persistence/paths.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitListSessionsTool } from "../src/tools/jpLitListSessions.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-list-sessions-"));
  tempDirs.push(dir);
  return dir;
}

async function writeSession(
  baseDir: string,
  session: {
    session_id: string;
    created_at: string;
    updated_at: string;
    trace?: Record<string, unknown>;
    entries: Array<{
      query?: string;
      source?: string;
      selectedTitles?: string[];
      decisions?: unknown[];
      evidenceScope?: unknown[];
    }>;
  }
) {
  const sessionsRoot = getSessionsRoot(baseDir);
  await mkdir(sessionsRoot, { recursive: true });
  await writeFile(
    path.join(sessionsRoot, `${session.session_id}.json`),
    JSON.stringify(
      {
        session_id: session.session_id,
        created_at: session.created_at,
        updated_at: session.updated_at,
        ...(session.trace ? { trace: session.trace } : {}),
        entries: session.entries.map((entry, entryIndex) => ({
          tool: "jp_lit_search",
          input: {
            ...(entry.query ? { query: entry.query } : {}),
            ...(entry.source ? { source: entry.source } : {})
          },
          cache_key: `sha256-${session.session_id}-${entryIndex}`,
          result_ref: {
            tool: "jp_lit_search",
            cache_key: `sha256-${session.session_id}-${entryIndex}`
          },
          selected_items: (entry.selectedTitles ?? []).map((title, titleIndex) => ({
            source: entry.source ?? "ndl_catalog",
            source_id: `${session.session_id}-${entryIndex}-${titleIndex}`,
            title,
            label: "strong_candidate",
            note: null
          })),
          notes: [],
          ...(entry.decisions || entry.evidenceScope
            ? {
                trace: {
                  decisions: entry.decisions ?? [],
                  evidence_scope: entry.evidenceScope ?? []
                }
              }
            : {})
        }))
      },
      null,
      2
    ),
    "utf8"
  );
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_list_sessions", () => {
  it("lists sessions newest first with trace and preview counts", async () => {
    const baseDir = await createTempDir();
    await writeSession(baseDir, {
      session_id: "2026-05-01-090000",
      created_at: "2026-05-01T09:00:00.000Z",
      updated_at: "2026-05-01T09:10:00.000Z",
      entries: [{ query: "夏目漱石", source: "ndl_catalog" }]
    });
    await writeSession(baseDir, {
      session_id: "2026-05-01-100000",
      created_at: "2026-05-01T10:00:00.000Z",
      updated_at: "2026-05-01T10:30:00.000Z",
      trace: {
        research_goal: "韓国における賭博の事情",
        scope_note: "本文確認は未実施",
        source_plans: [
          {
            source: "cinii_articles",
            status: "used",
            reason: "研究論文確認",
            created_at: "2026-05-01T10:01:00.000Z"
          }
        ],
        open_questions: [
          {
            question: "取締中心か民俗中心か",
            reason: "検索語が変わるため",
            created_at: "2026-05-01T10:02:00.000Z"
          }
        ],
        next_actions: [
          {
            action: "判例資料を確認",
            reason: "司法資料が有用",
            priority: "high",
            source: "ndl_digital",
            created_at: "2026-05-01T10:03:00.000Z"
          }
        ]
      },
      entries: [
        {
          query: "朝鮮 賭博",
          source: "cinii_articles",
          selectedTitles: ["朝鮮式カルタ「闘牋」のもつ意味"],
          decisions: [
            {
              kind: "adopt",
              target: { title: "朝鮮式カルタ「闘牋」のもつ意味" },
              reason: "主題に直結",
              evidence_refs: [],
              created_at: "2026-05-01T10:04:00.000Z"
            }
          ],
          evidenceScope: [
            {
              target: { title: "朝鮮式カルタ「闘牋」のもつ意味" },
              checked: "metadata",
              body_status: "online_entry_unread",
              evidence_refs: []
            }
          ]
        },
        {
          query: "闘牋",
          source: "ndl_catalog",
          selectedTitles: ["朝鮮賭博要覧"]
        }
      ]
    });

    const tool = createJpLitListSessionsTool(createSessionStore(baseDir));
    const result = await tool({});

    expect(result.structuredContent.total).toBe(2);
    expect(result.structuredContent.limit).toBe(20);
    expect(result.structuredContent.items[0]).toMatchObject({
      session_id: "2026-05-01-100000",
      research_goal: "韓国における賭博の事情",
      scope_note: "本文確認は未実施",
      entry_count: 2,
      selected_count: 2,
      source_count: 3,
      sources: ["cinii_articles", "ndl_catalog", "ndl_digital"],
      query_preview: "朝鮮 賭博",
      selected_title_preview: "朝鮮式カルタ「闘牋」のもつ意味",
      has_trace: true,
      has_selected: true,
      trace_counts: {
        source_plan_count: 1,
        open_question_count: 1,
        next_action_count: 1,
        decision_count: 1,
        evidence_scope_count: 1
      }
    });
    expect(result.structuredContent.items.map((item) => item.session_id)).toEqual([
      "2026-05-01-100000",
      "2026-05-01-090000"
    ]);
  });

  it("filters by trace, selected items, source, and updated date range", async () => {
    const baseDir = await createTempDir();
    await writeSession(baseDir, {
      session_id: "2026-05-01-090000",
      created_at: "2026-05-01T09:00:00.000Z",
      updated_at: "2026-05-01T09:10:00.000Z",
      entries: [{ query: "古典", source: "ndl_catalog" }]
    });
    await writeSession(baseDir, {
      session_id: "2026-05-02-090000",
      created_at: "2026-05-02T09:00:00.000Z",
      updated_at: "2026-05-02T09:10:00.000Z",
      trace: {
        research_goal: "CiNii 論文調査",
        source_plans: [],
        open_questions: [],
        next_actions: []
      },
      entries: [
        {
          query: "近代",
          source: "cinii_articles",
          selectedTitles: ["近代文学論"]
        }
      ]
    });
    const tool = createJpLitListSessionsTool(createSessionStore(baseDir));

    const result = await tool({
      has_trace: true,
      has_selected: true,
      source: "cinii_articles",
      updated_from: "2026-05-02T00:00:00.000Z",
      updated_to: "2026-05-02T23:59:59.999Z"
    });

    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.items[0]?.session_id).toBe("2026-05-02-090000");
  });

  it("supports created_at sorting and limit", async () => {
    const baseDir = await createTempDir();
    await writeSession(baseDir, {
      session_id: "2026-05-01-090000",
      created_at: "2026-05-01T09:00:00.000Z",
      updated_at: "2026-05-03T09:00:00.000Z",
      entries: [{ query: "先に作成", source: "ndl_catalog" }]
    });
    await writeSession(baseDir, {
      session_id: "2026-05-02-090000",
      created_at: "2026-05-02T09:00:00.000Z",
      updated_at: "2026-05-02T09:00:00.000Z",
      entries: [{ query: "後に作成", source: "ndl_catalog" }]
    });
    const tool = createJpLitListSessionsTool(createSessionStore(baseDir));

    const result = await tool({
      sort_by: "created_at",
      sort_order: "asc",
      limit: 1
    });

    expect(result.structuredContent.total).toBe(2);
    expect(result.structuredContent.items).toHaveLength(1);
    expect(result.structuredContent.items[0]?.session_id).toBe("2026-05-01-090000");
  });
});
