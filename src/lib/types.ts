export type SourceName =
  | "ndl_search"
  | "ndl_catalog"
  | "ndl_digital"
  | "ndl_articles"
  | "ndl_articles_online"
  | "irdb"
  | "jdcat"
  | "jstage_articles"
  | "japan_search"
  | "cinii_articles"
  | "cinii_books"
  | "kokkai_minutes"
  | "teikoku_minutes"
  | "nihu_bridge"
  | "national_archives"
  | "jacar";

export type IssuedAtPrecision = "day" | "month" | "year" | "unknown";

export interface KnownDateInfo {
  issuedAt: string;
  issuedAtLabel: string;
  issuedAtPrecision: Exclude<IssuedAtPrecision, "unknown">;
}

export interface UnknownDateInfo {
  issuedAt: null;
  issuedAtLabel: string | null;
  issuedAtPrecision: "unknown";
}

export type DateInfo = KnownDateInfo | UnknownDateInfo;

export interface KnownDateFields {
  issued_at: string;
  issued_at_label: string;
  issued_at_precision: Exclude<IssuedAtPrecision, "unknown">;
}

export interface UnknownDateFields {
  issued_at: null;
  issued_at_label: string | null;
  issued_at_precision: "unknown";
}

export type DateFields = KnownDateFields | UnknownDateFields;

export interface PersonRole {
  name: string;
  role: string | null;
}

export interface RelatedSearchRecord {
  source: SourceName;
  source_id: string;
  title: string;
  url: string | null;
}

export interface SearchFacets {
  providers: Record<string, number>;
  ndc: Record<string, number>;
  issued_years: Record<string, number>;
}

export interface SearchItemBase {
  source: SourceName;
  source_id: string;
  title: string;
  subtitle: string | null;
  title_reading: string | null;
  authors: PersonRole[];
  publisher: string | null;
  journal_title: string | null;
  summary: string | null;
  url: string | null;
  availability: {
    online: boolean;
    digital_collection: boolean;
  };
  material_type: string | null;
  subjects: string[];
  table_of_contents: string[];
  source_metadata?: Record<string, unknown>;
  duplicate_key: string | null;
  duplicate_count: number;
  related_records: RelatedSearchRecord[];
}

export type SearchItem = SearchItemBase & DateFields;

export interface RecordItemBase {
  source: SourceName;
  source_id: string;
  title: string;
  subtitle: string | null;
  title_reading: string | null;
  authors: PersonRole[];
  publisher: string | null;
  journal_title: string | null;
  summary: string | null;
  url: string | null;
  availability: {
    online: boolean;
    digital_collection: boolean;
  };
  alternative_titles: string[];
  publication_place: string | null;
  language: string | null;
  material_type: string | null;
  extent: string | null;
  subjects: string[];
  identifiers: Record<string, unknown>;
  table_of_contents: string[];
  content_access: {
    has_page_images: boolean;
    has_text_coordinates: boolean;
    viewer_url: string | null;
    access_note: string | null;
  };
  source_metadata: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export type RecordItem = RecordItemBase & DateFields;
