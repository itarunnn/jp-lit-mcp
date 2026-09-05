import { normalizeIssuedAt } from "./date.js";
import { InvalidRequestError, NotFoundError } from "./errors.js";
import type { FileCache } from "./persistence/fileCache.js";
import type { CacheEnvelope } from "./persistence/types.js";
import {
  searchFulltextOutputSchema,
  searchOutputSchema
} from "./schemas.js";
import { ndlPidToDigitalSourceId } from "./sourceId.js";
import type {
  DateFields,
  IssuedAtPrecision,
  SearchItem,
  SourceName
} from "./types.js";
import type {
  CandidateResultRef,
  CandidateResultTool
} from "./candidateResults.js";
import { isCandidateResultTool } from "./candidateResults.js";

export interface CandidateResult {
  ref: CandidateResultRef;
  query: string;
  total: number;
  source: SourceName | null;
  items: SearchItem[];
}

function toDateFields(
  issuedAt: string | null,
  issuedAtLabel: string | null,
  issuedAtPrecision: IssuedAtPrecision
): DateFields {
  if (issuedAt === null) {
    if (issuedAtPrecision !== "unknown") {
      throw new Error("missing issued_at requires unknown precision");
    }
    return {
      issued_at: null,
      issued_at_label: issuedAtLabel,
      issued_at_precision: "unknown"
    };
  }

  if (issuedAtLabel === null || issuedAtPrecision === "unknown") {
    throw new Error("known issued_at requires label and known precision");
  }
  return {
    issued_at: issuedAt,
    issued_at_label: issuedAtLabel,
    issued_at_precision: issuedAtPrecision
  };
}

function toSearchItem(
  item: ReturnType<typeof searchOutputSchema.parse>["items"][number]
): SearchItem {
  return {
    ...item,
    ...toDateFields(
      item.issued_at,
      item.issued_at_label,
      item.issued_at_precision
    )
  };
}

function withCandidateOrigin(
  item: SearchItem,
  origin: "jp_lit_search" | "ndl_digital_browser"
): SearchItem {
  return {
    ...item,
    source_metadata: {
      ...item.source_metadata,
      candidate_origins: [origin]
    }
  };
}

function normalizeSearchResult(
  ref: CandidateResultRef,
  structuredContent: unknown
): CandidateResult {
  const parsed = searchOutputSchema.parse(structuredContent);
  const origin = ref.tool === "jp_lit_search"
    ? "jp_lit_search"
    : "ndl_digital_browser";

  return {
    ref,
    query: parsed.query,
    total: parsed.total,
    source: parsed.source,
    items: parsed.items.map((item) => withCandidateOrigin(toSearchItem(item), origin))
  };
}

function normalizeFulltextResult(
  ref: CandidateResultRef,
  structuredContent: unknown
): CandidateResult {
  const parsed = searchFulltextOutputSchema.parse(structuredContent);
  const items = parsed.items.map((item): SearchItem => {
    const issued = normalizeIssuedAt(
      item.publishyear === null ? item.published : String(item.publishyear)
    );

    return {
      source: "ndl_digital",
      source_id: ndlPidToDigitalSourceId(item.pid),
      title: item.title ?? "Untitled",
      subtitle: item.volume,
      title_reading: null,
      authors: item.responsibility
        ? [{ name: item.responsibility, role: null }]
        : [],
      publisher: item.publisher,
      journal_title: null,
      ...toDateFields(
        issued.issuedAt,
        issued.issuedAtLabel,
        issued.issuedAtPrecision
      ),
      summary: null,
      url: item.viewer_url,
      availability: {
        online: true,
        digital_collection: true
      },
      material_type: "図書",
      subjects: [],
      table_of_contents: [],
      source_metadata: {
        pid: item.pid,
        candidate_origins: ["next_digital_library_fulltext"],
        next_digital_library_fulltext: { ...item }
      },
      duplicate_key: null,
      duplicate_count: 1,
      related_records: []
    };
  });

  return {
    ref,
    query: parsed.keyword,
    total: parsed.total,
    source: "ndl_digital",
    items
  };
}

export function normalizeCandidateResult(
  ref: CandidateResultRef,
  structuredContent: unknown
): CandidateResult {
  try {
    return ref.tool === "jp_lit_search_fulltext"
      ? normalizeFulltextResult(ref, structuredContent)
      : normalizeSearchResult(ref, structuredContent);
  } catch {
    throw new InvalidRequestError(
      `invalid candidate cache payload: ${ref.tool}/${ref.cache_key}`
    );
  }
}

export async function readCandidateResult(
  cache: FileCache,
  ref: CandidateResultRef
): Promise<CandidateResult> {
  const envelope = await cache.read<unknown>(ref.tool, ref.cache_key);
  if (!envelope) {
    throw new NotFoundError(
      `candidate result cache not found: ${ref.tool}/${ref.cache_key}`
    );
  }

  return normalizeCandidateResult(ref, envelope.structured_content);
}

