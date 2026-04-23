import type { SourceName } from "../lib/types.js";
import type { SourceAdapter } from "../sources/types.js";

export interface SourceRegistry {
  get(source: SourceName): SourceAdapter;
  list(): SourceName[];
}

export function createSourceRegistry(adapters: SourceAdapter[]): SourceRegistry {
  const adaptersBySource = new Map<SourceName, SourceAdapter>();

  for (const adapter of adapters) {
    if (adaptersBySource.has(adapter.source)) {
      throw new Error(`Duplicate source: ${adapter.source}`);
    }

    adaptersBySource.set(adapter.source, adapter);
  }

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
