#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { URL } from "node:url";

const DEFAULT_ENDPOINT = "https://mcp-beta.calil.jp/mcp";
const DEFAULT_CALLBACK_PORT = 8090;
const DEFAULT_LIBRARY_QUERY = "岐阜県立図書館";
const DEFAULT_BOOK_QUERY = "1Q84";
const DEFAULT_LIMIT = "5";
const DEFAULT_AUTH_TIMEOUT_MS = 180_000;

type ToolCallResult = Awaited<ReturnType<Client["callTool"]>>;

class SmokeOAuthProvider implements OAuthClientProvider {
  private clientInfo?: OAuthClientInformationMixed;
  private tokenInfo?: OAuthTokens;
  private verifier?: string;

  constructor(
    private readonly callbackUrl: string,
    private readonly metadata: OAuthClientMetadata,
    private readonly onRedirect: (url: URL) => void
  ) {}

  get redirectUrl() {
    return this.callbackUrl;
  }

  get clientMetadata() {
    return this.metadata;
  }

  clientInformation() {
    return this.clientInfo;
  }

  saveClientInformation(clientInformation: OAuthClientInformationMixed) {
    this.clientInfo = clientInformation;
  }

  tokens() {
    return this.tokenInfo;
  }

  saveTokens(tokens: OAuthTokens) {
    this.tokenInfo = tokens;
  }

  redirectToAuthorization(authorizationUrl: URL) {
    this.onRedirect(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string) {
    this.verifier = codeVerifier;
  }

  codeVerifier() {
    if (!this.verifier) {
      throw new Error("OAuth code verifier was not saved");
    }
    return this.verifier;
  }
}

function envFlag(name: string) {
  return process.env[name] === "1" || process.env[name]?.toLowerCase() === "true";
}

function openBrowser(url: string) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

function createCallbackWaiter(callbackUrl: string, timeoutMs: number) {
  const expected = new URL(callbackUrl);
  let server: Server | undefined;

  const codePromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server?.close();
      reject(
        new Error(
          `Timed out waiting for OAuth callback after ${timeoutMs}ms. Re-run the command and complete the browser authorization.`
        )
      );
    }, timeoutMs);

    server = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", expected.origin);
      if (requestUrl.pathname !== expected.pathname) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const error = requestUrl.searchParams.get("error");
      if (error) {
        clearTimeout(timeout);
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end(`Authorization failed: ${error}`);
        server?.close();
        reject(new Error(`OAuth authorization failed: ${error}`));
        return;
      }

      const code = requestUrl.searchParams.get("code");
      if (!code) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end("Missing authorization code");
        return;
      }

      clearTimeout(timeout);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<p>Calil MCP authorization finished. You can close this window.</p>");
      server?.close();
      resolve(code);
    });

    server.listen(Number(expected.port), expected.hostname, () => {
      console.log(`OAuth callback listener: ${callbackUrl}`);
    });
  });

  return {
    codePromise,
    close: () => server?.close()
  };
}

async function connectWithOAuth(client: Client, transport: StreamableHTTPClientTransport) {
  try {
    await client.connect(transport);
    return true;
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      throw error;
    }

    console.log("OAuth authorization is required. Waiting for browser callback...");
    return false;
  }
}

function stringifyResult(result: ToolCallResult) {
  if (result.structuredContent) {
    return JSON.stringify(result.structuredContent, null, 2);
  }

  return JSON.stringify(result.content ?? [], null, 2);
}

function collectSystemIds(value: unknown): string[] {
  const ids = new Set<string>();

  const visit = (item: unknown) => {
    if (!item || typeof item !== "object") {
      return;
    }

    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }

    const record = item as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (
        (key === "systemid" || key === "system_id" || key === "systemId") &&
        typeof child === "string" &&
        child.trim()
      ) {
        ids.add(child.trim());
      }
      visit(child);
    }
  };

  visit(value);
  return [...ids];
}

async function run() {
  const endpoint = process.env.CALIL_MCP_ENDPOINT ?? DEFAULT_ENDPOINT;
  const callbackPort = Number.parseInt(
    process.env.CALIL_MCP_CALLBACK_PORT ?? String(DEFAULT_CALLBACK_PORT),
    10
  );
  const callbackUrl = `http://localhost:${callbackPort}/callback`;
  const authTimeoutMs = Number.parseInt(
    process.env.CALIL_MCP_AUTH_TIMEOUT_MS ?? String(DEFAULT_AUTH_TIMEOUT_MS),
    10
  );
  const libraryQuery = process.env.CALIL_MCP_LIBRARY_QUERY ?? DEFAULT_LIBRARY_QUERY;
  const bookQuery = process.env.CALIL_MCP_BOOK_QUERY ?? DEFAULT_BOOK_QUERY;
  const limit = process.env.CALIL_MCP_LIMIT ?? DEFAULT_LIMIT;
  const skipBookSearch = envFlag("CALIL_MCP_SKIP_BOOK_SEARCH");
  const openBrowserAutomatically = envFlag("CALIL_MCP_OPEN_BROWSER");

  let authorizationUrl: URL | undefined;
  const provider = new SmokeOAuthProvider(
    callbackUrl,
    {
      client_name: "jp-lit-mcp Calil smoke",
      redirect_uris: [callbackUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none"
    },
    (nextAuthorizationUrl) => {
      authorizationUrl = nextAuthorizationUrl;
      console.log("\nOpen this URL and approve Calil MCP access:");
      console.log(nextAuthorizationUrl.toString());
      console.log("");
    }
  );

  const client = new Client(
    { name: "jp-lit-mcp-calil-smoke", version: "0.1.0" },
    { capabilities: {} }
  );
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    authProvider: provider
  });

  const connected = await connectWithOAuth(client, transport);
  if (!connected) {
    const callback = createCallbackWaiter(callbackUrl, authTimeoutMs);
    if (authorizationUrl && openBrowserAutomatically) {
      openBrowser(authorizationUrl.toString());
    }

    const authorizationCode = await callback.codePromise;
    await transport.finishAuth(authorizationCode);
    await client.connect(transport);
    callback.close();
  }

  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  console.log(`Connected to Calil MCP: ${endpoint}`);
  console.log(`Tools: ${toolNames.join(", ")}`);

  for (const requiredTool of ["search_libraries", "search_books"]) {
    if (!toolNames.includes(requiredTool)) {
      throw new Error(`Expected Calil MCP tool is missing: ${requiredTool}`);
    }
  }

  const libraryResult = await client.callTool({
    name: "search_libraries",
    arguments: {
      keyword: libraryQuery,
      limit
    }
  });
  console.log("\nsearch_libraries result:");
  console.log(stringifyResult(libraryResult));

  const systemIds = collectSystemIds(libraryResult.structuredContent ?? libraryResult.content);
  if (systemIds.length === 0) {
    throw new Error(`No systemid was found for library query: ${libraryQuery}`);
  }

  if (!skipBookSearch) {
    const bookResult = await client.callTool({
      name: "search_books",
      arguments: {
        systemids: systemIds.slice(0, 3),
        free: bookQuery,
        limit
      }
    });
    console.log("\nsearch_books result:");
    console.log(stringifyResult(bookResult));
  }

  await transport.close();
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
