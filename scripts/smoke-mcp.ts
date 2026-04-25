import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/server.js";

async function runLiveSmoke(client: Client) {
  const liveQuery = process.env.SMOKE_LIVE_QUERY ?? "菊池寛";
  const liveSource = process.env.SMOKE_LIVE_SOURCE ?? "ndl_search";

  const searchResult = await client.callTool({
    name: "jp_lit_search",
    arguments: {
      query: liveQuery,
      source: liveSource,
      limit: 3,
      page: 1
    }
  });

  const searchData = searchResult.structuredContent as
    | {
        total?: number;
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
      }
    | undefined;

  if (!recordData?.source_id || !recordData?.source) {
    throw new Error("Live smoke record returned no structured record.");
  }

  console.log(
    `Live smoke check passed: ${liveSource} / ${liveQuery} -> ${recordData.source_id}`
  );
  console.log(recordData.title ?? "");
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

    if (
      toolNames.length !== 2 ||
      toolNames[0] !== "jp_lit_get_record" ||
      toolNames[1] !== "jp_lit_search"
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
