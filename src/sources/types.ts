import type {
  RecordItem,
  SearchFacets,
  SearchItem,
  SourceName
} from "../lib/types.js";

export interface IrdbSearchFilters {
  fulltext?: boolean;
  title?: string;
  author?: string;
}

export interface SearchParams {
  query: string;
  limit: number;
  page: number;
  sort_by?: "title" | "creator" | "issued_date" | "created_date" | "modified_date";
  sort_order?: "asc" | "desc";
  filters?: {
    irdb?: IrdbSearchFilters;
  };
}

export interface SearchResult {
  total: number;
  items: SearchItem[];
  facets?: SearchFacets;
}

export interface SourceAdapter {
  source: SourceName;
  search(params: SearchParams): Promise<SearchResult>;
  getRecord(sourceId: string): Promise<RecordItem | null>;
}
