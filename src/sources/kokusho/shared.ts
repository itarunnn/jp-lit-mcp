import { normalizeIssuedAt } from "../../lib/date.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { DateFields, PersonRole } from "../../lib/types.js";

export type JsonRecord = Record<string, unknown>;

export const BASE_URL = "https://kokusho.nijl.ac.jp";

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

export function readString(value: unknown): string | null {
  if (typeof value === "string") {
    return normalizeText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

export function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return compactStrings(value.map((entry) => readString(entry)));
  }

  return compactStrings([readString(value)]);
}

export function toAuthors(value: unknown): PersonRole[] {
  return readStringList(value).map((name) => ({
    name,
    role: "author"
  }));
}

export function toIssuedFields(value: unknown): DateFields {
  const issuedAt = normalizeIssuedAt(readString(value));
  if (issuedAt.issuedAtPrecision === "unknown") {
    return {
      issued_at: null,
      issued_at_label: issuedAt.issuedAtLabel,
      issued_at_precision: "unknown"
    };
  }

  return {
    issued_at: issuedAt.issuedAt,
    issued_at_label: issuedAt.issuedAtLabel,
    issued_at_precision: issuedAt.issuedAtPrecision
  };
}

export function recordUrl(sourceId: string) {
  return `${BASE_URL}/biblio/${sourceId}`;
}

export function hasImages(value: unknown) {
  return readString(value) === "1" || value === 1 || value === true;
}

export function materialType() {
  return "古典籍";
}
