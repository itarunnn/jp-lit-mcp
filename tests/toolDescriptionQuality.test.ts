import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/server.js";
import { CACHED_TOOL_NAMES } from "../src/lib/persistence/cacheIdentity.js";

const cachedExternalToolNames = [
  ...CACHED_TOOL_NAMES.filter(
    (toolName) => toolName !== "jp_lit_record_ndl_browser_search"
  ),
  "jp_lit_get_records"
] as const;

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
  "jp_lit_get_records",
  "jp_lit_search_cache_index",
  "jp_lit_list_cache",
  "jp_lit_delete_cache",
  "jp_lit_prune_cache",
  "jp_lit_refine_results",
  "jp_lit_export_view",
  "jp_lit_export_session",
  "jp_lit_annotate_session",
  "jp_lit_start_session",
  "jp_lit_update_session_trace",
  "jp_lit_find_sessions",
  "jp_lit_list_sessions"
];

describe("tool definition quality", () => {
  it("jp_lit_search は発掘調査報告書を irdb、ndl_search、ndl_catalog の順に案内する", async () => {
    const tools = await listPublishedTools();
    const description =
      tools.find((tool) => tool.name === "jp_lit_search")?.description ?? "";

    expect(description).toContain(
      "「発掘調査報告書/遺跡/埋蔵文化財/出土遺物」→まずirdb、NDL Search横断確認はndl_search、NDL所蔵確認はndl_catalog"
    );
  });

  it("jp_lit_search は参考図書の言い回しを専用 source と所蔵確認へ案内する", async () => {
    const tools = await listPublishedTools();
    const description =
      tools.find((tool) => tool.name === "jp_lit_search")?.description ?? "";

    expect(description).toMatch(/参考図書|レファ本|事典|辞典|書誌|索引|年鑑/);
    expect(description).toContain("ndl_reference_books");
    expect(description).toMatch(/jp_lit_get_record(?:s)?/);
    expect(description).toMatch(/cinii_books|カーリル|OPAC/);
  });

  it("全30 toolが副作用と外部到達性をannotationsで公開する", async () => {
    const tools = await listPublishedTools();
    const cachedExternalWrites = new Set(cachedExternalToolNames);
    const localReadOnly = new Set([
      "jp_lit_refine_results",
      "jp_lit_find_sessions",
      "jp_lit_list_sessions",
      "jp_lit_search_cache_index",
      "jp_lit_list_cache"
    ]);
    const localWrites = new Set([
      "jp_lit_annotate_session",
      "jp_lit_update_session_trace",
      "jp_lit_start_session",
      "jp_lit_export_session",
      "jp_lit_export_view",
      "jp_lit_record_ndl_browser_search"
    ]);
    const destructiveIdempotent = new Set(["jp_lit_delete_cache"]);
    const destructiveNonIdempotent = new Set(["jp_lit_prune_cache"]);

    expect(tools).toHaveLength(30);
    for (const tool of tools) {
      const annotations = tool.annotations;
      expect(annotations, tool.name).toBeDefined();
      expect(typeof annotations?.readOnlyHint, tool.name).toBe("boolean");
      expect(typeof annotations?.destructiveHint, tool.name).toBe("boolean");
      expect(typeof annotations?.idempotentHint, tool.name).toBe("boolean");
      expect(typeof annotations?.openWorldHint, tool.name).toBe("boolean");

      if (cachedExternalWrites.has(tool.name as (typeof cachedExternalToolNames)[number])) {
        expect(annotations, tool.name).toMatchObject({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true
        });
      } else if (localReadOnly.has(tool.name)) {
        expect(annotations, tool.name).toMatchObject({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        });
      } else if (localWrites.has(tool.name)) {
        expect(annotations, tool.name).toMatchObject({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false
        });
      } else if (destructiveIdempotent.has(tool.name)) {
        expect(annotations, tool.name).toMatchObject({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false
        });
      } else if (destructiveNonIdempotent.has(tool.name)) {
        expect(annotations, tool.name).toMatchObject({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false
        });
      } else {
        throw new Error(`Unclassified tool annotations: ${tool.name}`);
      }
    }
  });

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
      ["jp_lit_start_session", /開始|start|lifecycle|session/i],
      ["jp_lit_update_session_trace", /追記|更新|write|session/i],
      ["jp_lit_record_ndl_browser_search", /local write/i]
    ] as const;

    for (const [toolName, pattern] of expectations) {
      const tool = tools.find((candidate) => candidate.name === toolName);
      expect(tool?.description, toolName).toMatch(pattern);
    }
  });

  it("browser観測記録toolはローカル保存境界と後続toolを一文で説明する", async () => {
    const tools = await listPublishedTools();
    const description = tools.find(
      (tool) => tool.name === "jp_lit_record_ndl_browser_search"
    )?.description ?? "";

    expect(description).toMatch(/local write/i);
    expect(description).toMatch(/デジコレ公式画面.*全文検索候補/);
    expect(description).toMatch(/閲覧.*資料内検索.*印刷用PDF/);
    expect(description).toMatch(/cache\/session.*保存/);
    expect(description).toMatch(/MCP自身.*ブラウザ操作.*ログイン.*外部通信.*行わず/);
    expect(description).toMatch(/cookie.*認証情報.*画像.*PDF本体.*path.*受け取らない/i);
    for (const downstreamTool of [
      "jp_lit_refine_results",
      "jp_lit_search_cache_index",
      "jp_lit_annotate_session",
      "jp_lit_export_view",
      "jp_lit_export_session"
    ]) {
      expect(description).toContain(downstreamTool);
    }
  });

  it("refineとcache indexは三candidate toolのresult refを説明する", async () => {
    const tools = await listPublishedTools();

    for (const toolName of ["jp_lit_refine_results", "jp_lit_search_cache_index"]) {
      const description =
        tools.find((tool) => tool.name === toolName)?.description ?? "";
      expect(description, toolName).toContain("jp_lit_search");
      expect(description, toolName).toContain("jp_lit_search_fulltext");
      expect(description, toolName).toContain("jp_lit_record_ndl_browser_search");
      expect(description, toolName).toMatch(/result_ref/);
    }
  });

  it("read-only tool は副作用がないことを description に明示する", async () => {
    const tools = await listPublishedTools();
    const readOnlyTools = [
      "jp_lit_search_cache_index",
      "jp_lit_list_cache",
      "jp_lit_find_sessions",
      "jp_lit_list_sessions",
      "jp_lit_refine_results"
    ];

    for (const toolName of readOnlyTools) {
      const tool = tools.find((candidate) => candidate.name === toolName);
      expect(tool?.description, toolName).toMatch(/read-only|読み取るだけ/);
    }
  });

  it("cached external tool は外部source readとlocal bookkeeping writeを明示する", async () => {
    const tools = await listPublishedTools();

    for (const toolName of cachedExternalToolNames) {
      const tool = tools.find((candidate) => candidate.name === toolName);
      expect(tool?.description, toolName).toMatch(/external read/i);
      expect(tool?.description, toolName).toMatch(/local (?:cache|bookkeeping) write/i);
      expect(tool?.description, toolName).toMatch(/外部sourceは変更しない/);
      expect(tool?.description, toolName).toMatch(/非破壊/);
      expect(tool?.description, toolName).not.toMatch(/read-only/i);
    }
  });

  it("関連 tool は代替 tool との差分を description に含める", async () => {
    const tools = await listPublishedTools();
    const expectations = [
      ["jp_lit_get_record", /jp_lit_get_records/],
      ["jp_lit_get_records", /jp_lit_get_record|1件/],
      ["jp_lit_search_cache_index", /jp_lit_search|jp_lit_list_cache|jp_lit_refine_results/],
      ["jp_lit_list_cache", /jp_lit_search_cache_index|jp_lit_delete_cache|jp_lit_prune_cache/],
      ["jp_lit_export_session", /jp_lit_export_view/],
      ["jp_lit_export_view", /jp_lit_export_session/],
      ["jp_lit_annotate_session", /jp_lit_update_session_trace/],
      ["jp_lit_update_session_trace", /jp_lit_annotate_session/],
      ["jp_lit_search_fulltext", /jp_lit_search_pages/],
      ["jp_lit_search_pages", /jp_lit_search_fulltext|jp_lit_get_text_coordinates/],
      ["jp_lit_get_text_coordinates", /jp_lit_search_pages|jp_lit_get_fulltext/],
      ["jp_lit_resolve_authority", /jp_lit_search|jp_lit_find_authority_terms_by_classification/],
      ["jp_lit_find_authority_terms_by_classification", /jp_lit_resolve_authority|jp_lit_search/],
      ["jp_lit_suggest_classification_codes", /jp_lit_search|jp_lit_find_authority_terms_by_classification/]
    ] as const;

    for (const [toolName, pattern] of expectations) {
      const tool = tools.find((candidate) => candidate.name === toolName);
      expect(tool?.description, toolName).toMatch(pattern);
    }
  });

  it("NDL record detail の description は PID と source ID の選択境界を伝える", async () => {
    const tools = await listPublishedTools();
    const recordDescription =
      tools.find((tool) => tool.name === "jp_lit_get_record")?.description ?? "";
    const recordsDescription =
      tools.find((tool) => tool.name === "jp_lit_get_records")?.description ?? "";

    expect(recordDescription).toMatch(/source_id.*pid|pid.*source_id/i);
    expect(recordsDescription).toMatch(/source_ids.*pids|pids.*source_ids/i);
    expect(recordsDescription).toMatch(/1.?10/);
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
