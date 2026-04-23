import type { SourceName } from "../lib/types.js";
import type { SourceAdapter } from "../sources/types.js";

export interface SourceRegistry {
  get(source: SourceName): SourceAdapter;
  list(): SourceName[];
}

export function createSourceRegistry(adapters: SourceAdapter[]): SourceRegistry {
  const adaptersBySource = new Map<SourceName, SourceAdapter>(
    adapters.map((adapter) => [adapter.source, adapter])
  );

  return {
    get(source) {
      const adapter = adaptersBySource.get(source);
      if (!adapter) {
        throw new Error(`Unsupported source: ${source}`);
      }

      return adapter;
    },
    list() {
      return [...adaptersBySource.keys()];
    }
  };
}
