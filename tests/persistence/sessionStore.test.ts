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
  const entryA = {
    tool: "jp_lit_search",
    input: { query: "alpha" },
    cache_key: "sha256-alpha",
    result_ref: {
      tool: "jp_lit_search",
      cache_key: "sha256-alpha"
    },
    selected_items: [],
    notes: []
  };
  const entryB = {
    tool: "jp_lit_get_record",
    input: { source: "ndl_catalog", source_id: "beta" },
    cache_key: "sha256-beta",
    result_ref: {
      tool: "jp_lit_get_record",
      cache_key: "sha256-beta"
    },
    selected_items: [],
    notes: []
  };

  it("starts a new current session while preserving the previous archive", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);
    const first = await store.readCurrent();

    const second = await store.startSession({
      research_goal: "new research",
      scope_note: "new scope"
    });

    expect(second.session_id).not.toBe(first.session_id);
    expect(second.session_id).toMatch(
      /^\d{4}-\d{2}-\d{2}-\d{6}-[0-9a-f]{8}$/
    );
    await expect(store.readById(first.session_id)).resolves.toEqual(first);
    expect(await store.readCurrent()).toMatchObject({
      session_id: second.session_id,
      entries: [],
      trace: {
        research_goal: "new research",
        scope_note: "new scope"
      }
    });
  });

  it("starts the first session without creating a synthetic previous archive", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);

    const first = await store.startSession({ research_goal: "first research" });

    expect(await store.readCurrent()).toEqual(first);
    expect(await store.listAll()).toEqual([first]);
  });

  it("serializes concurrent append operations", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);

    await Promise.all([store.appendEntry(entryA), store.appendEntry(entryB)]);

    expect((await store.readCurrent()).entries).toEqual(
      expect.arrayContaining([entryA, entryB])
    );
  });

  it("routes explicit mutations without switching the current session", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);
    const first = await store.startSession({ research_goal: "first" });
    const second = await store.startSession({ research_goal: "second" });

    await store.appendEntry(entryA, first.session_id);
    await store.updateTrace({ scope_note: "first-only" }, first.session_id);

    expect(await store.readById(first.session_id)).toMatchObject({
      entries: [entryA],
      trace: {
        research_goal: "first",
        scope_note: "first-only"
      }
    });
    expect(await store.readCurrent()).toMatchObject({
      session_id: second.session_id,
      entries: [],
      trace: { research_goal: "second" }
    });
  });

  it("orders a concurrent start before a following append without losing either session", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);
    const first = await store.readCurrent();

    const startPromise = store.startSession({ research_goal: "second" });
    const appendPromise = store.appendEntry(entryA);
    const [second, appended] = await Promise.all([startPromise, appendPromise]);

    expect(appended.session_id).toBe(second.session_id);
    expect((await store.readCurrent()).entries).toEqual([entryA]);
    await expect(store.readById(first.session_id)).resolves.toEqual(first);
  });

  it("continues processing queued mutations after a rejected mutation", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);

    const rejected = store.annotateEntry({
      tool: "jp_lit_search",
      cache_key: "missing",
      selected_items: []
    });
    const appended = store.appendEntry(entryA);

    await expect(rejected).rejects.toThrow("Session entry not found");
    await expect(appended).resolves.toMatchObject({ entries: [entryA] });
  });

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

  it("同一entryの最新metadataを反映しつつ利用者注釈を保持し、明示clearはannotateだけで行う", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);
    const selectedItem = {
      source: "ndl_catalog",
      source_id: "123",
      title: "foo",
      label: "strong_candidate" as const,
      note: "keep"
    };

    await store.appendEntry(entryA);
    await store.annotateEntry({
      tool: entryA.tool,
      cache_key: entryA.cache_key,
      selected_items: [selectedItem],
      notes: ["利用者メモ"],
      trace: {
        intent: "topic_literature_review",
        decisions: [
          {
            kind: "hold",
            target: { source_id: "123", title: "foo" },
            reason: "本文未確認",
            evidence_refs: []
          }
        ]
      }
    });

    const rerun = await store.appendEntry({
      ...entryA,
      input: { query: "alpha", normalized: true },
      selected_items: [],
      notes: []
    });

    expect(rerun.entries).toHaveLength(1);
    expect(rerun.entries[0]).toMatchObject({
      input: { query: "alpha", normalized: true },
      selected_items: [selectedItem],
      notes: ["利用者メモ"],
      trace: {
        intent: "topic_literature_review",
        decisions: [expect.objectContaining({ reason: "本文未確認" })]
      }
    });

    const cleared = await store.annotateEntry({
      tool: entryA.tool,
      cache_key: entryA.cache_key,
      selected_items: [],
      notes: []
    });
    expect(cleared.entries).toHaveLength(1);
    expect(cleared.entries[0]?.selected_items).toEqual([]);
    expect(cleared.entries[0]?.notes).toEqual([]);
    expect(cleared.entries[0]?.trace?.intent).toBe("topic_literature_review");
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
