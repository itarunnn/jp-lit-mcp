export type SourceName = "ndl_search" | "ndl_digital";

export type IssuedAtPrecision = "day" | "month" | "year" | "unknown";

export interface DateInfo {
  issuedAt: string | null;
  issuedAtLabel: string | null;
  issuedAtPrecision: IssuedAtPrecision;
}

export interface PersonRole {
  name: string;
  role: string | null;
}

export interface SearchItem {
  source: SourceName;
  source_id: string;
  title: string;
  subtitle: string | null;
  authors: PersonRole[];
  publisher: string | null;
  issued_at: string | null;
  issued_at_label: string | null;
  issued_at_precision: IssuedAtPrecision;
  summary: string | null;
  url: string | null;
  availability: {
    online: boolean;
    digital_collection: boolean;
  };
}

export interface RecordItem extends SearchItem {
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
