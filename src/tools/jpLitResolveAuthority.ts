import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import {
  resolveAuthorityInputSchema,
  resolveAuthorityOutputSchema
} from "../lib/schemas.js";
import type { ResolveAuthorityOutput } from "../lib/schemas.js";
import type { NdlAuthoritiesClient } from "../sources/ndlAuthorities/client.js";

export function createJpLitResolveAuthorityTool(
  client: NdlAuthoritiesClient,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = resolveAuthorityInputSchema.parse(input);
    const { structuredContent } = await runCachedTool<ResolveAuthorityOutput>({
      tool: "jp_lit_resolve_authority",
      input: parsed as Record<string, unknown>,
      cache,
      sessions,
      live: async () => resolveAuthorityOutputSchema.parse(await client.resolve(parsed))
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
