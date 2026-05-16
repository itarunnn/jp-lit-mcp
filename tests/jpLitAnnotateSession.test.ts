import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import { createJpLitAnnotateSessionTool } from "../src/tools/jpLitAnnotateSession.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-annotate-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("jp_lit_annotate_session", () => {
  it("stores selected items in the current session", async () => {
    const baseDir = await createTempDir();
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitAnnotateSessionTool(sessions);

    await sessions.appendEntry({
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

    const result = await tool({
      tool: "jp_lit_search",
      cache_key: "sha256-a",
      selected_items: [
        {
          source: "ndl_catalog",
          source_id: "123",
          title: "foo",
          label: "strong_candidate",
          note: "keep"
        }
      ],
      notes: ["checked"]
    });

    expect(result.structuredContent.annotated_count).toBe(1);

    const session = await sessions.readCurrent();
    expect(session.entries[0]?.selected_items[0]?.label).toBe("strong_candidate");
  });

  it("stores entry trace and rejects caller-supplied timestamps", async () => {
    const baseDir = await createTempDir();
    const sessions = createSessionStore(baseDir);
    const tool = createJpLitAnnotateSessionTool(sessions);

    await sessions.appendEntry({
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

    await expect(
      tool({
        tool: "jp_lit_search",
        cache_key: "sha256-a",
        selected_items: [],
        trace: {
          decisions: [
            {
              kind: "hold",
              target: { title: "foo" },
              reason: "caller should not provide created_at",
              evidence_refs: [],
              created_at: "2000-01-01T00:00:00.000Z"
            }
          ],
          evidence_scope: []
        }
      })
    ).rejects.toThrow();

    const result = await tool({
      tool: "jp_lit_search",
      cache_key: "sha256-a",
      selected_items: [],
      trace: {
        agent_label: "Japan Search 担当",
        task_scope: "昭和館巻号候補の切り分け",
        intent: "topic_literature_review",
        search_attempt: {
          source: "ndl_catalog",
          query: "foo",
          purpose: "初動確認",
          total: 1,
          returned_count: 1,
          extracted_count: 0,
          outcome: "partial"
        },
        decisions: [
          {
            kind: "hold",
            target: { title: "foo" },
            reason: "本文未確認のため保留",
            evidence_refs: []
          }
        ],
        evidence_scope: []
      }
    });

    const session = await sessions.readCurrent();

    expect(result.structuredContent.annotated_count).toBe(0);
    expect(session.entries[0]?.trace?.agent_label).toBe("Japan Search 担当");
    expect(session.entries[0]?.trace?.task_scope).toBe("昭和館巻号候補の切り分け");
    expect(session.entries[0]?.trace?.intent).toBe("topic_literature_review");
    expect(session.entries[0]?.trace?.decisions[0]?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
