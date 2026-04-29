export interface CacheEnvelope<T> {
  version: number;
  tool: string;
  cache_key: string;
  saved_at: string;
  input: Record<string, unknown>;
  structured_content: T;
}

export type SessionItemLabel =
  | "confirmed"
  | "strong_candidate"
  | "weak_candidate";

export interface SessionSelectedItem {
  source: string;
  source_id: string;
  title: string;
  label: SessionItemLabel;
  note: string | null;
}

export interface SessionResultRef {
  tool: string;
  cache_key: string;
}

export interface SessionEntry {
  tool: string;
  input: Record<string, unknown>;
  cache_key: string;
  result_ref: SessionResultRef;
  selected_items: SessionSelectedItem[];
  notes: string[];
}

export interface SessionDocument {
  session_id: string;
  created_at: string;
  updated_at: string;
  entries: SessionEntry[];
}

export interface SessionAnnotationInput {
  tool: string;
  cache_key: string;
  selected_items: SessionSelectedItem[];
  notes?: string[];
}
