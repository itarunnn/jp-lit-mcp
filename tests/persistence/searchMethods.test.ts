import { expect, it } from "vitest";
import { buildSearchMethodsManifest, renderSearchMethodsMarkdown } from "../../src/lib/persistence/searchMethods.js";
import type { SessionDocument, CacheEnvelope } from "../../src/lib/persistence/types.js";

const at = "2026-10-03T00:00:00.000Z";

function session(): SessionDocument { return {
  session_id: "session",
  created_at: at,
  updated_at: at,
  trace: {
    research_goal: "目的",
    source_plans: [],
    open_questions: [],
    next_actions: []
  },
  entries: [{
      tool: "jp_lit_search",
      cache_key: "key",
      result_ref: {
        tool: "jp_lit_search",
        cache_key: "key"
      },
      input: {
        query: 'abc\n```\n# injected | "x"',
        token: "PRIVATE_SENTINEL",
        filters: {
          ndl: {
            ndc: "9",
            token: "PRIVATE_SENTINEL"
          }
        }
      },
      selected_items: [],
      notes: []
    }]
}; }
it("uses per-session snapshot after cache deletion", () => {
  const s = session();
  s.entries[0]!.method_snapshot = {
    schema_version: 1,
    observed_at: at,
    result_saved_at: at,
    cache_hit: true,
    total: 12,
    returned_count: 3,
    context: null
  };
  const manifest = buildSearchMethodsManifest(s, new Map(), at);
  expect(manifest.methods[0]).toMatchObject({
    evidence_origin: "session_snapshot",
    snapshot: {
      total: 12,
      returned_count: 3
    }
  });
  expect(manifest.search_count).toBe(1);
});
it("marks current legacy cache without inventing acquisition facts", () => {
  const s = session();
  const cache: CacheEnvelope<unknown> = {
    version: 1,
    tool: "jp_lit_search",
    cache_key: "key",
    saved_at: at,
    input: {},
    structured_content: {
      total: 7,
      items: [{
          title: "PRIVATE_SENTINEL"
        }]
    }
  };
  const manifest = buildSearchMethodsManifest(s, new Map([["jp_lit_search/key", cache]]), at);
  expect(manifest.methods[0]).toMatchObject({
    evidence_origin: "cache_snapshot",
    snapshot: {
      result_saved_at: at,
      observed_at: null,
      cache_hit: null,
      context: null,
      total: 7,
      returned_count: 1
    }
  });
  expect(renderSearchMethodsMarkdown(manifest)).toContain("当該session利用時との同一性未保証");
  expect(JSON.stringify(manifest)).not.toContain("PRIVATE_SENTINEL");
});
it("counts only saved searches and separates exclusions and agent declarations", () => {
  const s = session();
  s.entries.push({
    ...s.entries[0]!,
    tool: "jp_lit_search_fulltext"
  });
  s.entries[0]!.trace = {
    decisions: [],
    evidence_scope: [],
    search_attempt: {
      source: null,
      query: "x",
      purpose: "p",
      total: 900,
      returned_count: 900,
      extracted_count: 0,
      outcome: "useful"
    }
  };
  const manifest = buildSearchMethodsManifest(s, new Map(), at);
  expect(manifest.record_basis).toBe("latest_saved_entry_per_query");
  expect(manifest.search_count).toBe(1);
  expect(manifest.exclusions).toEqual([{
      tool: "jp_lit_search_fulltext",
      entry_count: 1
    }]);
  expect(manifest.methods[0]).toMatchObject({
    evidence_origin: "input_only",
    snapshot: null
  });
  expect(manifest.agent_annotations.entries[0]?.search_attempt?.total).toBe(900);
});
it("redacts unknown nested input and safely fences control characters deterministically", () => {
  const manifest = buildSearchMethodsManifest(session(), new Map(), at);
  expect(JSON.stringify(manifest)).not.toContain("PRIVATE_SENTINEL");
  expect(manifest.methods[0]?.requested).toEqual({
    query: 'abc\n```\n# injected | "x"',
    filters: {
      ndl: {
        ndc: "9"
      }
    }
  });
  const md = renderSearchMethodsMarkdown(manifest);
  expect(md).toContain('abc\n```\n# injected | "x"');
  expect(md).toContain("````text");
  expect(renderSearchMethodsMarkdown(buildSearchMethodsManifest(session(), new Map(), at))).toBe(md);
});