export function extractCandidateItems(
  envelope: CacheEnvelope<unknown>
): SearchItem[] | null {
  if (!isCandidateResultTool(envelope.tool)) {
    return null;
  }

  return normalizeCandidateResult(
    { tool: envelope.tool, cache_key: envelope.cache_key },
    envelope.structured_content
  ).items;
}

export interface CandidateItemWithTool {
  tool: CandidateResultTool;
  item: SearchItem;
}

const TOOL_PRIORITY: Record<CandidateResultTool, number> = {
  jp_lit_search: 0,
  jp_lit_record_ndl_browser_search: 1,
  jp_lit_search_fulltext: 2
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  const record = asRecord(value);
  if (record) {
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function normalizedUnion<T>(groups: T[][]): T[] {
  const byKey = new Map<string, T>();
  for (const value of groups.flat()) {
    const key = stableSerialize(value).normalize("NFKC").trim();
    if (!byKey.has(key)) {
      byKey.set(key, value);
    }
  }
  return Array.from(byKey.values());
}

function mergeSourceMetadata(entries: CandidateItemWithTool[]) {
  const keys = new Set(
    entries.flatMap((entry) => Object.keys(entry.item.source_metadata ?? {}))
  );
  const merged: Record<string, unknown> = {};

  for (const key of keys) {
    if (key === "candidate_origins" || key === "browser_observations") {
      continue;
    }

    const values = entries
      .map((entry) => entry.item.source_metadata?.[key])
      .filter(hasValue);
    if (values.some(Array.isArray)) {
      merged[key] = normalizedUnion(
        values.filter(Array.isArray) as unknown[][]
      );
    } else if (values.length > 0) {
      merged[key] = values[0];
    }
  }

  const origins = normalizedUnion(
    entries.map((entry) => {
      const value = entry.item.source_metadata?.candidate_origins;
      return Array.isArray(value)
        ? value.filter((origin): origin is string => typeof origin === "string")
        : [];
    })
  );
  if (origins.length > 0) {
    merged.candidate_origins = origins;
  }

  const observations = normalizedUnion(
    entries.map((entry) => {
      const value = entry.item.source_metadata?.browser_observations;
      return Array.isArray(value) ? value : [];
    })
  ).sort((left, right) => {
    const leftCheckedAt = asRecord(left)?.checked_at;
    const rightCheckedAt = asRecord(right)?.checked_at;
    return String(leftCheckedAt ?? "").localeCompare(String(rightCheckedAt ?? ""));
  });
  if (observations.length > 0) {
    merged.browser_observations = observations;
  }

  return merged;
}

export function mergeSameSourceRecordItems(
  entries: CandidateItemWithTool[]
): SearchItem {
  const sorted = [...entries].sort((left, right) => {
    const priority = TOOL_PRIORITY[left.tool] - TOOL_PRIORITY[right.tool];
    return priority || stableSerialize(left.item).localeCompare(stableSerialize(right.item));
  });
  const preferred = sorted[0]!;

  const first = <T>(read: (item: SearchItem) => T): T => {
    const value = sorted.map((entry) => read(entry.item)).find(hasValue);
    return value as T;
  };
  const dateEntry = sorted.find(
    (entry) =>
      entry.item.issued_at !== null || entry.item.issued_at_label !== null
  )
    ?? preferred;
  const dateFields = toDateFields(
    dateEntry.item.issued_at,
    dateEntry.item.issued_at_label,
    dateEntry.item.issued_at_precision
  );
  const sourceMetadata = mergeSourceMetadata(sorted);

  return {
    source: preferred.item.source,
    source_id: preferred.item.source_id,
    title: first((item) => item.title),
    subtitle: first((item) => item.subtitle) ?? null,
    title_reading: first((item) => item.title_reading) ?? null,
    authors: normalizedUnion(sorted.map((entry) => entry.item.authors)),
    publisher: first((item) => item.publisher) ?? null,
    journal_title: first((item) => item.journal_title) ?? null,
    ...dateFields,
    summary: first((item) => item.summary) ?? null,
    url: first((item) => item.url) ?? null,
    availability: {
      online: sorted.some((entry) => entry.item.availability.online),
      digital_collection: sorted.some(
        (entry) => entry.item.availability.digital_collection
      )
    },
    material_type: first((item) => item.material_type) ?? null,
    subjects: normalizedUnion(sorted.map((entry) => entry.item.subjects)),
    table_of_contents: normalizedUnion(
      sorted.map((entry) => entry.item.table_of_contents)
    ),
    ...(Object.keys(sourceMetadata).length > 0
      ? { source_metadata: sourceMetadata }
      : {}),
    duplicate_key: first((item) => item.duplicate_key) ?? null,
    duplicate_count: first((item) => item.duplicate_count),
    related_records: normalizedUnion(
      sorted.map((entry) => entry.item.related_records)
    )
  };
}
