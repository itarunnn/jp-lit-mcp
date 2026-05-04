import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import {
  authorityTermsByClassificationInputSchema,
  authorityTermsByClassificationOutputSchema
} from "../lib/schemas.js";
import type { AuthorityTermsByClassificationOutput } from "../lib/schemas.js";
import type { NdlAuthoritiesClient } from "../sources/ndlAuthorities/client.js";

export function createJpLitFindAuthorityTermsByClassificationTool(
  client: Pick<NdlAuthoritiesClient, "findTermsByClassification">,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = authorityTermsByClassificationInputSchema.parse(input);
    const { structuredContent } = await runCachedTool<AuthorityTermsByClassificationOutput>({
      tool: "jp_lit_find_authority_terms_by_classification",
      input: parsed as Record<string, unknown>,
      cache,
      sessions,
      live: async () =>
        authorityTermsByClassificationOutputSchema.parse(
          await client.findTermsByClassification(parsed)
        )
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
