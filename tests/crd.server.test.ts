import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createServer } from "../src/server.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ndl-jp-lit-crd-server-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const MANUALS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>『常陸国風土記』について調べるには(茨城県立歴史館（閲覧室）)</title>
      <link>https://crd.ndl.go.jp/reference/detail?page=man_view&amp;id=2000022249</link>
      <pubDate>Wed, 21 Aug 2013 12:26:46 JST</pubDate>
      <category>常陸国風土記</category>
      <description>(1) 常陸国風土記とは

《検索する際のキーワード》
風土記／常陸＋風土記</description>
      <guid>https://crd.ndl.go.jp/reference/detail?page=man_view&amp;id=2000022249</guid>
    </item>
  </channel>
</rss>`;

describe("CRD tools via createServer", () => {
  it("jp_lit_search_guides_manuals を server 経由で呼べる", async () => {
    const baseDir = await createTempDir();
    const originalCwd = process.cwd();
    process.chdir(baseDir);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(MANUALS_XML, {
        status: 200,
        headers: {
          "content-type": "text/xml; charset=utf-8"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const server = createServer();
    const client = new Client({
      name: "crd-server-test-client",
      version: "1.0.0"
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const result = await client.callTool({
        name: "jp_lit_search_guides_manuals",
        arguments: {
          query: "常陸国風土記",
          limit: 1,
          page: 1
        }
      });

      const data = result.structuredContent as
        | {
            total?: number;
            items?: Array<{
              id?: string;
              title?: string;
              provider?: string | null;
              search_keywords?: string[];
            }>;
          }
        | undefined;

      expect(data?.total).toBe(1);
      expect(data?.items?.[0]).toMatchObject({
        id: "2000022249",
        title: "『常陸国風土記』について調べるには",
        provider: "茨城県立歴史館（閲覧室）",
        search_keywords: ["風土記", "常陸＋風土記"]
      });
    } finally {
      await client.close();
      await server.close();
      process.chdir(originalCwd);
    }
  });
});
