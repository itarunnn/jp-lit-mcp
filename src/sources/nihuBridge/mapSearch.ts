import { normalizeIssuedAt } from "../../lib/date.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { PersonRole, SearchItem } from "../../lib/types.js";
import type { SearchResult } from "../types.js";

interface NihuField {
  field: string;
  label?: string;
  value: unknown;
  highlight?: string;
}

interface NihuHit {
  database: string;
  id: string;
  fields: NihuField[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getField(fields: NihuField[], name: string): unknown {
  return fields.find((f) => f.field === name)?.value ?? null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return compactStrings(value.map((v) => (typeof v === "string" ? v : null)));
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

function stripPipeSuffix(s: string): string {
  const idx = s.indexOf("||");
  return idx === -1 ? s.trim() : s.slice(0, idx).trim();
}

function stripIdMarkup(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\|\|.*$/, "").trim();
}

function pickTitle(fields: NihuField[]): string {
  const arr = asStringArray(getField(fields, "title"));
  const head = arr[0];
  if (!head) return "Untitled";
  const cleaned = stripPipeSuffix(head);
  return cleaned.length > 0 ? cleaned : "Untitled";
}

function pickReading(fields: NihuField[]): string | null {
  const arr = asStringArray(getField(fields, "title"));
  const head = arr[0];
  if (!head) return null;
  const idx = head.indexOf("||");
  if (idx === -1) return null;
  const reading = head.slice(idx + 2).trim();
  return reading.length > 0 ? reading : null;
}

function toAuthors(fields: NihuField[]): PersonRole[] {
  const creators = asStringArray(getField(fields, "creator"));
  return compactStrings(creators.map((c) => stripIdMarkup(c))).map((name) => ({
    name,
    role: "author"
  }));
}

function toIssuedFields(value: string | null) {
  const issuedAt = normalizeIssuedAt(value);
  if (issuedAt.issuedAtPrecision === "unknown") {
    return {
      issued_at: null,
      issued_at_label: issuedAt.issuedAtLabel,
      issued_at_precision: "unknown" as const
    };
  }
  return {
    issued_at: issuedAt.issuedAt,
    issued_at_label: issuedAt.issuedAtLabel,
    issued_at_precision: issuedAt.issuedAtPrecision
  };
}

function stripTimePart(s: string): string {
  const idx = s.indexOf("T");
  return idx === -1 ? s : s.slice(0, idx);
}

function pickIssuedAt(fields: NihuField[]): string | null {
  const temporalRaw = getField(fields, "temporal");
  if (Array.isArray(temporalRaw) && temporalRaw.length > 0) {
    const head = asRecord(temporalRaw[0]);
    const date = typeof head?.date === "string" ? head.date : null;
    if (date) {
      const start = date.split(",")[0]?.trim();
      if (start) return stripTimePart(start);
    }
  }
  const datePub = getField(fields, "datePublished");
  if (typeof datePub === "string") return datePub;
  if (Array.isArray(datePub) && typeof datePub[0] === "string") return datePub[0];
  return null;
}

function pickUrl(fields: NihuField[]): string | null {
  const linkRaw = getField(fields, "link");
  if (!Array.isArray(linkRaw) || linkRaw.length === 0) return null;
  const head = asRecord(linkRaw[0]);
  const url = typeof head?.link === "string" ? head.link : null;
  return normalizeText(url);
}

function pickPublisher(fields: NihuField[]): string | null {
  const arr = asStringArray(getField(fields, "publisher"));
  return normalizeText(arr[0] ?? null);
}

function pickMaterialType(fields: NihuField[]): string | null {
  const arr = asStringArray(getField(fields, "type"));
  return normalizeText(arr[0] ?? null);
}

function pickSubjects(fields: NihuField[]): string[] {
  const subjects = asStringArray(getField(fields, "subject"));
  const keywords = asStringArray(getField(fields, "keyword"));
  return compactStrings([...subjects, ...keywords].map(stripPipeSuffix));
}

function pickSummary(fields: NihuField[]): string | null {
  const arr = asStringArray(getField(fields, "description"));
  return normalizeText(arr[0] ?? null);
}

export function mapNihuBridgeSearchHit(hit: NihuHit): SearchItem {
  const fields = Array.isArray(hit.fields) ? hit.fields : [];
  const sourceId = hit.id;
  const url = `https://bridge.nihu.jp/integrated_searchresults_detail/${sourceId}`;
  return {
    source: "nihu_bridge",
    source_id: sourceId,
    title: pickTitle(fields),
    subtitle: null,
    title_reading: pickReading(fields),
    authors: toAuthors(fields),
    publisher: pickPublisher(fields),
    journal_title: null,
    ...toIssuedFields(pickIssuedAt(fields)),
    summary: pickSummary(fields),
    url,
    availability: {
      online: Boolean(url),
      digital_collection: false
    },
    material_type: pickMaterialType(fields),
    subjects: pickSubjects(fields),
    table_of_contents: [],
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  };
}

export function mapNihuBridgeSearchResponse(payload: unknown): SearchResult {
  const record = asRecord(payload) ?? {};
  const info = asRecord(record.info) ?? {};
  const hits = Array.isArray(record.hits) ? record.hits : [];
  const total = Number(info.total);
  const items = hits
    .map((h) => asRecord(h))
    .filter((h): h is Record<string, unknown> => h !== null)
    .map((h) => ({
      database: typeof h.database === "string" ? h.database : "",
      id: typeof h.id === "string" ? h.id : "",
      fields: Array.isArray(h.fields) ? (h.fields as NihuField[]) : []
    }))
    .filter((h) => h.id.length > 0)
    .map((h) => mapNihuBridgeSearchHit(h));
  return {
    total: Number.isFinite(total) ? total : items.length,
    items
  };
}
