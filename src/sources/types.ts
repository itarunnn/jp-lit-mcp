import type { RecordItem, SearchItem, SourceName } from "../lib/types.js";

export interface SearchParams {
  query: string;
  limit: number;
  page: number;
}

export interface SearchResult {
  total: number;
  items: SearchItem[];
}

export interface SourceAdapter {
  source: SourceName;
  search(params: SearchParams): Promise<SearchResult>;
  getRecord(sourceId: string): Promise<RecordItem | null>;
}
