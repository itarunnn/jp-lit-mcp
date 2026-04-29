import type { createRecordService } from "../services/recordService.js";
import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import {
  searchPagesInputSchema,
  searchPagesOutputSchema
} from "../lib/schemas.js";
import type { SearchPagesOutput } from "../lib/schemas.js";
import { InvalidRequestError, NotFoundError } from "../lib/errors.js";
import { validateNdlPid } from "../lib/sourceId.js";
import type {
  NextDigitalLibraryBridgeInfo,
  NextDigitalLibraryClient
} from "../sources/nextDigitalLibrary/adapter.js";

type RecordService = ReturnType<typeof createRecordService>;

async function resolvePid(
  parsed: { source: string; source_id?: string; pid?: string },
  recordService: RecordService
): Promise<string> {
  if (parsed.pid) return validateNdlPid(parsed.pid);

  const record = await recordService.getRecord({
    source: parsed.source as "ndl_digital",
    sourceId: parsed.source_id!
  });
  const nextDl = record.source_metadata.next_digital_library as NextDigitalLibraryBridgeInfo | null;

  if (!nextDl?.pid) {
    throw new NotFoundError(`PID を解決できませんでした: ${parsed.source_id}`);
  }

  return validateNdlPid(nextDl.pid);
}

export function createJpLitSearchPagesTool(
  recordService: RecordService,
  nextDlClient: NextDigitalLibraryClient,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = searchPagesInputSchema.parse(input);

    if (parsed.source !== "ndl_digital") {
      throw new InvalidRequestError(
        `jp_lit_search_pages は source=ndl_digital のみ対応しています: ${parsed.source}`
      );
    }

    const pid = await resolvePid(parsed, recordService);
    const { structuredContent } = await runCachedTool<SearchPagesOutput>({
      tool: "jp_lit_search_pages",
      input: { ...(parsed as Record<string, unknown>), pid },
      cache,
      sessions,
      live: async () => {
        const searchResult = await nextDlClient.searchPages(pid, parsed.keyword, {
          size: parsed.size,
          from: parsed.from
        });

        if (!searchResult) {
          throw new NotFoundError(`資料が見つかりません: pid=${pid}`);
        }

        const items = (searchResult.list ?? searchResult.results ?? null) as unknown;
        const total = (searchResult.hit ?? searchResult.total ?? 0) as number;

        return searchPagesOutputSchema.parse({
          pid,
          keyword: parsed.keyword,
          total,
          from: parsed.from,
          items,
          raw: searchResult
        });
      }
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
