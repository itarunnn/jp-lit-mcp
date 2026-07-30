import { InvalidSourceIdError, NotFoundError } from "../lib/errors.js";
import {
  UnsupportedPayloadError,
  UpstreamHttpError,
  UpstreamTimeoutError
} from "../lib/http.js";
import { createFileCache } from "../lib/persistence/fileCache.js";
import type { FileCache } from "../lib/persistence/fileCache.js";
import { createSessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import {
  recordsInputSchema,
  recordsOutputSchema
} from "../lib/schemas.js";
import type { RecordBatchErrorCategory } from "../lib/schemas.js";
import type { createRecordService } from "../services/recordService.js";
import { createCachedRecordLookup } from "./jpLitGetRecord.js";

type RecordService = ReturnType<typeof createRecordService>;

const RECORD_BATCH_CONCURRENCY = 2;

function toBatchRecordError(
  error: unknown
): {
  category: RecordBatchErrorCategory;
  message: string;
} {
  if (error instanceof NotFoundError) {
    return {
      category: "not_found",
      message: "該当レコードが見つかりませんでした。"
    };
  }
  if (error instanceof InvalidSourceIdError) {
    return {
      category: "invalid_request",
      message: "source_id をこの source の詳細取得に利用できません。"
    };
  }
  if (error instanceof UpstreamTimeoutError) {
    return {
      category: "timeout",
      message: "上流 source の応答がタイムアウトしました。"
    };
  }
  if (error instanceof UpstreamHttpError) {
    return {
      category: "http",
      message: "上流 source へのリクエストに失敗しました。"
    };
  }
  if (error instanceof UnsupportedPayloadError) {
    return {
      category: "invalid_payload",
      message: "上流 source の応答形式を処理できませんでした。"
    };
  }
  return {
    category: "unknown",
    message: "レコード詳細の取得中に予期しないエラーが発生しました。"
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index]!;
      results[index] = await worker(value);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      () => runWorker()
    )
  );
  return results;
}

export function createJpLitGetRecordsTool(
  recordService: RecordService,
  cache: FileCache = createFileCache(),
  sessions: SessionStore = createSessionStore()
) {
  const lookup = createCachedRecordLookup(recordService, cache, sessions);

  return async (input: unknown) => {
    const parsed = recordsInputSchema.parse(input);
    const sourceIds = Array.from(new Set(parsed.source_ids));
    const items = await mapWithConcurrency(
      sourceIds,
      RECORD_BATCH_CONCURRENCY,
      async (sourceId) => {
        try {
          const record = await lookup({
            source: parsed.source,
            source_id: sourceId,
            force_refresh: parsed.force_refresh
          });
          return {
            source_id: sourceId,
            status: "ok" as const,
            record
          };
        } catch (error) {
          return {
            source_id: sourceId,
            status: "error" as const,
            error: toBatchRecordError(error)
          };
        }
      }
    );
    const successCount = items.filter((item) => item.status === "ok").length;
    const structuredContent = recordsOutputSchema.parse({
      source: parsed.source,
      requested_count: parsed.source_ids.length,
      unique_count: sourceIds.length,
      success_count: successCount,
      error_count: items.length - successCount,
      items
    });

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
