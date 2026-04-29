import type { createRecordService } from "../services/recordService.js";
import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { runCachedTool } from "../lib/persistence/runCachedTool.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import {
  textCoordinatesInputSchema,
  textCoordinatesOutputSchema
} from "../lib/schemas.js";
import type { TextCoordinatesOutput } from "../lib/schemas.js";
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

export function createJpLitGetTextCoordinatesTool(
  recordService: RecordService,
  nextDlClient: NextDigitalLibraryClient,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  return async (input: unknown) => {
    const parsed = textCoordinatesInputSchema.parse(input);

    if (parsed.source !== "ndl_digital") {
      throw new InvalidRequestError(
        `jp_lit_get_text_coordinates は source=ndl_digital のみ対応しています: ${parsed.source}`
      );
    }

    const pid = await resolvePid(parsed, recordService);
    const { structuredContent } = await runCachedTool<TextCoordinatesOutput>({
      tool: "jp_lit_get_text_coordinates",
      input: { ...(parsed as Record<string, unknown>), pid },
      cache,
      sessions,
      live: async () => {
        const pageData = await nextDlClient.getPage(pid, parsed.page);

        if (!pageData) {
          throw new NotFoundError(`ページが見つかりません: pid=${pid}, page=${parsed.page}`);
        }

        const paddedPage = String(parsed.page).padStart(7, "0");
        const pageImageUrl = `https://dl.ndl.go.jp/api/iiif/${pid}/R${paddedPage}/full/full/0/default.jpg`;

        return textCoordinatesOutputSchema.parse({
          pid,
          page: parsed.page,
          page_image_url: pageImageUrl,
          contents: pageData.contents ?? null,
          coordjson: pageData.coordjson ?? null,
          raw: pageData
        });
      }
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
