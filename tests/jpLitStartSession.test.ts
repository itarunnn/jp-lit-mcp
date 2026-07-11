import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { exportSessionInputSchema } from "../src/lib/schemas.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitStartSessionTool } from "../src/tools/jpLitStartSession.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-start-session-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_start_session", () => {
  it("stores goal and scope while keeping the previous session readable", async () => {
    const store = createSessionStore(await createTempDir());
    const previous = await store.readCurrent();
    const tool = createJpLitStartSessionTool(store);

    const result = await tool({
      research_goal: "近代文学の受容を調べる",
      scope_note: "新聞資料は次段階"
    });

    expect(result.structuredContent).toMatchObject({
      trace: {
        research_goal: "近代文学の受容を調べる",
        scope_note: "新聞資料は次段階",
        source_plans: [],
        open_questions: [],
        next_actions: []
      }
    });
    expect(result.structuredContent.session_id).not.toBe(previous.session_id);
    await expect(store.readById(previous.session_id)).resolves.toEqual(previous);
    expect(() =>
      exportSessionInputSchema.parse({
        session_id: result.structuredContent.session_id
      })
    ).not.toThrow();
  });
});
