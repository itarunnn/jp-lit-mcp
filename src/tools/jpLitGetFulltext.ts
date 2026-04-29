import type { createRecordService } from "../services/recordService.js";
import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import {
  fulltextInputSchema,
  fulltextOutputSchema
} from "../lib/schemas.js";
import type { FulltextOutput } from "../lib/schemas.js";
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

export function createJpLitGetFulltextTool(
  recordService: RecordService,
  nextDlClient: NextDigitalLibraryClient,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = fulltextInputSchema.parse(input);

    if (parsed.source !== "ndl_digital") {
      throw new InvalidRequestError(
        `jp_lit_get_fulltext は source=ndl_digital のみ対応しています: ${parsed.source}`
      );
    }

    const pid = await resolvePid(parsed, recordService);
    const { structuredContent } = await runCachedTool<FulltextOutput>({
      tool: "jp_lit_get_fulltext",
      input: { ...(parsed as Record<string, unknown>), pid },
      cache,
      sessions,
      live: async () => {
        const fulltextData = await nextDlClient.getFulltextJson(pid);

        if (!fulltextData) {
          throw new NotFoundError(`全文データが見つかりません: pid=${pid}`);
        }

        // 次世代 API は { list: [...], hit: N, from: N } 形式で返す。
        // 将来の仕様変更に備えて pages フィールドも fallback として受け入れる。
        const pages = (fulltextData.list ?? fulltextData.pages ?? null) as unknown;

        return fulltextOutputSchema.parse({
          pid,
          pages,
          raw: fulltextData
        });
      }
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
