import { searchInputToolSchema } from "../schemas.js";
import { detectQueryScript, type SearchContext, SEARCH_PARAMETER_KEYS } from "../searchContext.js";
import { searchContextSchema } from "../searchContextSchema.js";
import type { CacheEnvelope, SessionDocument } from "./types.js";
import type { SearchMethodSnapshot } from "./searchMethodSnapshot.js";

const requestedSchema = searchInputToolSchema.omit({
  session_id: true,
  force_refresh: true
}).partial();

function safeContext(value: unknown): SearchContext | null {
  const parsed = searchContextSchema.safeParse(value);
  if (!parsed.success)
    return null;
  return {
    ...parsed.data,
    sources: parsed.data.sources.map(source => ({
      ...source,
      request: source.request ? {
        ...source.request,
        parameters: Object.fromEntries(Object.entries(source.request.parameters).filter(([key]) => (SEARCH_PARAMETER_KEYS[source.request!.api_kind] as readonly string[]).includes(key)))
      } : null
    }))
  };
}

const limitations = [
  "記録単位は検索条件ごとに保存された最新entry。全tool実行回数・全実行履歴は保証しない。",
  "横断検索のtotalはsource別totalの合算。同じ文献が複数sourceに収録されるため、一意文献数とは区別する。",
  "旧cacheの取得時contextは未記録。cache_snapshotは当該session利用時との同一性未保証。取得日時は実行日時の代用にしない。",
  "上流失敗の記録は保存済み応答に含まれる範囲。全source失敗など保存に至らない実行は記録されない。",
  "書誌検索の取得範囲と本文確認・全件収集を区別する。agent_annotationsはagentの申告であり機械観測の代用にしない。"
];
type MethodSnapshot = Omit<SearchMethodSnapshot, "observed_at" | "cache_hit"> & {
  observed_at: string | null;
  cache_hit: boolean | null;
};

export interface SearchMethodsManifest {
  schema_version: 1;
  session_id: string;
  exported_at: string;
  research_goal?: string;
  scope_note?: string;
  record_basis: "latest_saved_entry_per_query";
  search_count: number;
  methods: Array<{
    tool: "jp_lit_search";
    cache_key: string;
    requested: Record<string, unknown>;
    query: string | null;
    query_script: ReturnType<typeof detectQueryScript> | null;
    evidence_origin: "session_snapshot" | "cache_snapshot" | "input_only";
    snapshot: MethodSnapshot | null;
    sources: SearchContext["sources"];
  }>;
  agent_annotations: {
    source_plans: Array<{
      source: string;
      status: string;
      reason: string;
      expected_contribution?: string;
    }>;
    entries: Array<{
      tool: string;
      cache_key: string;
      search_attempt?: NonNullable<NonNullable<SessionDocument["entries"][number]["trace"]>["search_attempt"]>;
      evidence_scope: Array<{
        target: {
          source?: string;
          source_id?: string;
          title?: string;
        };
        checked: string;
        body_status: string;
        note?: string;
      }>;
    }>;
  };
  exclusions: Array<{
    tool: string;
    entry_count: number;
  }>;
  limitations: string[];
}

