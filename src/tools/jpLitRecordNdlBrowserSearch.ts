import { normalizeIssuedAt } from "../lib/date.js";
import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import {
  recordNdlBrowserSearchInputSchema,
  recordNdlBrowserSearchOutputSchema
} from "../lib/schemas.js";
import type {
  RecordNdlBrowserSearchInput,
  RecordNdlBrowserSearchOutput
} from "../lib/schemas.js";
import { ndlPidToDigitalSourceId } from "../lib/sourceId.js";

const CACHE_REFRESH_HINT =
  "同一観測の保存済み結果。再確認した場合は新しい checked_at で記録する";

function buildOutput(
  parsed: RecordNdlBrowserSearchInput
): RecordNdlBrowserSearchOutput {
  const items = parsed.items.map((item) => {
    const issued = normalizeIssuedAt(item.published);

    return {
      source: "ndl_digital" as const,
      source_id: ndlPidToDigitalSourceId(item.pid),
      title: item.title,
      subtitle: item.volume,
      title_reading: null,
      authors: item.authors.map((name) => ({ name, role: null })),
      publisher: item.publisher,
      journal_title: null,
      issued_at: issued.issuedAt,
      issued_at_label: issued.issuedAtLabel,
      issued_at_precision: issued.issuedAtPrecision,
      summary: null,
      url: item.viewer_url,
      availability: {
        online: true,
        digital_collection: true
      },
      material_type: null,
      subjects: [],
      table_of_contents: [],
      source_metadata: {
        pid: item.pid,
        candidate_origins: ["ndl_digital_browser"] as ["ndl_digital_browser"],
        browser_observations: [{
          checked_at: parsed.checked_at,
          login_state: parsed.login_state,
          query: parsed.query,
          access_scope: item.access_scope,
          access_label: item.access_label,
          snippets: item.snippets,
          item_fulltext_state: item.item_fulltext_state,
          hit_locations: item.hit_locations,
          content_state: item.content_state,
          print_file_state: item.print_file_state
        }]
      },
      duplicate_key: null,
      duplicate_count: 1,
      related_records: []
    };
  });

  return recordNdlBrowserSearchOutputSchema.parse({
    query: parsed.query,
    source: "ndl_digital",
    page: parsed.page,
    limit: 100,
    total: parsed.reported_total ?? items.length,
    items,
    observation: {
      method: "browser",
      service: "ndl_digital_collections",
      checked_at: parsed.checked_at,
      login_state: parsed.login_state,
      reported_total: parsed.reported_total,
      total_relation: parsed.total_relation,
      observed_count: items.length,
      filters: parsed.filters
    }
  });
}

export function createJpLitRecordNdlBrowserSearchTool(
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = recordNdlBrowserSearchInputSchema.parse(input);
    const { session_id, ...cacheableInput } = parsed;
    const result = await runCachedTool<RecordNdlBrowserSearchOutput>({
      tool: "jp_lit_record_ndl_browser_search",
      input: cacheableInput,
      sessionId: session_id,
      cache,
      sessions,
      live: async () => buildOutput(parsed)
    });
    const structuredContent = recordNdlBrowserSearchOutputSchema.parse({
      ...result.structuredContent,
      cache: {
        hit: result.cacheHit,
        cache_key: result.cacheKey,
        saved_at: result.savedAt,
        refresh_hint: result.cacheHit ? CACHE_REFRESH_HINT : null
      }
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(structuredContent, null, 2)
      }],
      structuredContent
    };
  };
}
