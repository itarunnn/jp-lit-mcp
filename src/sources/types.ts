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
  keyword?: string;
  journal?: string;
  publisher?: string;
}

export interface NihuBridgeSearchFilters {
  institute?: Array<"nijl" | "nmjh" | "ninjal" | "ircjs" | "rihn" | "nme" | "nihu">;
  database?: string[];
  normalize?: boolean;
  period_from?: string;
  period_to?: string;
  bbox?: { lat1: number; lon1: number; lat2: number; lon2: number };
}

export interface JdcatSearchFilters {
  subject?: string;
  geographic?: string;
  contributor?: string;
  title?: string;
  temporal?: string;
  creator?: string;
}

export interface SearchParams {
  query: string;
  limit: number;
  page: number;
  sort_by?: "title" | "creator" | "issued_date" | "created_date" | "modified_date";
  sort_order?: "asc" | "desc";
  filters?: {
    irdb?: IrdbSearchFilters;
    nihu_bridge?: NihuBridgeSearchFilters;
    jdcat?: JdcatSearchFilters;
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
