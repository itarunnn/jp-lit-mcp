import {
  guidesManualsInputSchema,
  guidesManualsOutputSchema
} from "../lib/schemas.js";
import type { GuidesManualsOutput } from "../lib/schemas.js";
import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import type { CrdClient } from "../sources/crd/client.js";

export function createJpLitSearchGuidesManualsTool(
  crdClient: CrdClient,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = guidesManualsInputSchema.parse(input);

    const { structuredContent } = await runCachedTool<GuidesManualsOutput>({
      tool: "jp_lit_search_guides_manuals",
      input: parsed as Record<string, unknown>,
      cache,
      sessions,
      live: async () =>
        guidesManualsOutputSchema.parse(
          await crdClient.searchManuals({
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
