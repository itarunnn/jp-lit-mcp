import type { CacheEnvelope, SessionDocument } from "./types.js";

type SessionEntry = SessionDocument["entries"][number];
type SelectedItem = SessionEntry["selected_items"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readFirstString(...values: unknown[]) {
  for (const value of values) {
    const str = readString(value);
    if (str) return str;
  }
  return null;
}

export function extractCslSourceItems(envelope: CacheEnvelope<unknown> | null) {
  if (!envelope) return [];
  const structuredContent = envelope.structured_content;
  if (!isRecord(structuredContent)) return [];
  if (Array.isArray(structuredContent.items)) {
    return structuredContent.items.filter(isRecord);
  }
  if (typeof structuredContent.source === "string" && typeof structuredContent.source_id === "string") {
    return [structuredContent];
  }
  return [];
}

export function findCslSourceItem(
  items: Array<Record<string, unknown>>,
  selected: SelectedItem
) {
  return items.find(
    (item) => item.source === selected.source && item.source_id === selected.source_id
  );
}

function inferCslType(item: Record<string, unknown>) {
  const source = readString(item.source);
  const materialType = readString(item.material_type)?.toLowerCase() ?? "";
  const journalTitle = readString(item.journal_title);

  if (
    source === "cinii_dissertations" ||
    materialType.includes("thesis") ||
    materialType.includes("dissertation")
  ) {
    return "thesis";
  }
  if (
    source === "jstage_articles" ||
    source === "cinii_articles" ||
    source === "ndl_articles" ||
    (source === "irdb" && journalTitle)
  ) {
    return "article-journal";
  }
  if (source === "ndl_catalog" || source === "ndl_digital" || source === "cinii_books") {
    return "book";
  }
  if (source === "kokkai_minutes" || source === "teikoku_minutes") {
    return "speech";
  }
  if (source === "jdcat" || materialType.includes("dataset")) {
    return "dataset";
  }
  return "webpage";
}

function toCslAuthors(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const authors = value
    .map((entry) => readString(readRecord(entry).name))
    .filter((name): name is string => name !== null)
    .map((literal) => ({ literal }));
  return authors.length > 0 ? authors : undefined;
}

function toCslIssued(item: Record<string, unknown>) {
  const value = readString(item.issued_at) ?? readString(item.issued_at_label);
  const match = value?.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (!match) return undefined;
  const parts = [match[1], match[2], match[3]]
    .filter((part): part is string => part !== undefined)
    .map((part) => Number(part));
  return parts.length > 0 && parts.every((part) => Number.isFinite(part))
    ? { "date-parts": [parts] }
    : undefined;
}

function readIdentifier(identifiers: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = identifiers[key];
    if (Array.isArray(value)) {
      const first = value.map(readString).find((entry) => entry !== null);
      if (first) return first;
    }
    const str = readString(value);
    if (str) return str;
  }
  return null;
}

function readPages(item: Record<string, unknown>) {
  const sourceMetadata = readRecord(item.source_metadata);
  const start = readFirstString(
    sourceMetadata.first_page,
    sourceMetadata.starting_page,
    sourceMetadata.startingPage
  );
  const end = readFirstString(
    sourceMetadata.last_page,
    sourceMetadata.ending_page,
    sourceMetadata.endingPage
  );
  if (start) return end ? `${start}-${end}` : start;

  const extent = readString(item.extent);
  return extent?.match(/pp\.?\s*([0-9ivxlcdm]+(?:\s*-\s*[0-9ivxlcdm]+)?)/i)?.[1]?.replace(/\s+/g, "") ?? null;
}

function buildCslNote(item: Record<string, unknown>, selected: SelectedItem) {
  const lines = [
    `source: ${selected.source}`,
    `source_id: ${selected.source_id}`,
    `selection: ${selected.label}`
  ];
  if (selected.note) lines.push(`selection note: ${selected.note}`);
  const materialType = readString(item.material_type);
  if (materialType) lines.push(`material_type: ${materialType}`);
  const sourceUri = readString(readRecord(item.source_metadata).source_uri);
  if (sourceUri) lines.push(`source_uri: ${sourceUri}`);
  return lines.join("\n");
}

export function toCslItem(selected: SelectedItem, cachedItem?: Record<string, unknown>) {
  const item = cachedItem ?? {
    source: selected.source,
    source_id: selected.source_id,
    title: selected.title
  };
  const identifiers = readRecord(item.identifiers);
  const sourceMetadata = readRecord(item.source_metadata);
  const contentAccess = readRecord(item.content_access);
  const doi = readIdentifier(identifiers, "doi", "DOI");
  const isbn = readIdentifier(identifiers, "isbn", "ISBN");
  const issn = readIdentifier(identifiers, "issn", "ISSN", "pissn", "eissn");
  const volume = readFirstString(sourceMetadata.volume, sourceMetadata.journal_volume);
  const issue = readFirstString(sourceMetadata.issue, sourceMetadata.journal_number, sourceMetadata.number);
  const url = readFirstString(item.url, contentAccess.viewer_url);
  const author = toCslAuthors(item.authors);
  const issued = toCslIssued(item);
  const publisher = readString(item.publisher);
  const containerTitle = readString(item.journal_title);
  const page = readPages(item);

  return {
    type: inferCslType(item),
    id: `${selected.source}:${selected.source_id}`,
    title: readString(item.title) ?? selected.title,
    ...(author ? { author } : {}),
    ...(issued ? { issued } : {}),
    ...(publisher ? { publisher } : {}),
    ...(containerTitle ? { "container-title": containerTitle } : {}),
    ...(doi ? { DOI: doi } : {}),
    ...(isbn ? { ISBN: isbn } : {}),
    ...(issn ? { ISSN: issn } : {}),
    ...(url ? { URL: url } : {}),
    ...(volume ? { volume } : {}),
    ...(issue ? { issue } : {}),
    ...(page ? { page } : {}),
    note: buildCslNote(item, selected)
  };
}

export function toFallbackSelectedItem(item: Record<string, unknown>): SelectedItem {
  return {
    source: readString(item.source) ?? "unknown",
    source_id: readString(item.source_id) ?? "unknown",
    title: readString(item.title) ?? "(untitled)",
    label: "weak_candidate",
    note: null
  };
}
