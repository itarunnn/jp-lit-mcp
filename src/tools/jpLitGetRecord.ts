import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import { withToolCache } from "../lib/toolCache.js";
import { recordInputSchema, recordOutputSchema } from "../lib/schemas.js";
import type { RecordOutput } from "../lib/schemas.js";
import type { createRecordService } from "../services/recordService.js";

type RecordService = ReturnType<typeof createRecordService>;

export function createJpLitGetRecordTool(
  recordService: RecordService,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = recordInputSchema.parse(input);
    const { force_refresh, ...cacheableInput } = parsed;
    const result = await runCachedTool<RecordOutput>({
      tool: "jp_lit_get_record",
      input: cacheableInput as unknown as Record<string, unknown>,
      cache,
      sessions,
      bypassCache: force_refresh,
      live: async () => {
        const result = await recordService.getRecord({
          source: parsed.source,
          sourceId: parsed.source_id
        });

        return recordOutputSchema.parse(result);
      }
    });
    const structuredContent = recordOutputSchema.parse(
      withToolCache(result.structuredContent as Record<string, unknown>, result)
    );

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