export function buildSearchMethodsManifest(session: SessionDocument, cacheByKey: ReadonlyMap<string, CacheEnvelope<unknown> | null>, exportedAt: string): SearchMethodsManifest {
  const methods: SearchMethodsManifest["methods"] = [];
  const excluded = new Map<string, number>();
  for (const entry of session.entries) {
    if (entry.tool !== "jp_lit_search") {
      excluded.set(entry.tool, (excluded.get(entry.tool) ?? 0) + 1);
      continue;
    }
    const input = requestedSchema.safeParse(entry.input);
    const requested: Record<string, unknown> = input.success ? input.data : {};
    const query = typeof requested.query === "string" ? requested.query : null;
    let snapshot: MethodSnapshot | null = null;
    let origin: SearchMethodsManifest["methods"][number]["evidence_origin"] = "input_only";
    if (entry.method_snapshot) {
      const saved = entry.method_snapshot;
      snapshot = {
        schema_version: 1,
        observed_at: saved.observed_at,
        result_saved_at: saved.result_saved_at,
        cache_hit: saved.cache_hit,
        total: saved.total,
        returned_count: saved.returned_count,
        context: safeContext(saved.context)
      };
      origin = "session_snapshot";
    }
    else {
      const cache = cacheByKey.get(`${entry.tool}/${entry.cache_key}`);
      const content = cache?.structured_content as {
        total?: unknown;
        items?: unknown;
        search_context?: unknown;
      } | undefined;
      if (cache && typeof content?.total === "number" && Number.isFinite(content.total) && Array.isArray(content.items)) {
        snapshot = {
          schema_version: 1,
          observed_at: null,
          result_saved_at: cache.saved_at,
          cache_hit: null,
          total: content.total,
          returned_count: content.items.length,
          context: safeContext(content.search_context)
        };
        origin = "cache_snapshot";
      }
    }
    methods.push({
      tool: "jp_lit_search",
      cache_key: entry.cache_key,
      requested,
      query,
      query_script: query === null ? null : detectQueryScript(query),
      evidence_origin: origin,
      snapshot,
      sources: snapshot?.context?.sources ?? []
    });
  }
  return {
    schema_version: 1,
    session_id: session.session_id,
    exported_at: exportedAt,
    ...(session.trace?.research_goal !== undefined ? {
      research_goal: session.trace.research_goal
    } : {}),
    ...(session.trace?.scope_note !== undefined ? {
      scope_note: session.trace.scope_note
    } : {}),
    record_basis: "latest_saved_entry_per_query",
    search_count: methods.length,
    methods,
    agent_annotations: {
      source_plans: (session.trace?.source_plans ?? []).map(({ source, status, reason, expected_contribution }) => ({
        source,
        status,
        reason,
        ...(expected_contribution !== undefined ? {
          expected_contribution
        } : {})
      })),
      entries: session.entries.filter(entry => entry.trace?.search_attempt || entry.trace?.evidence_scope?.length).map(entry => ({
        tool: entry.tool,
        cache_key: entry.cache_key,
        ...(entry.trace?.search_attempt ? {
          search_attempt: (({ source, query, purpose, total, returned_count, extracted_count, outcome, next_step }) => ({
            source,
            query,
            purpose,
            total,
            returned_count,
            extracted_count,
            outcome,
            ...(next_step !== undefined ? {
              next_step
            } : {})
          }))(entry.trace.search_attempt)
        } : {}),
        evidence_scope: (entry.trace?.evidence_scope ?? []).map(({ target, checked, body_status, note }) => ({
          target: {
            source: target.source,
            source_id: target.source_id,
            title: target.title
          },
          checked,
          body_status,
          ...(note !== undefined ? {
            note
          } : {})
        }))
      }))
    },
    exclusions: [...excluded].map(([tool, entry_count]) => ({
      tool,
      entry_count
    })),
    limitations: [...limitations]
  };
}
/** 可変長fenceで検索語・申告中のMarkdown制御文字をそのまま表示する。 */

function block(value: string, language = "text"): string {
  const longest = Math.max(0, ...(value.match(/`+/g) ?? []).map(run => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${value}\n${fence}`;
}

export function renderSearchMethodsMarkdown(manifest: SearchMethodsManifest): string {
  const lines = ["# 調査方法", "", "## 調査目的", "", block(manifest.research_goal ?? "未記録"), "", block(manifest.scope_note ?? "対象範囲未記録"), "", "## 保存された検索方法", "", `保存検索数: ${manifest.search_count}（検索条件ごとの最新entry）`, ""];
  manifest.methods.forEach((method, index) => {
    lines.push(`### 検索 ${index + 1}`, "", block(method.query ?? "検索語未記録"), "", block(JSON.stringify({
      requested: method.requested,
      evidence_origin: method.evidence_origin,
      snapshot: method.snapshot
    }, null, 2), "json"), "");
    if (!method.snapshot)
      lines.push("取得時情報未記録。", "");
    if (method.evidence_origin === "cache_snapshot")
      lines.push("現在のcache情報: 当該session利用時との同一性未保証。", "");
  });
  lines.push("## sourceごとの条件・取得範囲", "", block(JSON.stringify(manifest.methods.map((method, index) => ({
    search: index + 1,
    sources: method.sources
  })), null, 2), "json"), "", "## agentが記録した判断", "", "以下はagentの申告。機械観測とは区別する。", "", block(JSON.stringify(manifest.agent_annotations, null, 2), "json"), "", "## 確認範囲", "", block(JSON.stringify(manifest.exclusions, null, 2), "json"), "", ...manifest.limitations.map(note => `- ${note}`), "");
  return lines.join("\n");
}
