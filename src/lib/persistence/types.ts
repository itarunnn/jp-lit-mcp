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

export type SourcePlanStatus = "planned" | "used" | "deferred" | "skipped";

export type SearchAttemptOutcome =
  | "useful"
  | "partial"
  | "empty"
  | "noisy"
  | "failed";

export type DecisionKind =
  | "adopt"
  | "hold"
  | "reject"
  | "deduplicate"
  | "needs_followup";

export type EvidenceChecked =
  | "metadata"
  | "abstract"
  | "toc"
  | "fulltext_snippet"
  | "fulltext"
  | "external_review";

export type EvidenceBodyStatus =
  | "not_checked"
  | "online_entry_unread"
  | "no_online_entry"
  | "restricted"
  | "confirmed";

export type NextActionPriority = "high" | "medium" | "low";

export interface SourcePlanEntry {
  source: string;
  status: SourcePlanStatus;
  reason: string;
  expected_contribution?: string;
  created_at: string;
}

export interface OpenQuestion {
  question: string;
  reason: string;
  related_sources?: string[];
  created_at: string;
}

export interface NextAction {
  action: string;
  reason: string;
  priority: NextActionPriority;
  source?: string;
  created_at: string;
}

export interface SessionTrace {
  research_goal?: string;
  scope_note?: string;
  source_plans: SourcePlanEntry[];
  open_questions: OpenQuestion[];
  next_actions: NextAction[];
}

export interface SearchAttempt {
  source: string | null;
  query: string;
  purpose: string;
  total: number | null;
  returned_count: number;
  extracted_count: number;
  outcome: SearchAttemptOutcome;
  next_step?: string;
}

export interface EvidenceRef {
  tool?: string;
  cache_key?: string;
  source?: string;
  source_id?: string;
  url?: string;
  quote_or_summary?: string;
}

export interface DecisionEntry {
  kind: DecisionKind;
  target: {
    source?: string;
    source_id?: string;
    cache_key?: string;
    title?: string;
  };
  reason: string;
  evidence_refs: EvidenceRef[];
  created_at: string;
}

export interface EvidenceScopeEntry {
  target: {
    source?: string;
    source_id?: string;
    title?: string;
  };
  checked: EvidenceChecked;
  body_status: EvidenceBodyStatus;
  note?: string;
  evidence_refs: EvidenceRef[];
}

export interface SessionEntryTrace {
  intent?: string;
  search_attempt?: SearchAttempt;
  decisions: DecisionEntry[];
  evidence_scope: EvidenceScopeEntry[];
}

export interface SessionEntry {
  tool: string;
  input: Record<string, unknown>;
  cache_key: string;
  result_ref: SessionResultRef;
  selected_items: SessionSelectedItem[];
  notes: string[];
  trace?: SessionEntryTrace;
}

export interface SessionDocument {
  session_id: string;
  created_at: string;
  updated_at: string;
  entries: SessionEntry[];
  trace?: SessionTrace;
}

export interface SessionAnnotationInput {
  tool: string;
  cache_key: string;
  selected_items: SessionSelectedItem[];
  notes?: string[];
  trace?: {
    intent?: string;
    search_attempt?: SearchAttempt;
    decisions?: Array<Omit<DecisionEntry, "created_at">>;
    evidence_scope?: EvidenceScopeEntry[];
  };
}

export interface SessionTraceUpdateInput {
  research_goal?: string;
  scope_note?: string;
  source_plans?: Array<Omit<SourcePlanEntry, "created_at">>;
  open_questions?: Array<Omit<OpenQuestion, "created_at">>;
  next_actions?: Array<Omit<NextAction, "created_at">>;
}
