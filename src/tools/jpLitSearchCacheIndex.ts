import { readdir } from "node:fs/promises";
import path from "node:path";

import { getCacheRoot, getLegacyCacheRoot } from "../lib/persistence/paths.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { resolveSavedDateFilter } from "../lib/savedDateFilter.js";
import {
  searchCacheIndexInputSchema,
  searchCacheIndexOutputSchema
} from "../lib/schemas.js";
import type {
  SearchCacheIndexOutput,
  SearchOutput
} from "../lib/schemas.js";

type SearchItem = SearchOutput["items"][number];
type MatchedField = "query" | "title" | "author" | "subject" | "source_id";

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
    const cacheToSessionIds = new Map<string, Set<string>>();

    for (const session of allSessions) {
      for (const entry of session.entries) {
        if (entry.tool !== "jp_lit_search") {
          continue;
        }
        const set = cacheToSessionIds.get(entry.cache_key) ?? new Set<string>();
        set.add(session.session_id);
        cacheToSessionIds.set(entry.cache_key, set);
      }
    }

    const searchCacheDirs = [
      path.join(getCacheRoot(baseDir), "jp_lit_search"),
      path.join(getLegacyCacheRoot(baseDir), "jp_lit_search")
    ];
    const cacheKeys = Array.from(
      new Set(
        (
          await Promise.all(
            searchCacheDirs.map(async (directory) => {
              try {
                return await readdir(directory);
              } catch {
                return [] as string[];
              }
            })
          )
        )
          .flat()
          .filter((filename) => filename.endsWith(".json"))
          .map((filename) => filename.replace(/\.json$/i, ""))
      )
    );

    const results: SearchCacheIndexOutput["items"] = [];
    for (const cacheKey of cacheKeys) {
      if (!cacheToSessionIds.has(cacheKey)) {
        continue;
      }
      const cached = await cache.read<SearchOutput>("jp_lit_search", cacheKey);
      if (!cached) {
        continue;
      }

      const output = cached.structured_content;
      if (effectiveSavedFrom && cached.saved_at < effectiveSavedFrom) {
        continue;
      }
      if (effectiveSavedTo && cached.saved_at > effectiveSavedTo) {
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

      const sessionIds = Array.from(cacheToSessionIds.get(cacheKey) ?? []).filter((sessionId) =>
        targetSessionIds ? targetSessionIds.has(sessionId) : true
      );
      if (sessionIds.length === 0) {
        continue;
      }

      results.push({
        cache_key: cacheKey,
        session_ids: sessionIds,
        saved_at: cached.saved_at,
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
      cache_keys: limited.map((item) => item.cache_key),
      items: limited
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
