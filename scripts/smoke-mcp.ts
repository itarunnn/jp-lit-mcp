import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createServer } from "../src/server.js";
import { createCacheKey, normalizeCacheInput } from "../src/lib/persistence/cacheKeys.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { getExportsRoot, getPersistenceRoot } from "../src/lib/persistence/paths.js";
import type { RecordItem, SearchItem } from "../src/lib/types.js";

export const EXPECTED_TOOL_NAMES = [
  "jp_lit_annotate_session",
  "jp_lit_delete_cache",
  "jp_lit_enrich_record",
  "jp_lit_export_session",
  "jp_lit_export_view",
  "jp_lit_find_authority_terms_by_classification",
  "jp_lit_find_sessions",
  "jp_lit_get_fulltext",
  "jp_lit_get_record",
  "jp_lit_get_records",
  "jp_lit_get_text_coordinates",
  "jp_lit_list_cache",
  "jp_lit_list_sessions",
  "jp_lit_prune_cache",
  "jp_lit_refine_results",
  "jp_lit_resolve_authority",
  "jp_lit_search",
  "jp_lit_search_cache_index",
  "jp_lit_search_fulltext",
  "jp_lit_search_guides_cases",
  "jp_lit_search_guides_manuals",
  "jp_lit_search_illustrations",
  "jp_lit_search_kaken_projects",
  "jp_lit_search_kokusho_fulltext",
  "jp_lit_search_kokusho_image_tags",
  "jp_lit_search_pages",
  "jp_lit_start_session",
  "jp_lit_suggest_classification_codes",
  "jp_lit_update_session_trace"
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

export const LOCAL_PERSISTENCE_SMOKE_DEFAULT_SOURCE = "cinii_books";
export const LOCAL_PERSISTENCE_SMOKE_DEFAULT_QUERY = "夏目漱石";
export const OFFLINE_SEARCH_FIXTURE_TITLE = "坊っちゃん（offline smoke fixture）";

const OFFLINE_LOCAL_SEARCH = {
  source: LOCAL_PERSISTENCE_SMOKE_DEFAULT_SOURCE,
  query: LOCAL_PERSISTENCE_SMOKE_DEFAULT_QUERY
};

const OFFLINE_RECORD_SOURCE = "cinii_books";
const OFFLINE_RECORD_IDS = [
  "1971993809689508364",
  "1971993809689508365"
] as const;

export const SUPPORTED_LIVE_EXTRA_TOOLS = [
  "jp_lit_search_kaken_projects",
  "jp_lit_search_kokusho_fulltext",
  "jp_lit_search_kokusho_image_tags"
];

const LIVE_DEFAULT_QUERY_BY_SOURCE: Record<string, string> = {
  ndl_catalog: "菊池寛",
  ndl_digital: "菊池寛",
  cinii_dissertations: "源氏物語",
  cinii_books: "夏目漱石",
  kokkai_minutes: "賭博",
  teikoku_minutes: "賭博",
  jstage_articles: "癌",
  nihu_bridge: "源氏物語",
  national_archives: "太政官",
  jacar: "台湾総督府",
  nijl_articles: "源氏物語",
  kokusho: "伊勢物語",
  ninjal_bibliography: "日本語教育"
};

const LIVE_SKIPPABLE_MESSAGE_PATTERNS_BY_SOURCE: Record<string, RegExp[]> = {
  jdcat: [/503 Service Temporarily Unavailable/i],
  national_archives: [/403\b/i, /429\b/i, /temporarily unavailable/i, /maintenance/i],
  jacar: [/403\b/i, /429\b/i, /temporarily unavailable/i, /maintenance/i],
  nijl_articles: [/403\b/i, /429\b/i, /temporarily unavailable/i, /maintenance/i],
  kokusho: [/403\b/i, /429\b/i, /temporarily unavailable/i, /maintenance/i],
  ninjal_bibliography: [/403\b/i, /429\b/i, /temporarily unavailable/i, /maintenance/i]
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

export async function assertJstagePagination(
  client: Pick<Client, "callTool">,
  query: string,
  sessionId: string
) {
  const sourceIds: string[] = [];

  for (const page of [1, 2]) {
    const result = await client.callTool({
      name: "jp_lit_search",
      arguments: {
        session_id: sessionId,
        query,
        source: "jstage_articles",
        limit: 1,
        page
      }
    });
    const data = result.structuredContent as
      | { items?: Array<{ source_id?: string }> }
      | undefined;
    const sourceId = data?.items?.[0]?.source_id;

    if (!sourceId) {
      throw new Error(
        `J-STAGE pagination page ${page} returned no source_id.`
      );
    }

    sourceIds.push(sourceId);
  }

  if (sourceIds[0] === sourceIds[1]) {
    throw new Error(
      `J-STAGE pagination returned the same source_id for page 1/2: ${sourceIds[0]}`
    );
  }

  console.log(
    `J-STAGE pagination passed: page1=${sourceIds[0]} page2=${sourceIds[1]}`
  );
}

export function resolveLocalPersistenceSmokeSearch(env: {
  SMOKE_LOCAL_SOURCE?: string;
  SMOKE_LOCAL_QUERY?: string;
} = process.env) {
  return {
    source: env.SMOKE_LOCAL_SOURCE ?? LOCAL_PERSISTENCE_SMOKE_DEFAULT_SOURCE,
    query: env.SMOKE_LOCAL_QUERY ?? LOCAL_PERSISTENCE_SMOKE_DEFAULT_QUERY
  };
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

export function resolveLiveSmokeExtraTools(override?: string) {
  if (!override) {
    return [];
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

export function resolveSmokeRunMode(env: {
  SMOKE_LIVE_MATRIX?: string;
  SMOKE_LIVE_SOURCES?: string;
}) {
  return env.SMOKE_LIVE_MATRIX === "1" || Boolean(env.SMOKE_LIVE_SOURCES?.trim())
    ? "matrix"
    : "single";
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
  return (
    LIVE_SKIPPABLE_MESSAGE_PATTERNS_BY_SOURCE[source]?.some((pattern) =>
      pattern.test(message)
    ) ?? false
  );
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

export function assertLiveBatchCandidateSources(
  explicitSource: string,
  batchSource: string,
  candidates: Array<{ source?: string }>
) {
  if (
    batchSource !== explicitSource ||
    candidates.some(
      (candidate) =>
        candidate.source !== explicitSource || candidate.source !== batchSource
    )
  ) {
    throw new Error("Live smoke search returned mixed sources.");
  }
}

export function assertLiveBatchRecordSources(
  batchSource: string,
  records: Array<{ source?: string }>
) {
  if (records.some((record) => record.source !== batchSource)) {
    throw new Error("Live smoke batch returned a record from another source.");
  }
}

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

function buildLocalSearchArgs(localSearch: { source: string; query: string }) {
  return {
    query: localSearch.query,
    source: localSearch.source,
    limit: 1,
    page: 1
  };
}

function createOfflineSearchItem(): SearchItem {
  return {
    source: "cinii_books",
    source_id: "offline-smoke-book-1",
    title: OFFLINE_SEARCH_FIXTURE_TITLE,
    subtitle: null,
    title_reading: null,
    authors: [{ name: "夏目漱石", role: "author" }],
    publisher: "offline fixture publisher",
    journal_title: null,
    issued_at: "1906",
    issued_at_label: "1906",
    issued_at_precision: "year",
    summary: "Deterministic fixture for the offline MCP smoke test.",
    url: null,
    availability: { online: false, digital_collection: false },
    material_type: "Book",
    subjects: ["offline smoke"],
    table_of_contents: [],
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

async function seedOfflineSearchCache(baseDir: string) {
  const searchArgs = buildLocalSearchArgs(OFFLINE_LOCAL_SEARCH);
  const normalizedInput = normalizeCacheInput(searchArgs);
  const cacheKey = createCacheKey("jp_lit_search", normalizedInput);

  await createFileCache(baseDir).write("jp_lit_search", {
    version: 1,
    tool: "jp_lit_search",
    cache_key: cacheKey,
    saved_at: "2000-01-01T00:00:00.000Z",
    input: normalizedInput,
    structured_content: {
      query: OFFLINE_LOCAL_SEARCH.query,
      source: OFFLINE_LOCAL_SEARCH.source,
      page: 1,
      limit: 1,
      total: 1,
      items: [createOfflineSearchItem()]
    }
  });
}

function createOfflineRecordItem(sourceId: string): RecordItem {
  return {
    source: OFFLINE_RECORD_SOURCE,
    source_id: sourceId,
    title: `offline record ${sourceId}`,
    subtitle: null,
    title_reading: null,
    authors: [],
    publisher: "offline fixture publisher",
    journal_title: null,
    issued_at: "1906",
    issued_at_label: "1906",
    issued_at_precision: "year",
    summary: "Deterministic batch record fixture.",
    url: null,
    availability: { online: false, digital_collection: false },
    alternative_titles: [],
    publication_place: null,
    language: "jpn",
    material_type: "book",
    extent: null,
    subjects: [],
    identifiers: {},
    table_of_contents: [],
    content_access: {
      has_page_images: false,
      has_text_coordinates: false,
      viewer_url: null,
      access_note: null
    },
    source_metadata: {},
    raw: {}
  };
}

async function seedOfflineRecordCaches(baseDir: string) {
  const cache = createFileCache(baseDir);
  await Promise.all(
    OFFLINE_RECORD_IDS.map(async (sourceId) => {
      const input = normalizeCacheInput({
        source: OFFLINE_RECORD_SOURCE,
        source_id: sourceId
      });
      const cacheKey = createCacheKey("jp_lit_get_record", input);
      await cache.write("jp_lit_get_record", {
        version: 1,
        tool: "jp_lit_get_record",
        cache_key: cacheKey,
        saved_at: "2000-01-01T00:00:00.000Z",
        input,
        structured_content: createOfflineRecordItem(sourceId)
      });
    })
  );
}

export async function withNetworkDenied<T>(operation: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  let attemptedUrl: string | null = null;
  globalThis.fetch = (async (input: string | URL | Request) => {
    attemptedUrl = String(input);
    throw new Error(`Offline smoke blocked network access: ${attemptedUrl}`);
  }) as typeof globalThis.fetch;

  try {
    const result = await operation();
    if (attemptedUrl !== null) {
      throw new Error(`Offline smoke blocked network access: ${attemptedUrl}`);
    }
    return result;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

interface LocalPersistenceSmokeSummary {
  title: string;
  cacheHit: boolean;
  annotatedCount: number;
  tracedSessionFound: boolean;
  exportContainsSelection: boolean;
  startedNewSession: boolean;
  archivedSessionExported: boolean;
  batchRecordCount: number;
}

async function runLocalPersistenceSmoke(
  client: Client,
  options: {
    sessionId: string;
    search?: { source: string; query: string };
    expectCacheHit?: boolean;
    batchRecordSource?: string;
    batchRecordIds?: readonly string[];
  }
): Promise<LocalPersistenceSmokeSummary> {
  const localSearch = options.search ?? resolveLocalPersistenceSmokeSearch();
  const searchArgs = buildLocalSearchArgs(localSearch);
  const searchResult = await client.callTool({
    name: "jp_lit_search",
    arguments: { session_id: options.sessionId, ...searchArgs }
  });
  const searchData = searchResult.structuredContent as
    | {
        items?: Array<{
          source?: string;
          source_id?: string;
          title?: string;
        }>;
        cache?: { hit?: boolean };
      }
    | undefined;

  const firstItem = searchData?.items?.[0];
  if (!firstItem?.source || !firstItem.source_id || !firstItem.title) {
    throw new Error("Local smoke search returned no annotatable item.");
  }
  if (options.expectCacheHit && searchData?.cache?.hit !== true) {
    throw new Error("Offline smoke did not use the seeded search fixture.");
  }

  let batchRecordCount = 0;
  if (options.batchRecordSource && options.batchRecordIds) {
    const batchResult = await client.callTool({
      name: "jp_lit_get_records",
      arguments: {
        session_id: options.sessionId,
        source: options.batchRecordSource,
        source_ids: [...options.batchRecordIds]
      }
    });
    const batchData = batchResult.structuredContent as
      | {
          success_count?: number;
          error_count?: number;
          items?: Array<{
            source_id?: string;
            status?: string;
            record?: { cache?: { hit?: boolean } };
          }>;
        }
      | undefined;
    if (
      batchData?.success_count !== 2 ||
      batchData.error_count !== 0 ||
      batchData.items?.map((item) => item.source_id).join(",") !==
        options.batchRecordIds.join(",") ||
      batchData.items?.some(
        (item) => item.status !== "ok" || item.record?.cache?.hit !== true
      ) !== false
    ) {
      throw new Error("Offline batch record smoke returned unexpected data.");
    }
    batchRecordCount = batchData.success_count;
  }

  const cacheKey = createCacheKey(
    "jp_lit_search",
    normalizeCacheInput(searchArgs as Record<string, unknown>)
  );

  const sessionRecord = await client.callTool({
    name: "jp_lit_annotate_session",
    arguments: {
      session_id: options.sessionId,
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
  const annotatedSessionId = (
    sessionRecord.structuredContent as { session_id?: string } | undefined
  )?.session_id;
  if (annotatedCount !== 1) {
    throw new Error("Local smoke annotation did not persist selected item.");
  }
  if (!annotatedSessionId) {
    throw new Error("Local smoke annotation did not return a session id.");
  }

  const traceResult = await client.callTool({
    name: "jp_lit_update_session_trace",
    arguments: {
      session_id: options.sessionId,
      research_goal: "smoke trace",
      source_plans: [
        {
          source: localSearch.source,
          status: "used",
          reason: "local smoke search"
        }
      ],
      next_actions: [
        {
          action: "export smoke session",
          reason: "verify trace persists",
          priority: "low",
          source: localSearch.source
        }
      ]
    }
  });
  const traceData = traceResult.structuredContent as
    | { source_plan_count?: number; next_action_count?: number }
    | undefined;
  if (traceData?.source_plan_count !== 1 || traceData.next_action_count !== 1) {
    throw new Error("Local smoke trace update did not persist expected counts.");
  }

  const listSessionsResult = await client.callTool({
    name: "jp_lit_list_sessions",
    arguments: {
      limit: 5,
      has_trace: true,
      has_selected: true,
      source: localSearch.source
    }
  });
  const listSessionsData = listSessionsResult.structuredContent as
    | {
        total?: number;
        items?: Array<{
          has_trace?: boolean;
          has_selected?: boolean;
          selected_count?: number;
          sources?: string[];
          research_goal?: string | null;
        }>;
      }
    | undefined;
  const smokeSession = listSessionsData?.items?.find(
    (item) =>
      item.has_trace === true &&
      item.has_selected === true &&
      (item.selected_count ?? 0) > 0 &&
      item.sources?.includes(localSearch.source) &&
      item.research_goal === "smoke trace"
  );
  if (!smokeSession || (listSessionsData?.total ?? 0) < 1) {
    throw new Error("Local smoke session list did not expose the traced annotated session.");
  }

  const exportResult = await client.callTool({
    name: "jp_lit_export_session",
    arguments: {
      session_id: options.sessionId,
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
  if (
    options.batchRecordIds &&
    (!exportedText.includes("## jp_lit_get_record") ||
      exportedText.includes("## jp_lit_get_records"))
  ) {
    throw new Error("Offline batch record smoke used an unexpected session namespace.");
  }

  const startResult = await client.callTool({
    name: "jp_lit_start_session",
    arguments: {
      research_goal: "next smoke session",
      scope_note: "verify archived session remains readable"
    }
  });
  const startedSessionId = (
    startResult.structuredContent as { session_id?: string } | undefined
  )?.session_id;
  if (!startedSessionId || startedSessionId === annotatedSessionId) {
    throw new Error("Local smoke did not start a distinct new session.");
  }

  const archivedExportResult = await client.callTool({
    name: "jp_lit_export_session",
    arguments: {
      session_id: annotatedSessionId,
      format: "markdown",
      output_path: path.join("exports", "smoke-session-archive.md")
    }
  });
  const archivedExportPath = (
    archivedExportResult.structuredContent as { path?: string } | undefined
  )?.path;
  if (!archivedExportPath) {
    throw new Error("Local smoke archived session export did not return a path.");
  }
  const archivedExportText = await readFile(archivedExportPath, "utf8");
  if (
    !archivedExportText.includes(firstItem.title) ||
    !archivedExportText.includes("strong_candidate")
  ) {
    throw new Error("Local smoke could not read and export the archived session.");
  }

  return {
    title: firstItem.title,
    cacheHit: searchData?.cache?.hit === true,
    annotatedCount,
    tracedSessionFound: true,
    exportContainsSelection: true,
    startedNewSession: true,
    archivedSessionExported: true,
    batchRecordCount
  };
}

async function runOcrSmoke(client: Client, sessionId: string, sourceId: string, pid: string) {
  const coordResult = await client.callTool({
    name: "jp_lit_get_text_coordinates",
    arguments: { session_id: sessionId, source: "ndl_digital", source_id: sourceId, page: 1 }
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
    arguments: { session_id: sessionId, source: "ndl_digital", source_id: sourceId }
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

async function runOcrFallbackSmoke(client: Client, sessionId: string, source: string) {
  const keyword = resolveOcrFallbackKeyword(
    source,
    process.env.SMOKE_LIVE_OCR_KEYWORD
  );
  const fulltextSearchResult = await client.callTool({
    name: "jp_lit_search_fulltext",
    arguments: {
      session_id: sessionId,
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
      session_id: sessionId,
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

  await runOcrSmoke(client, sessionId, pid, pid);
}

async function runIllustrationSmoke(client: Client, sessionId: string, source: string) {
  const keyword = resolveIllustrationFallbackKeyword(
    source,
    process.env.SMOKE_LIVE_ILLUSTRATION_KEYWORD
  );
  const result = await client.callTool({
    name: "jp_lit_search_illustrations",
    arguments: {
      session_id: sessionId,
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

function isSkippableExtraToolError(result: { isError?: boolean; content?: Array<{ text?: string }> }) {
  if (!result.isError) {
    return false;
  }

  const message = getLiveErrorMessage(result);
  return [/403\b/i, /429\b/i, /temporarily unavailable/i, /maintenance/i].some((pattern) =>
    pattern.test(message)
  );
}

async function runKokushoFulltextSmoke(client: Client, sessionId: string): Promise<LiveSmokeStatus> {
  const result = await client.callTool({
    name: "jp_lit_search_kokusho_fulltext",
    arguments: {
      session_id: sessionId,
      keyword: process.env.SMOKE_LIVE_KOKUSHO_FULLTEXT_QUERY ?? "春",
      limit: 1,
      page: 1
    }
  });

  if (isSkippableExtraToolError(result as { isError?: boolean; content?: Array<{ text?: string }> })) {
    return { status: "skipped", note: getLiveErrorMessage(result as { content?: Array<{ text?: string }> }) };
  }

  const data = result.structuredContent as
    | { items?: Array<{ bid?: string; koma?: number | null; snippet?: string | null }> }
    | undefined;
  const first = data?.items?.[0];
  if (!first?.bid || typeof first.koma !== "number" || !first.snippet) {
    throw new Error("Kokusho fulltext smoke returned unexpected data.");
  }

  console.log(`jp_lit_search_kokusho_fulltext passed: bid=${first.bid} koma=${first.koma}`);
  return { status: "passed", note: null };
}

async function runKokushoImageTagsSmoke(client: Client, sessionId: string): Promise<LiveSmokeStatus> {
  const result = await client.callTool({
    name: "jp_lit_search_kokusho_image_tags",
    arguments: {
      session_id: sessionId,
      keyword: process.env.SMOKE_LIVE_KOKUSHO_IMAGE_TAG_QUERY ?? "桜",
      limit: 1,
      page: 1
    }
  });

  if (isSkippableExtraToolError(result as { isError?: boolean; content?: Array<{ text?: string }> })) {
    return { status: "skipped", note: getLiveErrorMessage(result as { content?: Array<{ text?: string }> }) };
  }

  const data = result.structuredContent as
    | { items?: Array<{ bid?: string; koma?: number | null; tag_texts?: string[] }> }
    | undefined;
  const first = data?.items?.[0];
  if (!first?.bid || typeof first.koma !== "number" || !Array.isArray(first.tag_texts) || first.tag_texts.length === 0) {
    throw new Error("Kokusho image tag smoke returned unexpected data.");
  }

  console.log(`jp_lit_search_kokusho_image_tags passed: bid=${first.bid} koma=${first.koma}`);
  return { status: "passed", note: null };
}

async function runKakenProjectsSmoke(client: Client, sessionId: string): Promise<LiveSmokeStatus> {
  const query = process.env.SMOKE_LIVE_KAKEN_QUERY ?? "19K20626";
  const result = await client.callTool({
    name: "jp_lit_search_kaken_projects",
    arguments: {
      session_id: sessionId,
      query,
      limit: 1,
      page: 1,
      detail_limit: 0,
      include_outputs: false,
      force_refresh: true
    }
  });

  if (result.isError) {
    throw new Error(getLiveErrorMessage(result as { content?: Array<{ text?: string }> }));
  }

  const data = result.structuredContent as
    | { total?: number; items?: Array<{ project_id?: string; title?: string }> }
    | undefined;
  const first = data?.items?.[0];
  if (typeof data?.total !== "number" || data.total < 1 || !first?.project_id || !first.title) {
    throw new Error("KAKEN projects smoke returned no project data.");
  }

  console.log(`jp_lit_search_kaken_projects passed: query=${query} project_id=${first.project_id}`);
  return { status: "passed", note: null };
}

async function runLiveExtraTools(client: Client, sessionId: string): Promise<LiveSmokeStatus> {
  const extraTools = resolveLiveSmokeExtraTools(process.env.SMOKE_LIVE_EXTRA_TOOLS);
  for (const tool of extraTools) {
    let outcome: LiveSmokeStatus;
    if (tool === "jp_lit_search_kaken_projects") {
      outcome = await runKakenProjectsSmoke(client, sessionId);
    } else if (tool === "jp_lit_search_kokusho_fulltext") {
      outcome = await runKokushoFulltextSmoke(client, sessionId);
    } else if (tool === "jp_lit_search_kokusho_image_tags") {
      outcome = await runKokushoImageTagsSmoke(client, sessionId);
    } else {
      throw new Error(`Unsupported live smoke extra tool: ${tool}`);
    }

    if (outcome.status === "skipped") {
      console.log(`Live smoke extra tool skipped: ${tool}`);
      return outcome;
    }
  }

  return { status: "passed", note: null };
}

type LiveSmokeStatus =
  | { status: "passed"; note?: string | null }
  | { status: "skipped"; note: string };

async function runLiveSmoke(client: Client, sessionId: string): Promise<LiveSmokeStatus> {
  const liveSource = process.env.SMOKE_LIVE_SOURCE ?? "ndl_catalog";
  const liveQuery = resolveLiveSmokeQuery(liveSource, process.env.SMOKE_LIVE_QUERY);
  const liveSortBy = process.env.SMOKE_LIVE_SORT_BY;
  const liveSortOrder = process.env.SMOKE_LIVE_SORT_ORDER;

  const searchResult = await client.callTool({
    name: "jp_lit_search",
    arguments: {
      session_id: sessionId,
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
  const batchSource = candidateItems[0]!.source!;
  assertLiveBatchCandidateSources(liveSource, batchSource, candidateItems);

  const recordResult = await client.callTool({
    name: "jp_lit_get_records",
    arguments: {
      session_id: sessionId,
      source: batchSource,
      source_ids: candidateItems.map((item) => item.source_id!)
    }
  });
  const batchData = recordResult.structuredContent as
    | {
        items?: Array<{
          status?: string;
          record?: LiveRecordCandidate;
        }>;
      }
    | undefined;
  const candidateRecords =
    batchData?.items
      ?.filter(
        (item): item is { status?: string; record: LiveRecordCandidate } =>
          item.status === "ok" && item.record !== undefined
      )
      .map((item) => item.record) ?? [];
  assertLiveBatchRecordSources(batchSource, candidateRecords);

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
      await runOcrSmoke(client, sessionId, recordData.source_id, nextDl.pid);
    } else {
      console.log(
        `next_digital_library not available for this record — OCR smoke skipped`
      );
      await runOcrFallbackSmoke(client, sessionId, liveSource);
    }

    await runIllustrationSmoke(client, sessionId, liveSource);
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

type SmokePassResult = LiveSmokeStatus & {
  local: LocalPersistenceSmokeSummary;
};

async function mainSinglePass(
  options: { offline?: boolean } = {}
): Promise<SmokePassResult> {
  const originalCwd = process.cwd();
  const smokeDir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-smoke-"));
  process.chdir(smokeDir);
  await resetSmokePersistence(smokeDir);

  try {
    const execute = async (): Promise<SmokePassResult> => {
      if (options.offline) {
        await Promise.all([
          seedOfflineSearchCache(smokeDir),
          seedOfflineRecordCaches(smokeDir)
        ]);
      }

      const server = createServer();
      const client = new Client({
        name: "jp-lit-smoke-client",
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
        const initialSession = await client.callTool({
          name: "jp_lit_start_session",
          arguments: {
            research_goal: options.offline
              ? "deterministic offline smoke"
              : "MCP smoke"
          }
        });
        const sessionId = (
          initialSession.structuredContent as { session_id?: string } | undefined
        )?.session_id;
        if (!sessionId) {
          throw new Error("MCP smoke could not start an explicit research session.");
        }
        const local = await runLocalPersistenceSmoke(
          client,
          options.offline
            ? {
                sessionId,
                search: OFFLINE_LOCAL_SEARCH,
                expectCacheHit: true,
                batchRecordSource: OFFLINE_RECORD_SOURCE,
                batchRecordIds: OFFLINE_RECORD_IDS
              }
            : { sessionId }
        );
        console.log(
          options.offline
            ? "Deterministic offline persistence smoke passed."
            : "Local persistence smoke passed."
        );

        if (!options.offline && process.env.SMOKE_LIVE === "1") {
          const liveSource = process.env.SMOKE_LIVE_SOURCE ?? "ndl_catalog";
          if (
            resolveSmokeRunMode(process.env) === "matrix" &&
            liveSource === "jstage_articles"
          ) {
            await assertJstagePagination(
              client,
              resolveLiveSmokeQuery(liveSource, process.env.SMOKE_LIVE_QUERY),
              sessionId
            );
          }

          const liveOutcome = await runLiveSmoke(client, sessionId);
          if (liveOutcome.status === "skipped") {
            return { ...liveOutcome, local };
          }
          return { ...(await runLiveExtraTools(client, sessionId)), local };
        }

        return { status: "passed", note: null, local };
      } finally {
        await client.close();
        await server.close();
      }
    };

    return options.offline
      ? await withNetworkDenied(execute)
      : await execute();
  } finally {
    process.chdir(originalCwd);
    await rm(smokeDir, { recursive: true, force: true });
  }
}

export async function runDeterministicOfflineSmoke() {
  return mainSinglePass({ offline: true });
}

export async function main() {
  if (process.env.SMOKE_OFFLINE === "1") {
    await runDeterministicOfflineSmoke();
    return;
  }

  if (resolveSmokeRunMode(process.env) === "matrix") {
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
