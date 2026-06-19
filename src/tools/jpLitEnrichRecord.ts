import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { withToolCache } from "../lib/toolCache.js";
import {
  enrichRecordInputSchema,
  enrichRecordOutputSchema
} from "../lib/schemas.js";
import type {
  EnrichRecordInput,
  EnrichRecordOutput
} from "../lib/schemas.js";
import { normalizeDoi } from "../sources/externalWork/matching.js";
import type { ExternalWorkEnricher } from "../sources/externalWork/enrichRecord.js";

type EnrichRecordService = Pick<ExternalWorkEnricher, "enrich">;

interface EnrichRecordToolOptions {
  openalexKeyPresent?: boolean;
}

function normalizeCacheableInput(input: Omit<EnrichRecordInput, "force_refresh">) {
  return {
    doi: normalizeDoi(input.doi) ?? null,
    title: input.title?.trim() || null,
    authors: input.authors.map((author) => author.trim()).filter(Boolean),
    issued_year: input.issued_year?.trim() || null,
    providers: input.providers
  };
}

function addProviderCacheScope(
  input: ReturnType<typeof normalizeCacheableInput>,
  options: EnrichRecordToolOptions
) {
  const cacheInput: Record<string, unknown> = { ...input };
  if (input.providers.includes("openalex")) {
    cacheInput.openalex_key_present = Boolean(options.openalexKeyPresent);
  }
  return cacheInput;
}

export function createJpLitEnrichRecordTool(
  service: EnrichRecordService,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore(),
  options: EnrichRecordToolOptions = {}
) {
  return async (input: unknown) => {
    const parsed = enrichRecordInputSchema.parse(input);
    const { force_refresh, ...rawCacheableInput } = parsed;
    const cacheableInput = normalizeCacheableInput(rawCacheableInput);
    const cacheInput = addProviderCacheScope(cacheableInput, options);
    const result = await runCachedTool<EnrichRecordOutput>({
      tool: "jp_lit_enrich_record",
      input: cacheInput,
      cache,
      sessions,
      bypassCache: force_refresh,
      live: async () => enrichRecordOutputSchema.parse(await service.enrich(cacheableInput))
    });
    const structuredContent = enrichRecordOutputSchema.parse(
      withToolCache(result.structuredContent as Record<string, unknown>, result)
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
