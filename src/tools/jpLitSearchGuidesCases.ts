import {
  guidesCasesInputSchema,
  guidesCasesOutputSchema
} from "../lib/schemas.js";
import type { GuidesCasesOutput } from "../lib/schemas.js";
import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import type { CrdClient } from "../sources/crd/client.js";

export function createJpLitSearchGuidesCasesTool(
  crdClient: CrdClient,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = guidesCasesInputSchema.parse(input);

    const { structuredContent } = await runCachedTool<GuidesCasesOutput>({
      tool: "jp_lit_search_guides_cases",
      input: parsed as Record<string, unknown>,
      cache,
      sessions,
      live: async () =>
        guidesCasesOutputSchema.parse(
          await crdClient.searchCases({
            query: parsed.query,
            limit: parsed.limit,
            page: parsed.page,
            lib_id: parsed.lib_id,
            lib_group: parsed.lib_group
          })
        )
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
