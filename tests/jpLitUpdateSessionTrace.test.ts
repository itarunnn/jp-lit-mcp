import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitUpdateSessionTraceTool } from "../src/tools/jpLitUpdateSessionTrace.js";

const tempDirs: string[] = [];

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
  it("appends session-level research trace and returns total counts", async () => {
    const baseDir = await createTempDir();
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitUpdateSessionTraceTool(sessions);

    const first = await tool({
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
          related_sources: ["ndl_digital"]
        }
      ],
      next_actions: [
        {
          action: "NDL デジコレ全文で旧語を検索する",
          reason: "同時代資料を補うため",
          priority: "medium",
          source: "ndl_digital"
        }
      ]
    });

    const second = await tool({
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
  });

  it("rejects caller-supplied created_at values", async () => {
    const baseDir = await createTempDir();
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitUpdateSessionTraceTool(sessions);

    await expect(
      tool({
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
