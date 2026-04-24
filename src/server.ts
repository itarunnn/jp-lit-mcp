import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { searchInputSchema, recordInputSchema } from "./lib/schemas.js";
import { createRecordService } from "./services/recordService.js";
import { createSearchService } from "./services/searchService.js";
import { createNdlDigitalAdapter } from "./sources/ndlDigital/adapter.js";
import { createNdlSearchAdapter } from "./sources/ndlSearch/adapter.js";
import { createJpLitGetRecordTool } from "./tools/jpLitGetRecord.js";
import { createJpLitSearchTool } from "./tools/jpLitSearch.js";

export function createServer() {
  const adapters = [createNdlSearchAdapter(), createNdlDigitalAdapter()];
  const searchTool = createJpLitSearchTool(createSearchService(adapters));
  const recordTool = createJpLitGetRecordTool(createRecordService(adapters));

  const server = new McpServer(
    {
      name: "ndl-jp-lit-mcp",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.registerTool(
    "jp_lit_search",
    {
      description: "日本語文献ポータルを検索する",
      inputSchema: searchInputSchema.shape
    },
    searchTool
  );

  server.registerTool(
    "jp_lit_get_record",
    {
      description: "文献レコード詳細を取得する",
      inputSchema: recordInputSchema.shape
    },
    recordTool
  );

  return server;
}

export async function startServer() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
}
