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
});
