import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createServer } from "../src/server.js";
import { createCacheKey, normalizeCacheInput } from "../src/lib/persistence/cacheKeys.js";
import { getExportsRoot, getPersistenceRoot } from "../src/lib/persistence/paths.js";

export const EXPECTED_TOOL_NAMES = [
  "jp_lit_annotate_session",
  "jp_lit_export_session",
  "jp_lit_get_fulltext",
  "jp_lit_get_record",
  "jp_lit_get_text_coordinates",
  "jp_lit_search",
  "jp_lit_search_fulltext",
  "jp_lit_search_illustrations",
  "jp_lit_search_pages"
];

export const LIVE_MATRIX_SOURCES = [
  "ndl_catalog",
  "ndl_digital",
  "cinii_books",
  "nihu_bridge",
  "jstage_articles",
  "kokkai_minutes",
  "teikoku_minutes",
  "irdb",
  "jdcat"
];

export const DEFAULT_LIVE_RETRY_COUNT = 2;

const LIVE_DEFAULT_QUERY_BY_SOURCE: Record<string, string> = {
  ndl_catalog: "菊池寛",
  ndl_digital: "菊池寛",
  cinii_books: "夏目漱石",
  kokkai_minutes: "賭博",
  teikoku_minutes: "賭博",
  jstage_articles: "癌",
  nihu_bridge: "源氏物語"
};

const OCR_FALLBACK_KEYWORD_BY_SOURCE: Record<string, string> = {
  ndl_digital: "大政奉還"
};

const ILLUSTRATION_FALLBACK_KEYWORD_BY_SOURCE: Record<string, string> = {
  ndl_digital: "富士山"
};

export function resolveLiveSmokeQuery(source: string, override?: string) {
  return override ?? LIVE_DEFAULT_QUERY_BY_SOURCE[source] ?? "菊池寛";
}

