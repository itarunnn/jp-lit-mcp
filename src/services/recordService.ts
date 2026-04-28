import { validateSourceId } from "../lib/sourceId.js";
import type { SourceName } from "../lib/types.js";
import type { SourceAdapter } from "../sources/types.js";
import { NotFoundError } from "../lib/errors.js";
import { createSourceRegistry } from "./sourceRegistry.js";

interface RecordInput {
  source: SourceName;
  sourceId: string;
}

export function createRecordService(adapters: SourceAdapter[]) {
  const registry = createSourceRegistry(adapters);

  return {
    async getRecord(input: RecordInput) {
      const sourceId = validateSourceId(input.source, input.sourceId);
      const record = await registry.get(input.source).getRecord(sourceId);

      if (!record) {
        throw new NotFoundError(
          `Record not found: ${input.source}/${sourceId}`
        );
      }

      return record;
    }
  };
}
