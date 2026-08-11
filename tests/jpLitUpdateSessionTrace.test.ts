import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitUpdateSessionTraceTool } from "../src/tools/jpLitUpdateSessionTrace.js";

const tempDirs: string[] = [];

const agentWebEvidence = {
  evidence_type: "agent_web" as const,
  stability: "ephemeral" as const,
  discovery_source: "Yahoo!リアルタイム検索",
  query: "河野有理 McMullen Nakai",
  url: "https://search.yahoo.co.jp/realtime/example-post",
  author: "河野有理",
  published_at: "2026-08-10T09:00:00+09:00",
  checked_at: "2026-08-10T10:00:00+09:00",
  linked_urls: ["https://example.org/review"],
  quote_or_summary: "書評と掲載誌情報へ進む発見経路"
};

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-trace-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_update_session_trace", () => {
  it("records a complete ephemeral web discovery as the origin of a next action", async () => {
    const baseDir = await createTempDir();
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitUpdateSessionTraceTool(sessions);
    const target = await sessions.readCurrent();

    await tool({
      session_id: target.session_id,
      next_actions: [
        {
          action: "リンク先の書評と掲載情報を正式 source で確認する",
          reason: "速報 Web 投稿は調査の発端であり確証ではないため",
          priority: "high",
          evidence_refs: [agentWebEvidence]
        }
      ]
    });

    const session = await sessions.readCurrent();

    expect(session.trace?.next_actions[0]?.evidence_refs?.[0]).toEqual(
      agentWebEvidence
    );
  });

  it.each([
    ["missing author", { author: undefined }],
    ["wrong stability", { stability: "stable" }],
    ["invalid published_at", { published_at: "yesterday" }],
    ["invalid post url", { url: "not-a-url" }],
    ["empty linked_urls", { linked_urls: [] }]
  ])("rejects incomplete agent_web evidence: %s", async (_name, patch) => {
    const baseDir = await createTempDir();
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitUpdateSessionTraceTool(sessions);

    await expect(
      tool({
        session_id: (await sessions.readCurrent()).session_id,
        next_actions: [
          {
            action: "正式 source で確認する",
            reason: "速報 Web 投稿だけでは確証にならないため",
            priority: "high",
            evidence_refs: [{ ...agentWebEvidence, ...patch }]
          }
        ]
      })
    ).rejects.toThrow();
  });

  it("continues to accept legacy evidence references", async () => {
    const baseDir = await createTempDir();
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitUpdateSessionTraceTool(sessions);
    const target = await sessions.readCurrent();
    const evidence = {
      url: "https://example.org/official",
      quote_or_summary: "公式確認先"
    };

    await tool({
      session_id: target.session_id,
      next_actions: [
        {
          action: "公式確認先を読む",
          reason: "従来形式の根拠参照を維持するため",
          priority: "medium",
          evidence_refs: [evidence]
        }
      ]
    });

    const session = await sessions.readCurrent();
    expect(session.trace?.next_actions[0]?.evidence_refs?.[0]).toEqual(evidence);
  });

  it("appends session-level research trace and returns total counts", async () => {
    const baseDir = await createTempDir();
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitUpdateSessionTraceTool(sessions);
    const target = await sessions.readCurrent();

    const first = await tool({
      session_id: target.session_id,
      research_goal: "近代日本の労働文化を調べる",
      scope_note: "新聞 DB は未確認",
      source_plans: [
        {
          source: "cinii_articles",
          status: "planned",
          reason: "人文社会系論文の初動確認",
          expected_contribution: "論文候補の把握"
        }
      ],
      open_questions: [
        {
          question: "戦前期を含めるか",
          reason: "検索語が変わるため",
          related_sources: ["ndl_digital"],
          evidence_refs: [
            {
              tool: "jp_lit_search",
              cache_key: "sha256-a",
              source: "ndl_digital",
              source_id: "R100",
              quote_or_summary: "戦前期資料候補"
            }
          ]
        }
      ],
      next_actions: [
        {
          action: "NDL デジコレ全文で旧語を検索する",
          reason: "同時代資料を補うため",
          priority: "medium",
          source: "ndl_digital",
          evidence_refs: [
            {
              source: "ndl_digital",
              source_id: "R100"
            }
          ]
        }
      ]
    });

    const second = await tool({
      session_id: target.session_id,
      source_plans: [
        {
          source: "ndl_digital",
          status: "planned",
          reason: "同時代資料を確認するため"
        }
      ]
    });

    const session = await sessions.readCurrent();

    expect(first.structuredContent.source_plan_count).toBe(1);
    expect(second.structuredContent.source_plan_count).toBe(2);
    expect(second.structuredContent.open_question_count).toBe(1);
    expect(second.structuredContent.next_action_count).toBe(1);
    expect(session.trace?.research_goal).toBe("近代日本の労働文化を調べる");
    expect(session.trace?.source_plans[0]?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(session.trace?.open_questions[0]?.evidence_refs?.[0]?.source_id).toBe("R100");
    expect(session.trace?.next_actions[0]?.evidence_refs?.[0]?.source_id).toBe("R100");
  });

  it("rejects caller-supplied created_at values", async () => {
    const baseDir = await createTempDir();
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitUpdateSessionTraceTool(sessions);

    await expect(
      tool({
        session_id: (await sessions.readCurrent()).session_id,
        source_plans: [
          {
            source: "cinii_articles",
            status: "planned",
            reason: "invalid timestamp should fail",
            created_at: "2000-01-01T00:00:00.000Z"
          }
        ]
      })
    ).rejects.toThrow();
  });
});