export function resolveLiveSmokeSources(override?: string) {
  if (!override) {
    return LIVE_MATRIX_SOURCES;
  }

  return override
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function resolveLiveRetryCount(override?: string) {
  if (!override) {
    return DEFAULT_LIVE_RETRY_COUNT;
  }

  const parsed = Number.parseInt(override, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_LIVE_RETRY_COUNT;
}

export function resolveLiveReportPath(baseDir: string, override?: string) {
  return path.resolve(baseDir, override ?? path.join("exports", "live-smoke-report.json"));
}

export function resolveOcrFallbackKeyword(source: string, override?: string) {
  return override ?? OCR_FALLBACK_KEYWORD_BY_SOURCE[source] ?? "大政奉還";
}

export function resolveIllustrationFallbackKeyword(source: string, override?: string) {
  return override ?? ILLUSTRATION_FALLBACK_KEYWORD_BY_SOURCE[source] ?? "富士山";
}

export function isSkippableLiveError(
  source: string,
  result: { isError?: boolean; content?: Array<{ text?: string }> }
) {
  if (!result.isError) {
    return false;
  }

  const message = getLiveErrorMessage(result);
  return source === "jdcat" && message.includes("503 Service Temporarily Unavailable");
}

export function getLiveErrorMessage(result: {
  content?: Array<{ text?: string }>;
}) {
  return result.content?.map((item) => item.text ?? "").join("\n") ?? "";
}

type LiveRecordCandidate = {
  source?: string;
  source_id?: string;
  title?: string;
  source_metadata?: {
    next_digital_library?: { pid?: string; available?: boolean } | null;
    holding_count?: number | null;
    holdings?: Array<{
      library_name?: string;
      library_url?: string;
    }>;
    research_resource_id?: string;
    database_id?: string;
  };
};

export function pickPreferredLiveRecord(
  source: string,
  records: LiveRecordCandidate[]
) {
  if (source === "ndl_digital") {
    return (
      records.find(
        (record) => record.source_metadata?.next_digital_library?.available === true
      ) ?? records[0]
    );
  }

  return records[0];
}

async function resetSmokePersistence(baseDir: string) {
  await rm(getPersistenceRoot(baseDir), { recursive: true, force: true });
  await rm(getExportsRoot(baseDir), { recursive: true, force: true });
}

async function runLocalPersistenceSmoke(client: Client) {
  const searchArgs = {
    query: "菊池寛",
    source: "ndl_catalog",
    limit: 1,
    page: 1
  };
  const searchResult = await client.callTool({
    name: "jp_lit_search",
    arguments: searchArgs
  });
  const searchData = searchResult.structuredContent as
    | {
        items?: Array<{
          source?: string;
          source_id?: string;
          title?: string;
        }>;
      }
    | undefined;

  const firstItem = searchData?.items?.[0];
  if (!firstItem?.source || !firstItem.source_id || !firstItem.title) {
    throw new Error("Local smoke search returned no annotatable item.");
  }

  const cacheKey = createCacheKey(
    "jp_lit_search",
    normalizeCacheInput(searchArgs as Record<string, unknown>)
  );

  const sessionRecord = await client.callTool({
    name: "jp_lit_annotate_session",
    arguments: {
      tool: "jp_lit_search",
      cache_key: cacheKey,
      selected_items: [
        {
          source: firstItem.source,
          source_id: firstItem.source_id,
          title: firstItem.title,
          label: "strong_candidate",
          note: "smoke"
        }
      ],
      notes: ["smoke"]
    }
  });

  const annotatedCount = (sessionRecord.structuredContent as { annotated_count?: number } | undefined)
    ?.annotated_count;
  if (annotatedCount !== 1) {
    throw new Error("Local smoke annotation did not persist selected item.");
  }

  const exportResult = await client.callTool({
    name: "jp_lit_export_session",
    arguments: {
      format: "markdown",
      output_path: path.join("exports", "smoke-session.md")
    }
  });

  const exportPath = (exportResult.structuredContent as { path?: string } | undefined)?.path;
  if (!exportPath) {
    throw new Error("Local smoke export did not return a path.");
  }

  const exportedText = await readFile(exportPath, "utf8");
  if (!exportedText.includes(firstItem.title) || !exportedText.includes("strong_candidate")) {
    throw new Error("Local smoke export did not contain annotated selection.");
  }
}

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

async function runOcrFallbackSmoke(client: Client, source: string) {
  const keyword = resolveOcrFallbackKeyword(
    source,
    process.env.SMOKE_LIVE_OCR_KEYWORD
  );
  const fulltextSearchResult = await client.callTool({
    name: "jp_lit_search_fulltext",
    arguments: {
      keyword,
      size: 1,
      from: 0
    }
  });
  const fulltextSearchData = fulltextSearchResult.structuredContent as
    | {
        items?: Array<{
          pid?: string;
        }>;
      }
    | undefined;
  const pid = fulltextSearchData?.items?.[0]?.pid;

  if (!pid) {
    throw new Error(`OCR fallback search returned no pid for keyword=${keyword}`);
  }

  console.log(`OCR fallback search passed: keyword=${keyword} pid=${pid}`);

  const searchPagesResult = await client.callTool({
    name: "jp_lit_search_pages",
    arguments: {
      source: "ndl_digital",
      pid,
      keyword,
      size: 1,
      from: 0
    }
  });
  const searchPagesData = searchPagesResult.structuredContent as
    | { total?: number; items?: unknown[] }
    | undefined;

  if (
    typeof searchPagesData?.total !== "number" ||
    !Array.isArray(searchPagesData.items)
  ) {
    throw new Error(`OCR fallback page search returned unexpected data for pid=${pid}`);
  }

  console.log(
    `jp_lit_search_pages passed: pid=${pid} total=${searchPagesData.total}`
  );

  await runOcrSmoke(client, pid, pid);
}

async function runIllustrationSmoke(client: Client, source: string) {
  const keyword = resolveIllustrationFallbackKeyword(
    source,
    process.env.SMOKE_LIVE_ILLUSTRATION_KEYWORD
  );
  const result = await client.callTool({
    name: "jp_lit_search_illustrations",
    arguments: {
      keyword,
      size: 1,
      from: 0
    }
  });
  const data = result.structuredContent as
    | {
        items?: Array<{
          pid?: string;
          page?: number;
          page_image_url?: string;
          illustration_image_url?: string;
        }>;
      }
    | undefined;
  const first = data?.items?.[0];

  if (
    !first?.pid ||
    typeof first.page !== "number" ||
    !first.page_image_url ||
    !first.illustration_image_url
  ) {
    throw new Error(`Illustration smoke returned unexpected data for keyword=${keyword}`);
  }

  console.log(
    `jp_lit_search_illustrations passed: keyword=${keyword} pid=${first.pid} page=${first.page}`
  );
}

type LiveSmokeStatus =
  | { status: "passed"; note?: string | null }
  | { status: "skipped"; note: string };

async function runLiveSmoke(client: Client): Promise<LiveSmokeStatus> {
  const liveSource = process.env.SMOKE_LIVE_SOURCE ?? "ndl_catalog";
  const liveQuery = resolveLiveSmokeQuery(liveSource, process.env.SMOKE_LIVE_QUERY);
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

  if (isSkippableLiveError(liveSource, searchResult as { isError?: boolean; content?: Array<{ text?: string }> })) {
    console.log(`Live smoke skipped: ${liveSource} upstream temporarily unavailable`);
    return {
      status: "skipped",
      note: getLiveErrorMessage(
        searchResult as { content?: Array<{ text?: string }> }
      )
    };
  }

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

  const candidateItems = searchData.items.slice(0, 3);
  if (candidateItems.some((item) => !item?.source || !item.source_id)) {
    throw new Error("Live smoke search returned an item without source/source_id.");
  }

  const candidateRecords: LiveRecordCandidate[] = [];
  for (const item of candidateItems) {
    const recordResult = await client.callTool({
      name: "jp_lit_get_record",
      arguments: {
        source: item.source!,
        source_id: item.source_id!
      }
    });
    const recordData = recordResult.structuredContent as LiveRecordCandidate | undefined;

    if (recordData) {
      candidateRecords.push(recordData);
    }
  }

  const recordData = pickPreferredLiveRecord(liveSource, candidateRecords);

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
      await runOcrSmoke(client, recordData.source_id, nextDl.pid);
    } else {
      console.log(
        `next_digital_library not available for this record — OCR smoke skipped`
      );
      await runOcrFallbackSmoke(client, liveSource);
    }

    await runIllustrationSmoke(client, liveSource);
  }

  return { status: "passed", note: null };
}

