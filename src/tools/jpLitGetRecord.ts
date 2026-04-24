import type { createRecordService } from "../services/recordService.js";
import { recordInputSchema } from "../lib/schemas.js";

type RecordService = ReturnType<typeof createRecordService>;

export function createJpLitGetRecordTool(recordService: RecordService) {
  return async (input: unknown) => {
    const parsed = recordInputSchema.parse(input);
    const result = await recordService.getRecord({
      source: parsed.source,
      sourceId: parsed.source_id
    });
    const structuredContent = result as unknown as Record<string, unknown>;

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
