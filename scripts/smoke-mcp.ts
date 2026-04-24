import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/server.js";

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
  } finally {
    await client.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