async function runLiveSmokeMatrix() {
  const baseDir = process.cwd();
  const sources = resolveLiveSmokeSources(process.env.SMOKE_LIVE_SOURCES);
  const retryCount = resolveLiveRetryCount(process.env.SMOKE_LIVE_RETRY_COUNT);
  const reportPath = resolveLiveReportPath(baseDir, process.env.SMOKE_LIVE_REPORT_PATH);
  let failures = 0;
  let skips = 0;
  const results: Array<{
    source: string;
    status: "passed" | "skipped" | "failed";
    attempts: number;
    error: string | null;
  }> = [];

  for (const source of sources) {
    process.env.SMOKE_LIVE = "1";
    process.env.SMOKE_LIVE_SOURCE = source;
    let lastError: unknown = null;
    let finalStatus: "passed" | "skipped" | "failed" = "failed";
    let attempts = 0;

    for (let attempt = 1; attempt <= retryCount + 1; attempt += 1) {
      attempts = attempt;
      try {
        const outcome = await mainSinglePass();
        finalStatus = outcome.status;
        lastError = null;
        if (outcome.status === "skipped") {
          lastError = outcome.note;
        }
        break;
      } catch (error) {
        lastError = error;
        if (attempt <= retryCount) {
          console.log(`MATRIX RETRY: ${source} attempt=${attempt + 1}`);
          continue;
        }
      }
    }

    if (finalStatus === "passed") {
      console.log(`MATRIX PASS: ${source}`);
      results.push({ source, status: "passed", attempts, error: null });
      continue;
    }

    if (finalStatus === "skipped") {
      skips += 1;
      console.log(`MATRIX SKIP: ${source}`);
      results.push({
        source,
        status: "skipped",
        attempts,
        error: typeof lastError === "string" ? lastError : null
      });
      continue;
    }

    failures += 1;
    console.error(`MATRIX FAIL: ${source}`);
    console.error(lastError);
    results.push({
      source,
      status: "failed",
      attempts,
      error: lastError instanceof Error ? lastError.message : String(lastError)
    });
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total: sources.length,
        failed: failures,
        skipped: skips,
        retry_count: retryCount,
        results
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `Live smoke matrix complete: total=${sources.length} failed=${failures} skipped=${skips} report=${reportPath}`
  );

  if (failures > 0) {
    throw new Error(`Live smoke matrix failed: ${failures} source(s)`);
  }
}

async function mainSinglePass(): Promise<LiveSmokeStatus> {
  const originalCwd = process.cwd();
  const smokeDir = await mkdtemp(path.join(os.tmpdir(), "ndl-jp-lit-smoke-"));
  process.chdir(smokeDir);
  await resetSmokePersistence(smokeDir);
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
      toolNames.length !== EXPECTED_TOOL_NAMES.length ||
      toolNames.some((name, i) => name !== EXPECTED_TOOL_NAMES[i])
    ) {
      throw new Error(`Unexpected tools: ${toolNames.join(", ")}`);
    }

    console.log("MCP smoke check passed.");
    console.log(toolNames.join(", "));
    await runLocalPersistenceSmoke(client);
    console.log("Local persistence smoke passed.");

    if (process.env.SMOKE_LIVE === "1") {
      return await runLiveSmoke(client);
    }

    return { status: "passed", note: null };
  } finally {
    await client.close();
    await server.close();
    process.chdir(originalCwd);
    await rm(smokeDir, { recursive: true, force: true });
  }
}

export async function main() {
  if (process.env.SMOKE_LIVE_MATRIX === "1") {
    await runLiveSmokeMatrix();
    return;
  }

  await mainSinglePass();
}

const isEntrypoint =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
