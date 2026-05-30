import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/server.js";

async function listPublishedTools() {
  const server = createServer();
  const client = new Client({
    name: "jp-lit-tool-description-quality-test-client",
    version: "0.1.0"
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    return tools;
  } finally {
    await client.close();
    await server.close();
  }
}

const priorityTools = [
  "jp_lit_search_cache_index",
  "jp_lit_list_cache",
  "jp_lit_delete_cache",
  "jp_lit_prune_cache",
  "jp_lit_refine_results",
  "jp_lit_export_view",
  "jp_lit_export_session",
  "jp_lit_annotate_session",
  "jp_lit_update_session_trace",
  "jp_lit_find_sessions",
  "jp_lit_list_sessions"
];

describe("tool definition quality", () => {
  it("優先 tool は十分な tool description を公開する", async () => {
    const tools = await listPublishedTools();

    for (const toolName of priorityTools) {
      const tool = tools.find((candidate) => candidate.name === toolName);
      expect(tool, toolName).toBeDefined();
      expect(tool?.description?.length, toolName).toBeGreaterThanOrEqual(120);
    }
  });

  it("優先 tool の top-level input property には description がある", async () => {
    const tools = await listPublishedTools();

    for (const toolName of priorityTools) {
      const tool = tools.find((candidate) => candidate.name === toolName);
      const properties = tool?.inputSchema.properties ?? {};
      for (const [propertyName, propertySchema] of Object.entries(properties)) {
        expect(
          (propertySchema as { description?: string }).description,
          `${toolName}.${propertyName}`
        ).toBeTruthy();
      }
    }
  });

  it("状態変更 tool は副作用を description に明示する", async () => {
    const tools = await listPublishedTools();
    const expectations = [
      ["jp_lit_delete_cache", /削除|delete|destructive|破壊/i],
      ["jp_lit_prune_cache", /dry_run|削除|delete/i],
      ["jp_lit_export_session", /exports\/|書き出|write|export/i],
      ["jp_lit_export_view", /exports\/|書き出|write|export/i],
      ["jp_lit_annotate_session", /保存|追記|write|session/i],
      ["jp_lit_update_session_trace", /追記|更新|write|session/i]
    ] as const;

    for (const [toolName, pattern] of expectations) {
      const tool = tools.find((candidate) => candidate.name === toolName);
      expect(tool?.description, toolName).toMatch(pattern);
    }
  });

  it("公開 tool の top-level input property description coverage は 90% 以上", async () => {
    const tools = await listPublishedTools();
    let total = 0;
    let described = 0;

    for (const tool of tools) {
      const properties = tool.inputSchema.properties ?? {};
      for (const propertySchema of Object.values(properties)) {
        total += 1;
        if (typeof (propertySchema as { description?: unknown }).description === "string") {
          described += 1;
        }
      }
    }

    expect(described / total).toBeGreaterThanOrEqual(0.9);
  });
});
