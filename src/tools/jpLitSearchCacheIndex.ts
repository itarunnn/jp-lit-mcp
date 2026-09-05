import { readCandidateResult } from "../lib/candidateResultAdapters.js";
import {
  CANDIDATE_RESULT_TOOLS,
  isCandidateResultTool
} from "../lib/candidateResults.js";
import type {
  CandidateResultRef,
  CandidateResultTool
} from "../lib/candidateResults.js";
import { listCacheInventory } from "../lib/persistence/cacheInventory.js";
import type { CacheInventoryItem } from "../lib/persistence/cacheInventory.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { resolveSavedDateFilter } from "../lib/savedDateFilter.js";
import {
  searchCacheIndexInputSchema,
  searchCacheIndexOutputSchema
} from "../lib/schemas.js";
import type { SearchCacheIndexOutput } from "../lib/schemas.js";
import type { SearchItem } from "../lib/types.js";

type MatchedField = "query" | "title" | "author" | "subject" | "source_id";

function candidateIdentity(tool: CandidateResultTool, cacheKey: string) {
  return `${tool}:${cacheKey}`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/\s+/g, " ")
    .trim();
}

function createPreview(value: string | null | undefined, maxLength = 120) {
  if (!value) {
    return null;
  }
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
}

function matchItems(
  items: SearchItem[],
  normalizedQuery: string
): Set<MatchedField> {
  const matched = new Set<MatchedField>();
  for (const item of items) {
    if (normalizeText(item.title).includes(normalizedQuery)) {
      matched.add("title");
    }
    if (item.authors.some((author) => normalizeText(author.name).includes(normalizedQuery))) {
      matched.add("author");
    }
    if (item.subjects.some((subject) => normalizeText(subject).includes(normalizedQuery))) {
      matched.add("subject");
    }
    if (normalizeText(item.source_id).includes(normalizedQuery)) {
      matched.add("source_id");
    }
  }
  return matched;
}

export function createJpLitSearchCacheIndexTool(
  cache: FileCache,
  sessions: SessionStore,
  baseDir = process.cwd()
) {
  return async (input: unknown) => {
    const parsed = searchCacheIndexInputSchema.parse(input);
    const normalizedQuery = normalizeText(parsed.query);
    const { effectiveSavedFrom, effectiveSavedTo, resolvedSavedOn } =
      resolveSavedDateFilter(parsed);
    const targetSessionIds = parsed.session_id ? new Set([parsed.session_id]) : null;
    const allSessions = parsed.session_id
      ? [await sessions.readById(parsed.session_id)]
      : await sessions.listAll();
    const candidateToSessionIds = new Map<string, Set<string>>();

    for (const session of allSessions) {
      for (const entry of session.entries) {
        if (!isCandidateResultTool(entry.tool)) {
          continue;
        }
        const identity = candidateIdentity(entry.tool, entry.cache_key);
        const set = candidateToSessionIds.get(identity) ?? new Set<string>();
        set.add(session.session_id);
        candidateToSessionIds.set(identity, set);
      }
    }

    const inventories = await Promise.all(
      CANDIDATE_RESULT_TOOLS.map((tool) => listCacheInventory(baseDir, tool))
    );
    const inventoryByIdentity = new Map<string, CacheInventoryItem>();
    for (const item of inventories.flatMap((inventory) => inventory.items)) {
      if (!isCandidateResultTool(item.tool)) {
        continue;
      }
      const identity = candidateIdentity(item.tool, item.cache_key);
      const existing = inventoryByIdentity.get(identity);
      if (!existing || (existing.root === "legacy" && item.root === "current")) {
        inventoryByIdentity.set(identity, item);
      }
    }

    const results: SearchCacheIndexOutput["items"] = [];
    for (const inventoryItem of inventoryByIdentity.values()) {
      if (!isCandidateResultTool(inventoryItem.tool)) {
        continue;
      }
      const identity = candidateIdentity(
        inventoryItem.tool,
        inventoryItem.cache_key
      );
      if (!candidateToSessionIds.has(identity)) {
        continue;
      }
      const resultRef: CandidateResultRef = {
        tool: inventoryItem.tool,
        cache_key: inventoryItem.cache_key
      };
      const output = await readCandidateResult(cache, resultRef);

      if (effectiveSavedFrom && inventoryItem.saved_at < effectiveSavedFrom) {
        continue;
      }
      if (effectiveSavedTo && inventoryItem.saved_at > effectiveSavedTo) {
        continue;
      }
      if (parsed.source && output.source !== parsed.source) {
        continue;
      }

      const items = output.items;
      if (parsed.issued_from || parsed.issued_to) {
        const hasInRange = items.some((item) => {
          if (!item.issued_at) {
            return false;
          }
          if (parsed.issued_from && item.issued_at < parsed.issued_from) {
            return false;
          }
          if (parsed.issued_to && item.issued_at > parsed.issued_to) {
            return false;
          }
          return true;
        });
        if (!hasInRange) {
          continue;
        }
      }

      const matchedFields = new Set<MatchedField>();
      if (typeof output.query === "string" && normalizeText(output.query).includes(normalizedQuery)) {
        matchedFields.add("query");
      }
      const itemMatched = matchItems(items, normalizedQuery);
      for (const field of itemMatched) {
        matchedFields.add(field);
      }
      if (matchedFields.size === 0) {
        continue;
      }

      const sessionIds = Array.from(
        candidateToSessionIds.get(identity) ?? []
      ).filter((sessionId) =>
        targetSessionIds ? targetSessionIds.has(sessionId) : true
      );
      if (sessionIds.length === 0) {
        continue;
      }

      results.push({
        tool: inventoryItem.tool,
        result_ref: resultRef,
        cache_key: inventoryItem.cache_key,
        session_ids: sessionIds,
        saved_at: inventoryItem.saved_at,
        source: output.source,
        query_preview: createPreview(output.query),
        total: output.total,
        item_count: output.items.length,
        matched_fields: Array.from(matchedFields)
      });
    }

    results.sort((left, right) => right.saved_at.localeCompare(left.saved_at));
    const limited = results.slice(0, parsed.limit);

    const structuredContent: SearchCacheIndexOutput = searchCacheIndexOutputSchema.parse({
      query: parsed.query,
      session_id: parsed.session_id ?? null,
      source: parsed.source ?? null,
      issued_from: parsed.issued_from ?? null,
      issued_to: parsed.issued_to ?? null,
      saved_on: parsed.saved_on ?? null,
      saved_on_resolved: resolvedSavedOn,
      saved_from: parsed.saved_from ?? null,
      saved_to: parsed.saved_to ?? null,
      total: results.length,
      limit: parsed.limit,
      result_refs: limited.map(({ tool, cache_key }) => ({ tool, cache_key })),
      cache_keys: limited.map((item) => item.cache_key),
      items: limited.map((item) => ({
        tool: item.tool,
        result_ref: item.result_ref,
        cache_key: item.cache_key,
        session_ids: item.session_ids,
        saved_at: item.saved_at,
        source: item.source,
        query_preview: item.query_preview,
        total: item.total,
        item_count: item.item_count,
        matched_fields: item.matched_fields
      }))
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(structuredContent, null, 2)
        }
      ],
      structuredContent
    };
  };
}
