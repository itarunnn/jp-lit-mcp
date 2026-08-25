import type { SearchFacets, SearchItem } from "../../lib/types.js";
import type { SearchResult } from "../types.js";
import {
  mapNdlSearchSearchEntry,
  readNdlSearchString,
  readNdlSearchStringList
} from "./mapSearch.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readMetaEntries(value: unknown): JsonRecord[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];

  return values.flatMap((entry) => {
    const record = asRecord(entry);
    return record ? [record] : [];
  });
}

function readMetaValue(meta: JsonRecord | null, key: string): string | null {
  if (!meta) {
    return null;
  }

  for (const entry of readMetaEntries(meta[key])) {
    const value = readNdlSearchString(entry.v ?? entry.value);
    if (value) {
      return value;
    }
  }

  return null;
}

function readMetaList(meta: JsonRecord | null, key: string): string[] {
  if (!meta) {
    return [];
  }

  return readMetaEntries(meta[key]).flatMap((entry) =>
    readNdlSearchStringList(entry.v ?? entry.value)
  );
}

function hasIntroduction(meta: JsonRecord | null, introduction: string | null): boolean {
  if (introduction) {
    return true;
  }

  return readMetaEntries(meta?.t09815).some(
    (entry) => readNdlSearchString(entry.s) === "1"
  );
}

function mapReferenceBookEntry(entry: unknown): SearchItem {
  const record = asRecord(entry) ?? {};
  const meta = asRecord(record.meta);
  const introduction = readMetaValue(meta, "t09812");
  const base = mapNdlSearchSearchEntry({
    id: readNdlSearchString(record.id),
    title: readMetaValue(meta, "t02451") ?? readMetaValue(meta, "t02450"),
    authors: readMetaList(meta, "t0245c").map((name) => ({ name, role: "author" })),
    publisher: readMetaValue(meta, "t02600"),
    issued: readMetaValue(meta, "t02604"),
    materialType: readMetaValue(meta, "k09022"),
    subjects: readMetaList(meta, "t06500"),
    summary: introduction,
    url: readNdlSearchString(record.id)
      ? `https://ndlsearch.ndl.go.jp/books/${readNdlSearchString(record.id)}`
      : undefined
  });

  return {
    ...base,
    source_metadata: {
      reference_book: readMetaValue(meta, "t09800") === "SANKO",
      reference_ndc: readMetaList(meta, "k09810"),
      introduction,
      has_introduction: hasIntroduction(meta, introduction)
    }
  };
}

function readFacets(value: unknown): SearchFacets | undefined {
  const record = asRecord(value);
  const providers = asRecord(record?.providers);
  const ndc = asRecord(record?.ndc);
  const issuedYears = asRecord(record?.issued_years);

  if (!providers || !ndc || !issuedYears) {
    return undefined;
  }

  const numericEntries = (entries: JsonRecord) =>
    Object.fromEntries(
      Object.entries(entries).flatMap(([key, count]) =>
        typeof count === "number" ? [[key, count]] : []
      )
    );

  return {
    providers: numericEntries(providers),
    ndc: numericEntries(ndc),
    issued_years: numericEntries(issuedYears)
  };
}

export function mapNdlReferenceBooksSearchResponse(payload: unknown): SearchResult {
  const record = asRecord(payload) ?? {};
  const entries = Array.isArray(record.list) ? record.list : [];
  const hit = Number(readNdlSearchString(record.hit));
  const items = entries.map((entry) => mapReferenceBookEntry(entry));
  const facets = readFacets(record.facets);

  return {
    total: Number.isFinite(hit) ? hit : items.length,
    items,
    ...(facets ? { facets } : {})
  };
}
