import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { withToolCache } from "../lib/toolCache.js";
import {
  suggestClassificationCodesInputSchema,
  suggestClassificationCodesOutputSchema
} from "../lib/schemas.js";
import type { SuggestClassificationCodesOutput } from "../lib/schemas.js";
import type { NdlAuthoritiesClient } from "../sources/ndlAuthorities/client.js";

export function createJpLitSuggestClassificationCodesTool(
  client: Pick<NdlAuthoritiesClient, "suggestClassificationCodes">,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = suggestClassificationCodesInputSchema.parse(input);
    const { force_refresh, ...cacheableInput } = parsed;
    const result = await runCachedTool<SuggestClassificationCodesOutput>({
      tool: "jp_lit_suggest_classification_codes",
      input: cacheableInput as Record<string, unknown>,
      cache,
      sessions,
      bypassCache: force_refresh,
      live: async () =>
        suggestClassificationCodesOutputSchema.parse(
          await client.suggestClassificationCodes(cacheableInput)
        )
    });
    const structuredContent = suggestClassificationCodesOutputSchema.parse(
      withToolCache(result.structuredContent as Record<string, unknown>, result)
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
