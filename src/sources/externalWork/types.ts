export const EXTERNAL_WORK_PROVIDERS = ["crossref", "openalex"] as const;

export type ExternalProvider = typeof EXTERNAL_WORK_PROVIDERS[number];
export type ExternalProviderStatus = "ok" | "not_found" | "skipped" | "error";
export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface EnrichRecordQuery {
  doi: string | null;
  title: string | null;
  authors: string[];
  issued_year: string | null;
  providers: ExternalProvider[];
}

export interface EnrichRecordOutputQuery {
  doi: string | null;
  title: string | null;
  authors: string[];
  issued_year: string | null;
}

export interface ExternalWorkItem {
  provider: ExternalProvider;
  id: string;
  doi: string | null;
  title: string;
  authors: string[];
  issued_year: string | null;
  url: string | null;
  cited_by_count: number | null;
  source_title: string | null;
  type: string | null;
}

export interface ExternalLookupResult {
  provider: ExternalProvider;
  status: ExternalProviderStatus;
  note: string | null;
  item_count: number;
  items: ExternalWorkItem[];
}

export interface ExternalProviderSummary {
  status: ExternalProviderStatus;
  item_count: number;
  note: string | null;
}

export interface MatchAssessment {
  match_confidence: MatchConfidence;
  reasons: string[];
  missing: string[];
  caution: string;
}

export type ExternalWorkMatch = ExternalWorkItem & MatchAssessment;

export interface EnrichRecordOutput {
  query: EnrichRecordOutputQuery;
  providers: Partial<Record<ExternalProvider, ExternalProviderSummary>>;
  matches: ExternalWorkMatch[];
  caution: string;
}

export interface ExternalWorkClient {
  lookup(input: EnrichRecordQuery): Promise<ExternalLookupResult>;
}
