import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  recordInputSchema,
  recordOutputSchema,
  searchInputSchema,
  searchOutputSchema
} from "./lib/schemas.js";
import { createRecordService } from "./services/recordService.js";
import { createSearchService } from "./services/searchService.js";
import {
  createCiniiArticlesAdapter,
  createCiniiBooksAdapter,
  createCiniiResearchAdapter
} from "./sources/ciniiResearch/adapter.js";
import { createNdlDigitalAdapter } from "./sources/ndlDigital/adapter.js";
import { createNdlSearchAdapter } from "./sources/ndlSearch/adapter.js";
import { createJpLitGetRecordTool } from "./tools/jpLitGetRecord.js";
import { createJpLitSearchTool } from "./tools/jpLitSearch.js";

interface ServerEnv {
  NDL_SEARCH_BASE_URL?: string;
  NDL_DIGITAL_BASE_URL?: string;
  CINII_RESEARCH_BASE_URL?: string;
  CINII_RESEARCH_RECORD_BASE_URL?: string;
  CINII_RESEARCH_APP_ID?: string;
}

const SEARCH_ENDPOINT_PATH = "/api/opensearch";
const RECORD_ENDPOINT_PATH = "/api/bib/external/search";

function stripTrailingSlash(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

function replaceKnownEndpointPath(pathname: string, targetPath: string) {
  const normalizedPathname = stripTrailingSlash(pathname);

  if (normalizedPathname.endsWith(SEARCH_ENDPOINT_PATH)) {
    return `${normalizedPathname.slice(0, -SEARCH_ENDPOINT_PATH.length)}${targetPath}`;
  }

  if (normalizedPathname.endsWith(RECORD_ENDPOINT_PATH)) {
    return `${normalizedPathname.slice(0, -RECORD_ENDPOINT_PATH.length)}${targetPath}`;
  }

  return null;
}

function withPathname(url: URL, pathname: string) {
  const nextUrl = new URL(url.toString());

  nextUrl.pathname = pathname;
  nextUrl.search = "";
  nextUrl.hash = "";

  return nextUrl.toString();
}

function resolveAdapterUrls(baseUrl: string | undefined) {
  if (!baseUrl) {
    return {};
  }

  const url = new URL(baseUrl);
  const searchPathname = replaceKnownEndpointPath(url.pathname, SEARCH_ENDPOINT_PATH);
  const recordPathname = replaceKnownEndpointPath(url.pathname, RECORD_ENDPOINT_PATH);
  const searchBaseUrl =
    searchPathname === null ? url.toString() : withPathname(url, searchPathname);
  const recordBaseUrl = withPathname(
    url,
    recordPathname ?? RECORD_ENDPOINT_PATH
  );

  return {
    searchBaseUrl,
    recordBaseUrl
  };
}

export function resolveAdapterOptionsFromEnv(env: ServerEnv = process.env) {
  return {
    ndlSearch: resolveAdapterUrls(env.NDL_SEARCH_BASE_URL),
    ndlDigital: resolveAdapterUrls(env.NDL_DIGITAL_BASE_URL),
    ciniiResearch: {
      ...(env.CINII_RESEARCH_BASE_URL
        ? {
            searchBaseUrl: env.CINII_RESEARCH_BASE_URL
          }
        : {}),
      ...(env.CINII_RESEARCH_RECORD_BASE_URL
        ? {
            recordBaseUrl: env.CINII_RESEARCH_RECORD_BASE_URL
          }
        : {}),
      ...(env.CINII_RESEARCH_APP_ID
        ? {
            appId: env.CINII_RESEARCH_APP_ID
          }
        : {})
    }
  };
}

export function createServer(env: ServerEnv = process.env) {
  const adapterOptions = resolveAdapterOptionsFromEnv(env);
  const adapters = [
    createNdlSearchAdapter(adapterOptions.ndlSearch),
    createNdlDigitalAdapter(adapterOptions.ndlDigital),
    createCiniiResearchAdapter(adapterOptions.ciniiResearch),
    createCiniiArticlesAdapter(adapterOptions.ciniiResearch),
    createCiniiBooksAdapter(adapterOptions.ciniiResearch)
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
      inputSchema: searchInputSchema,
      outputSchema: searchOutputSchema
    },
    searchTool
  );

  server.registerTool(
    "jp_lit_get_record",
    {
      description: "文献レコード詳細を取得する",
      inputSchema: recordInputSchema,
      outputSchema: recordOutputSchema
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
