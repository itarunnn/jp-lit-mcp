import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSessionStore } from "../../src/lib/persistence/sessionStore.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-session-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("session store", () => {
  it("creates current session and appends entries", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);

    const session = await store.appendEntry({
      tool: "jp_lit_search",
      input: { query: "foo" },
      cache_key: "sha256-a",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-a"
      },
      selected_items: [],
      notes: []
    });

    expect(session.entries).toHaveLength(1);
    expect(session.entries[0]?.tool).toBe("jp_lit_search");
  });

  it("updates selected items by tool and cache key", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);

    await store.appendEntry({
      tool: "jp_lit_search",
      input: { query: "foo" },
      cache_key: "sha256-a",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-a"
      },
      selected_items: [],
      notes: []
    });

    const session = await store.annotateEntry({
      tool: "jp_lit_search",
      cache_key: "sha256-a",
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "123",
          title: "foo",
          label: "strong_candidate",
          note: "first pass"
        }
      ],
      notes: ["kept for review"]
    });

    expect(session.entries[0]?.selected_items).toHaveLength(1);
    expect(session.entries[0]?.notes).toEqual(["kept for review"]);
  });

  it("appends session trace without changing existing entries", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);

    await store.appendEntry({
      tool: "jp_lit_search",
      input: { query: "foo" },
      cache_key: "sha256-a",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-a"
      },
      selected_items: [],
      notes: []
    });

    const first = await store.updateTrace({
      research_goal: "近代日本の労働文化を調べる",
      scope_note: "新聞 DB は未確認",
      source_plans: [
        {
          source: "cinii_articles",
          status: "planned",
          reason: "論文側の初動確認",
          expected_contribution: "論文候補の把握"
        }
      ],
      open_questions: [
        {
          question: "戦前期を含めるか",
          reason: "検索語が変わるため",
          related_sources: ["ndl_digital"]
        }
      ],
      next_actions: [
        {
          action: "NDL デジコレ全文を確認する",
          reason: "同時代資料を補うため",
          priority: "medium",
          source: "ndl_digital"
        }
      ]
    });

    const second = await store.updateTrace({
      source_plans: [
        {
          source: "ndl_digital",
          status: "planned",
          reason: "同時代資料を確認するため"
        }
      ]
    });

    expect(first.trace?.research_goal).toBe("近代日本の労働文化を調べる");
    expect(first.trace?.source_plans).toHaveLength(1);
    expect(first.trace?.source_plans[0]?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(first.entries).toHaveLength(1);
    expect(second.trace?.source_plans).toHaveLength(2);
    expect(second.trace?.scope_note).toBe("新聞 DB は未確認");
  });

  it("merges entry trace while preserving selected item behavior", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);

    await store.appendEntry({
      tool: "jp_lit_search",
      input: { query: "foo" },
      cache_key: "sha256-a",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "sha256-a"
      },
      selected_items: [],
      notes: []
    });

    await store.annotateEntry({
      tool: "jp_lit_search",
      cache_key: "sha256-a",
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "123",
          title: "foo",
          label: "strong_candidate",
          note: "first pass"
        }
      ],
      trace: {
        intent: "topic_literature_review",
        search_attempt: {
          source: "ndl_catalog",
          query: "foo",
          purpose: "初動確認",
          total: 2,
          returned_count: 1,
          extracted_count: 1,
          outcome: "useful",
          next_step: "CiNii を確認する"
        },
        decisions: [
          {
            kind: "hold",
            target: {
              source: "ndl_catalog",
              source_id: "123",
              title: "foo"
            },
            reason: "本文未確認のため保留",
            evidence_refs: [
              {
                tool: "jp_lit_search",
                cache_key: "sha256-a",
                source: "ndl_catalog",
                source_id: "123"
              }
            ]
          }
        ],
        evidence_scope: [
          {
            target: {
              source: "ndl_catalog",
              source_id: "123",
              title: "foo"
            },
            checked: "metadata",
            body_status: "not_checked",
            note: "書誌のみ",
            evidence_refs: []
          }
        ]
      }
    });

    const session = await store.annotateEntry({
      tool: "jp_lit_search",
      cache_key: "sha256-a",
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "123",
          title: "foo",
          label: "confirmed",
          note: "confirmed later"
        }
      ],
      notes: ["updated"],
      trace: {
        decisions: [
          {
            kind: "adopt",
            target: {
              source: "ndl_catalog",
              source_id: "123",
              title: "foo"
            },
            reason: "追加確認で採用",
            evidence_refs: []
          }
        ],
        evidence_scope: []
      }
    });

    const entry = session.entries[0];
    expect(entry?.selected_items[0]?.label).toBe("confirmed");
    expect(entry?.notes).toEqual(["updated"]);
    expect(entry?.trace?.search_attempt?.query).toBe("foo");
    expect(entry?.trace?.decisions).toHaveLength(2);
    expect(entry?.trace?.decisions[0]?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry?.trace?.evidence_scope).toHaveLength(1);
  });

  it("fails when annotation target does not exist", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);

    await expect(
      store.annotateEntry({
        tool: "jp_lit_search",
        cache_key: "missing",
        selected_items: [],
        notes: []
      })
    ).rejects.toThrow("Session entry not found");
  });
});
