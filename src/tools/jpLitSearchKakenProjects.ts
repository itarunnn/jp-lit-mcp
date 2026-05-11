import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { withToolCache } from "../lib/toolCache.js";
import {
  searchKakenProjectsInputSchema,
  searchKakenProjectsOutputSchema
} from "../lib/schemas.js";
import type { SearchKakenProjectsOutput } from "../lib/schemas.js";
import type { KakenClient } from "../sources/kaken/client.js";

export function createJpLitSearchKakenProjectsTool(
  client: KakenClient,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = searchKakenProjectsInputSchema.parse(input);
    const { force_refresh, ...cacheableInput } = parsed;
    const result = await runCachedTool<SearchKakenProjectsOutput>({
      tool: "jp_lit_search_kaken_projects",
      input: cacheableInput as Record<string, unknown>,
      cache,
      sessions,
      bypassCache: force_refresh,
      live: async () => searchKakenProjectsOutputSchema.parse(await client.searchProjects(cacheableInput))
    });
    const structuredContent = searchKakenProjectsOutputSchema.parse(
      withToolCache(result.structuredContent as Record<string, unknown>, result)
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
