import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { readFileSync } from "node:fs";

import {
  DEFAULT_LIVE_RETRY_COUNT,
  EXPECTED_TOOL_NAMES,
  LIVE_MATRIX_SOURCES,
  getLiveErrorMessage,
  isSkippableLiveError,
  pickPreferredLiveRecord,
  resolveIllustrationFallbackKeyword,
  resolveLiveSmokeExtraTools,
  resolveLiveReportPath,
  resolveLiveRetryCount,
  resolveOcrFallbackKeyword,
  resolveSmokeRunMode,
  resolveLiveSmokeSources,
  resolveLiveSmokeQuery,
  SUPPORTED_LIVE_EXTRA_TOOLS
} from "../scripts/smoke-mcp.js";
import { createServer } from "../src/server.js";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};

describe("smoke-mcp tool manifest", () => {
  it("publishes the package version in MCP serverInfo", async () => {
    const server = createServer();
    const client = new Client({
      name: "jp-lit-version-test-client",
      version: "1.0.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      expect(client.getServerVersion()).toEqual({
        name: "jp-lit-mcp",
        version: packageJson.version
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("tracks all runtime tools exposed by the server", () => {
    expect(EXPECTED_TOOL_NAMES).toEqual([
      "jp_lit_annotate_session",
      "jp_lit_delete_cache",
      "jp_lit_enrich_record",
      "jp_lit_export_session",
      "jp_lit_export_view",
      "jp_lit_find_authority_terms_by_classification",
      "jp_lit_find_sessions",
      "jp_lit_get_fulltext",
      "jp_lit_get_record",
      "jp_lit_get_text_coordinates",
      "jp_lit_list_cache",
      "jp_lit_list_sessions",
      "jp_lit_prune_cache",
      "jp_lit_refine_results",
      "jp_lit_resolve_authority",
      "jp_lit_search",
      "jp_lit_search_cache_index",
      "jp_lit_search_fulltext",
      "jp_lit_search_guides_cases",
      "jp_lit_search_guides_manuals",
      "jp_lit_search_illustrations",
      "jp_lit_search_kaken_projects",
      "jp_lit_search_kokusho_fulltext",
      "jp_lit_search_kokusho_image_tags",
      "jp_lit_search_pages",
      "jp_lit_update_session_trace"
    ]);
  });

  it("publishes enrichment tool as a cached record verifier, not a search source", async () => {
    const server = createServer();
    const client = new Client({
      name: "jp-lit-enrich-record-schema-test-client",
      version: "0.1.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const { tools } = await client.listTools();
      const enrichTool = tools.find((tool) => tool.name === "jp_lit_enrich_record");
      const properties = enrichTool?.inputSchema.properties ?? {};

      expect(enrichTool?.description).toMatch(/read-only|Crossref|OpenAlex|文献検索 source ではなく/);
      expect(properties).toMatchObject({
        doi: { type: "string" },
        title: { type: "string" },
        authors: { type: "array" },
        issued_year: { type: "string" },
        providers: { type: "array" },
        force_refresh: { type: "boolean" }
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("publishes kokusho extended search tools", async () => {
    const server = createServer();
    const client = new Client({
      name: "jp-lit-kokusho-tools-test-client",
      version: "0.1.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const { tools } = await client.listTools();
      const fulltextTool = tools.find((tool) => tool.name === "jp_lit_search_kokusho_fulltext");
      const imageTagsTool = tools.find((tool) => tool.name === "jp_lit_search_kokusho_image_tags");

      expect(fulltextTool?.inputSchema.properties).toMatchObject({
        keyword: { type: "string" },
        limit: { type: "integer" },
        page: { type: "integer" },
        force_refresh: { type: "boolean" }
      });
      expect(imageTagsTool?.inputSchema.properties).toMatchObject({
        keyword: { type: "string" },
        limit: { type: "integer" },
        page: { type: "integer" },
        force_refresh: { type: "boolean" }
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("publishes force_refresh on cached lookup tools", async () => {
    const server = createServer();
    const client = new Client({
      name: "jp-lit-cache-schema-test-client",
      version: "0.1.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const cachedToolNames = [
      "jp_lit_get_record",
      "jp_lit_get_fulltext",
      "jp_lit_get_text_coordinates",
      "jp_lit_search_pages",
      "jp_lit_search_fulltext",
      "jp_lit_search_illustrations",
      "jp_lit_search_guides_manuals",
      "jp_lit_search_guides_cases",
      "jp_lit_enrich_record",
      "jp_lit_resolve_authority",
      "jp_lit_find_authority_terms_by_classification",
      "jp_lit_search_kaken_projects"
    ];

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const { tools } = await client.listTools();
      for (const toolName of cachedToolNames) {
        const tool = tools.find((candidate) => candidate.name === toolName);
        expect(tool?.inputSchema.properties, toolName).toMatchObject({
          force_refresh: { type: "boolean" }
        });
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("publishes inline evidence_refs schemas for annotate trace", async () => {
    const server = createServer();
    const client = new Client({
      name: "jp-lit-schema-test-client",
      version: "0.1.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const { tools } = await client.listTools();
      const annotateTool = tools.find((tool) => tool.name === "jp_lit_annotate_session");
      const traceProperties = annotateTool?.inputSchema.properties?.trace as
        | {
            properties?: {
              decisions?: {
                items?: {
                  properties?: {
                    evidence_refs?: { items?: unknown };
                  };
                };
              };
              evidence_scope?: {
                items?: {
                  properties?: {
                    evidence_refs?: { items?: unknown };
                  };
                };
              };
            };
          }
        | undefined;

      const decisionEvidenceRefItems =
        traceProperties?.properties?.decisions?.items?.properties?.evidence_refs?.items;
      const scopeEvidenceRefItems =
        traceProperties?.properties?.evidence_scope?.items?.properties?.evidence_refs?.items;

      expect(decisionEvidenceRefItems).toMatchObject({
        type: "object",
        properties: {
          tool: { type: "string" },
          cache_key: { type: "string" },
          source_id: { type: "string" },
          quote_or_summary: { type: "string" }
        },
        additionalProperties: false
      });
      expect(scopeEvidenceRefItems).toMatchObject({
        type: "object",
        properties: {
          tool: { type: "string" },
          cache_key: { type: "string" },
          source_id: { type: "string" },
          quote_or_summary: { type: "string" }
        },
        additionalProperties: false
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("publishes agent scope and session-level evidence refs in trace schemas", async () => {
    const server = createServer();
    const client = new Client({
      name: "jp-lit-session-trace-schema-test-client",
      version: "0.1.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const { tools } = await client.listTools();
      const annotateTool = tools.find((tool) => tool.name === "jp_lit_annotate_session");
      const annotateTraceProperties = annotateTool?.inputSchema.properties?.trace as
        | {
            properties?: {
              agent_label?: unknown;
              task_scope?: unknown;
            };
          }
        | undefined;

      expect(annotateTraceProperties?.properties).toMatchObject({
        agent_label: { type: "string" },
        task_scope: { type: "string" }
      });

      const updateTool = tools.find((tool) => tool.name === "jp_lit_update_session_trace");
      const updateProperties = updateTool?.inputSchema.properties as
        | {
            open_questions?: {
              items?: {
                properties?: {
                  evidence_refs?: { items?: unknown };
                };
              };
            };
            next_actions?: {
              items?: {
                properties?: {
                  evidence_refs?: { items?: unknown };
                };
              };
            };
          }
        | undefined;

      const openQuestionEvidenceRefs =
        updateProperties?.open_questions?.items?.properties?.evidence_refs?.items;
      const nextActionEvidenceRefs =
        updateProperties?.next_actions?.items?.properties?.evidence_refs?.items;

      for (const evidenceRefItems of [
        openQuestionEvidenceRefs,
        nextActionEvidenceRefs
      ]) {
        expect(evidenceRefItems).toMatchObject({
          type: "object",
          properties: {
            tool: { type: "string" },
            cache_key: { type: "string" },
            source_id: { type: "string" },
            quote_or_summary: { type: "string" }
          },
          additionalProperties: false
        });
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("publishes specialist explicit sources in jp_lit_search and jp_lit_get_record schemas", async () => {
    const server = createServer();
    const client = new Client({
      name: "jp-lit-source-schema-test-client",
      version: "0.1.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const { tools } = await client.listTools();
      const searchTool = tools.find((tool) => tool.name === "jp_lit_search");
      const recordTool = tools.find((tool) => tool.name === "jp_lit_get_record");
      const searchSourceEnum = (searchTool?.inputSchema.properties?.source as { enum?: string[] } | undefined)
        ?.enum;
      const recordSourceEnum = (recordTool?.inputSchema.properties?.source as { enum?: string[] } | undefined)
        ?.enum;

      expect(searchSourceEnum).toEqual(
        expect.arrayContaining(["nijl_articles", "kokusho", "ninjal_bibliography"])
      );
      expect(recordSourceEnum).toEqual(
        expect.arrayContaining(["nijl_articles", "kokusho", "ninjal_bibliography"])
      );
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("uses source-specific default queries for sparse providers", () => {
    expect(resolveLiveSmokeQuery("jstage_articles", undefined)).toBe("癌");
    expect(resolveLiveSmokeQuery("ndl_catalog", undefined)).toBe("菊池寛");
    expect(resolveLiveSmokeQuery("kokkai_minutes", undefined)).toBe("賭博");
    expect(resolveLiveSmokeQuery("teikoku_minutes", undefined)).toBe("賭博");
    expect(resolveLiveSmokeQuery("national_archives", undefined)).toBe("太政官");
    expect(resolveLiveSmokeQuery("jacar", undefined)).toBe("台湾総督府");
    expect(resolveLiveSmokeQuery("nijl_articles", undefined)).toBe("源氏物語");
    expect(resolveLiveSmokeQuery("kokusho", undefined)).toBe("伊勢物語");
    expect(resolveLiveSmokeQuery("ninjal_bibliography", undefined)).toBe("日本語教育");
    expect(resolveLiveSmokeQuery("jstage_articles", "材料")).toBe("材料");
  });

  it("prefers ndl_digital records with next_digital_library.available=true", () => {
    const selected = pickPreferredLiveRecord("ndl_digital", [
      {
        source_id: "first",
        source_metadata: {
          next_digital_library: { available: false }
        }
      },
      {
        source_id: "second",
        source_metadata: {
          next_digital_library: { available: true }
        }
      }
    ]);

    expect(selected?.source_id).toBe("second");
  });

  it("uses a stable OCR fallback keyword for ndl_digital", () => {
    expect(resolveOcrFallbackKeyword("ndl_digital", undefined)).toBe("大政奉還");
    expect(resolveOcrFallbackKeyword("ndl_digital", "文明開化")).toBe("文明開化");
  });

  it("uses a stable illustration fallback keyword for ndl_digital", () => {
    expect(resolveIllustrationFallbackKeyword("ndl_digital", undefined)).toBe("富士山");
    expect(resolveIllustrationFallbackKeyword("ndl_digital", "鳥居")).toBe("鳥居");
  });

  it("treats jdcat 503 as skippable live smoke failure", () => {
    expect(
      getLiveErrorMessage({
        isError: true,
        content: [{ type: "text", text: "Upstream request failed: 503 Service Temporarily Unavailable" }]
      })
    ).toBe("Upstream request failed: 503 Service Temporarily Unavailable");
    expect(
      isSkippableLiveError("jdcat", {
        isError: true,
        content: [{ type: "text", text: "Upstream request failed: 503 Service Temporarily Unavailable" }]
      })
    ).toBe(true);
    expect(
      isSkippableLiveError("kokkai_minutes", {
        isError: true,
        content: [{ type: "text", text: "Upstream request failed: 503 Service Temporarily Unavailable" }]
      })
    ).toBe(false);
  });

  it("treats explicit HTML and specialist source upstream blocks as skippable live smoke failures", () => {
    for (const source of [
      "national_archives",
      "jacar",
      "nijl_articles",
      "kokusho",
      "ninjal_bibliography"
    ]) {
      expect(
        isSkippableLiveError(source, {
          isError: true,
          content: [{ type: "text", text: "Upstream request failed: 429 Too Many Requests" }]
        })
      ).toBe(true);
      expect(
        isSkippableLiveError(source, {
          isError: true,
          content: [{ type: "text", text: "Upstream maintenance window" }]
        })
      ).toBe(true);
    }
  });

  it("exposes stable default live smoke matrix sources", () => {
    expect(LIVE_MATRIX_SOURCES).toEqual([
      "ndl_catalog",
      "ndl_digital",
      "cinii_books",
      "nihu_bridge",
      "jstage_articles",
      "kokkai_minutes",
      "teikoku_minutes",
      "irdb",
      "jdcat"
    ]);
    expect(LIVE_MATRIX_SOURCES).not.toContain("nijl_articles");
    expect(LIVE_MATRIX_SOURCES).not.toContain("kokusho");
    expect(LIVE_MATRIX_SOURCES).not.toContain("ninjal_bibliography");
  });

  it("resolves live smoke sources from override or default matrix", () => {
    expect(resolveLiveSmokeSources(undefined)).toEqual(LIVE_MATRIX_SOURCES);
    expect(resolveLiveSmokeSources("ndl_catalog,jdcat")).toEqual([
      "ndl_catalog",
      "jdcat"
    ]);
    expect(
      resolveLiveSmokeSources("nijl_articles,kokusho,ninjal_bibliography")
    ).toEqual(["nijl_articles", "kokusho", "ninjal_bibliography"]);
  });

  it("resolves extra live smoke tools from override", () => {
    expect(SUPPORTED_LIVE_EXTRA_TOOLS).toContain("jp_lit_search_kaken_projects");
    expect(resolveLiveSmokeExtraTools(undefined)).toEqual([]);
    expect(
      resolveLiveSmokeExtraTools(
        "jp_lit_search_kaken_projects,jp_lit_search_kokusho_fulltext,jp_lit_search_kokusho_image_tags"
      )
    ).toEqual([
      "jp_lit_search_kaken_projects",
      "jp_lit_search_kokusho_fulltext",
      "jp_lit_search_kokusho_image_tags"
    ]);
  });

  it("runs matrix mode when SMOKE_LIVE_SOURCES is provided", () => {
    expect(resolveSmokeRunMode({ SMOKE_LIVE_MATRIX: "1" })).toBe("matrix");
    expect(
      resolveSmokeRunMode({
        SMOKE_LIVE: "1",
        SMOKE_LIVE_SOURCES: "nijl_articles,kokusho,ninjal_bibliography"
      })
    ).toBe("matrix");
    expect(resolveSmokeRunMode({ SMOKE_LIVE: "1" })).toBe("single");
    expect(resolveSmokeRunMode({})).toBe("single");
  });

  it("uses stable defaults for live retry count", () => {
    expect(DEFAULT_LIVE_RETRY_COUNT).toBe(2);
    expect(resolveLiveRetryCount(undefined)).toBe(2);
    expect(resolveLiveRetryCount("3")).toBe(3);
  });

  it("writes matrix report to exports by default", () => {
    expect(resolveLiveReportPath("J:/apps/jp-lit-mcp", undefined)).toBe(
      "J:\\apps\\jp-lit-mcp\\exports\\live-smoke-report.json"
    );
    expect(
      resolveLiveReportPath("J:/apps/jp-lit-mcp", "J:/tmp/custom-report.json")
    ).toBe("J:\\tmp\\custom-report.json");
  });
});
