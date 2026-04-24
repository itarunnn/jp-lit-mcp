import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { searchInputSchema, recordInputSchema } from "./lib/schemas.js";
import { createRecordService } from "./services/recordService.js";
import { createSearchService } from "./services/searchService.js";
import { createNdlDigitalAdapter } from "./sources/ndlDigital/adapter.js";
import { createNdlSearchAdapter } from "./sources/ndlSearch/adapter.js";
import { createJpLitGetRecordTool } from "./tools/jpLitGetRecord.js";
import { createJpLitSearchTool } from "./tools/jpLitSearch.js";

interface ServerEnv {
  NDL_SEARCH_BASE_URL?: string;
  NDL_DIGITAL_BASE_URL?: string;
}

function resolveAdapterUrls(baseUrl: string | undefined) {
  if (!baseUrl) {
    return {};
  }

  const url = new URL(baseUrl);
  const origin = `${url.origin}/`;
  const searchBaseUrl =
    /\/api\/opensearch\/?$/.test(url.pathname) ||
    /\/api\/bib\/external\/search\/?$/.test(url.pathname)
      ? new URL("/api/opensearch", origin).toString()
      : url.toString();
  const recordBaseUrl = new URL("/api/bib/external/search", origin).toString();

  return {
    searchBaseUrl,
    recordBaseUrl
  };
}

export function resolveAdapterOptionsFromEnv(env: ServerEnv = process.env) {
  return {
    ndlSearch: resolveAdapterUrls(env.NDL_SEARCH_BASE_URL),
    ndlDigital: resolveAdapterUrls(env.NDL_DIGITAL_BASE_URL)
  };
}

export function createServer(env: ServerEnv = process.env) {
  const adapterOptions = resolveAdapterOptionsFromEnv(env);
  const adapters = [
    createNdlSearchAdapter(adapterOptions.ndlSearch),
    createNdlDigitalAdapter(adapterOptions.ndlDigital)
  ];
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
