import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createServer } from "../src/server.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-session-annotation-"));
  tempDirs.push(dir);
  return dir;
}

function ciniiResponse() {
  return new Response(
    JSON.stringify({
      "@id": "https://cir.nii.ac.jp/opensearch/articles?q=annotation+retention",
      "@type": "channel",
      "opensearch:totalResults": 1,
      items: [
        {
          "@id": "https://cir.nii.ac.jp/crid/123456789",
          title: "注釈保持テスト",
          link: { "@id": "https://cir.nii.ac.jp/crid/123456789" },
          "dc:creator": ["テスト著者"],
          "dc:type": "Article",
          "prism:publicationDate": "2026"
        }
      ]
    }),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" }
    }
  );
}

async function readExportedSession(
  client: Client,
  outputPath: string
) {
  const result = await client.callTool({
    name: "jp_lit_export_session",
    arguments: {
      format: "json",
      output_path: outputPath,
      profile: "full_log"
    }
  });
  const exportedPath = (result.structuredContent as { path: string }).path;
  return JSON.parse(await readFile(exportedPath, "utf8")) as {
    entries: Array<{
      selected_items: Array<{ source_id: string; label: string }>;
      notes: string[];
      trace?: { intent?: string; decisions?: Array<{ reason: string }> };
    }>;
  };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("cached tool session annotation persistence", () => {
  it("search→annotate後のcache hitとforce_refreshで注釈を保持して重複entryを作らない", async () => {
    const baseDir = await createTempDir();
    const originalCwd = process.cwd();
    process.chdir(baseDir);
    const fetchMock = vi.fn(async () => ciniiResponse());
    vi.stubGlobal("fetch", fetchMock);
    const server = createServer({
      CINII_RESEARCH_BASE_URL:
        "https://cinii.example.test/opensearch/articles",
      CINII_RESEARCH_APP_ID: "test-app-id"
    });
    const client = new Client({
      name: "jp-lit-session-annotation-test-client",
      version: "1.0.0"
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const searchArguments = {
        query: "annotation retention",
        source: "cinii_articles"
      } as const;
      const first = await client.callTool({
        name: "jp_lit_search",
        arguments: searchArguments
      });
      const cacheKey = (
        first.structuredContent as {
          cache: { cache_key: string; hit: boolean };
        }
      ).cache.cache_key;

      await client.callTool({
        name: "jp_lit_annotate_session",
        arguments: {
          tool: "jp_lit_search",
          cache_key: cacheKey,
          selected_items: [
            {
              source: "cinii_articles",
              source_id: "123456789",
              title: "注釈保持テスト",
              label: "strong_candidate",
              note: "本文確認待ち"
            }
          ],
          notes: ["利用者が保持したいメモ"],
          trace: {
            intent: "topic_literature_review",
            decisions: [
              {
                kind: "hold",
                target: {
                  source: "cinii_articles",
                  source_id: "123456789",
                  title: "注釈保持テスト"
                },
                reason: "本文未確認",
                evidence_refs: []
              }
            ]
          }
        }
      });

      const cacheHit = await client.callTool({
        name: "jp_lit_search",
        arguments: searchArguments
      });
      expect(
        (cacheHit.structuredContent as { cache: { hit: boolean } }).cache.hit
      ).toBe(true);
      const afterCacheHit = await readExportedSession(
        client,
        "exports/after-cache-hit.json"
      );
      expect(afterCacheHit.entries).toHaveLength(1);
      expect(afterCacheHit.entries[0]).toMatchObject({
        selected_items: [
          { source_id: "123456789", label: "strong_candidate" }
        ],
        notes: ["利用者が保持したいメモ"],
        trace: {
          intent: "topic_literature_review",
          decisions: [expect.objectContaining({ reason: "本文未確認" })]
        }
      });

      const refreshed = await client.callTool({
        name: "jp_lit_search",
        arguments: { ...searchArguments, force_refresh: true }
      });
      expect(
        (refreshed.structuredContent as { cache: { hit: boolean } }).cache.hit
      ).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const afterRefresh = await readExportedSession(
        client,
        "exports/after-refresh.json"
      );
      expect(afterRefresh.entries).toHaveLength(1);
      expect(afterRefresh.entries[0]).toMatchObject(
        afterCacheHit.entries[0] as Record<string, unknown>
      );
    } finally {
      await client.close();
      await server.close();
      process.chdir(originalCwd);
    }
  });
});
