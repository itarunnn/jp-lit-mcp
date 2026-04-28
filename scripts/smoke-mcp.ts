import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/server.js";

async function runOcrSmoke(client: Client, sourceId: string, pid: string) {
  const coordResult = await client.callTool({
    name: "jp_lit_get_text_coordinates",
    arguments: { source: "ndl_digital", source_id: sourceId, page: 1 }
  });

  const coordData = coordResult.structuredContent as
    | { pid?: string; page?: number; contents?: unknown; coordjson?: unknown }
    | undefined;

  if (!coordData?.pid || coordData.page !== 1) {
    throw new Error(
      `Live smoke jp_lit_get_text_coordinates returned unexpected data: ${JSON.stringify(coordData)}`
    );
  }

  console.log(
    `jp_lit_get_text_coordinates passed: pid=${pid} page=1`
  );

  const fulltextResult = await client.callTool({
    name: "jp_lit_get_fulltext",
    arguments: { source: "ndl_digital", source_id: sourceId }
  });

  const fulltextData = fulltextResult.structuredContent as
    | { pid?: string; pages?: unknown[] }
    | undefined;

  if (!fulltextData?.pid) {
    throw new Error(
      `Live smoke jp_lit_get_fulltext returned unexpected data: ${JSON.stringify(fulltextData)}`
    );
  }

  console.log(
    `jp_lit_get_fulltext passed: pid=${pid} pages=${Array.isArray(fulltextData.pages) ? fulltextData.pages.length : "?"}`
  );
}

async function runLiveSmoke(client: Client) {
  const liveQuery = process.env.SMOKE_LIVE_QUERY ?? "菊池寛";
  const liveSource = process.env.SMOKE_LIVE_SOURCE ?? "ndl_catalog";
  const liveSortBy = process.env.SMOKE_LIVE_SORT_BY;
  const liveSortOrder = process.env.SMOKE_LIVE_SORT_ORDER;

  const searchResult = await client.callTool({
    name: "jp_lit_search",
    arguments: {
      query: liveQuery,
      source: liveSource,
      limit: 3,
      page: 1,
      ...(liveSortBy
        ? {
            sort_by: liveSortBy,
            sort_order: liveSortOrder ?? "asc"
          }
        : {})
    }
  });

  const searchData = searchResult.structuredContent as
    | {
        total?: number;
        facets?: {
          providers?: Record<string, number>;
          ndc?: Record<string, number>;
          issued_years?: Record<string, number>;
        };
        items?: Array<{
          source?: string;
          source_id?: string;
          title?: string;
        }>;
      }
    | undefined;

  if (!searchData || !Array.isArray(searchData.items) || searchData.items.length === 0) {
    throw new Error("Live smoke search returned no items.");
  }

  if (liveSource.startsWith("ndl_")) {
    const providers = searchData.facets?.providers;

    if (!providers || Object.keys(providers).length === 0) {
      throw new Error("Live smoke NDL search returned no facets.providers.");
    }
  }

  const firstItem = searchData.items[0];
  if (!firstItem?.source || !firstItem.source_id) {
    throw new Error("Live smoke search returned an item without source/source_id.");
  }

  const recordResult = await client.callTool({
    name: "jp_lit_get_record",
    arguments: {
      source: firstItem.source,
      source_id: firstItem.source_id
    }
  });

  const recordData = recordResult.structuredContent as
    | {
        source?: string;
        source_id?: string;
        title?: string;
        source_metadata?: {
          holding_count?: number | null;
          holdings?: Array<{
            library_name?: string;
            library_url?: string;
          }>;
        };
      }
    | undefined;

  if (!recordData?.source_id || !recordData?.source) {
    throw new Error("Live smoke record returned no structured record.");
  }

  if (recordData.source === "cinii_books") {
    const holdingCount = recordData.source_metadata?.holding_count;
    const holdings = recordData.source_metadata?.holdings;

    if (
      typeof holdingCount !== "number" ||
      !Array.isArray(holdings) ||
      holdings.length === 0
    ) {
      throw new Error("Live smoke cinii_books record returned no holdings.");
    }
  }

  if (recordData.source === "jstage_articles" && !recordData.title) {
    throw new Error("Live smoke jstage_articles record returned no title.");
  }

  if (recordData.source === "nihu_bridge") {
    const sourceMeta = recordData.source_metadata as
      | { research_resource_id?: string; database_id?: string }
      | undefined;
    if (!sourceMeta?.research_resource_id) {
      throw new Error(
        "Live smoke nihu_bridge record returned no research_resource_id."
      );
    }
  }

  console.log(
    `Live smoke check passed: ${liveSource} / ${liveQuery} -> ${recordData.source_id}`
  );
  if (liveSortBy) {
    console.log(`sort: ${liveSortBy} ${liveSortOrder ?? "asc"}`);
  }
  console.log(recordData.title ?? "");

  if (liveSource === "ndl_digital") {
    const nextDl = (
      recordData as {
        source_metadata?: {
          next_digital_library?: { pid?: string; available?: boolean } | null;
        };
      }
    ).source_metadata?.next_digital_library;

    if (nextDl?.available && nextDl.pid) {
      console.log(`next_digital_library available: pid=${nextDl.pid}`);
      await runOcrSmoke(client, firstItem.source_id, nextDl.pid);
    } else {
      console.log(
        `next_digital_library not available for this record — OCR smoke skipped`
      );
    }
  }
}

async function main() {
  const server = createServer();
  const client = new Client({
    name: "ndl-jp-lit-smoke-client",
    version: "0.1.0"
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    const toolNames = tools.map((tool) => tool.name).sort();

    const expectedTools = [
      "jp_lit_get_fulltext",
      "jp_lit_get_record",
      "jp_lit_get_text_coordinates",
      "jp_lit_search",
      "jp_lit_search_fulltext",
      "jp_lit_search_illustrations",
      "jp_lit_search_pages"
    ];
    if (
      toolNames.length !== expectedTools.length ||
      toolNames.some((name, i) => name !== expectedTools[i])
    ) {
      throw new Error(`Unexpected tools: ${toolNames.join(", ")}`);
    }

    console.log("MCP smoke check passed.");
    console.log(toolNames.join(", "));

    if (process.env.SMOKE_LIVE === "1") {
      await runLiveSmoke(client);
    }
  } finally {
    await client.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
