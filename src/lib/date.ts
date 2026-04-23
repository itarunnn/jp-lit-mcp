import type { DateInfo } from "./types.js";
import { normalizeText } from "./normalize.js";

const YEAR_ONLY = /^\d{4}$/;
const YEAR_MONTH = /^(\d{4})[./-](\d{1,2})$/;
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeIssuedAt(input: string | null | undefined): DateInfo {
  const value = normalizeText(input);

  if (!value) {
    return {
      issuedAt: null,
      issuedAtLabel: null,
      issuedAtPrecision: "unknown"
    };
  }

  if (FULL_DATE.test(value)) {
    return {
      issuedAt: value,
      issuedAtLabel: value,
      issuedAtPrecision: "day"
    };
  }

  const monthMatch = value.match(YEAR_MONTH);
  if (monthMatch) {
    return {
      issuedAt: `${monthMatch[1]}-${monthMatch[2].padStart(2, "0")}`,
      issuedAtLabel: value,
      issuedAtPrecision: "month"
    };
  }

  if (YEAR_ONLY.test(value)) {
    return {
      issuedAt: value,
      issuedAtLabel: value,
      issuedAtPrecision: "year"
    };
  }

  return {
    issuedAt: null,
    issuedAtLabel: value,
    issuedAtPrecision: "unknown"
  };
}
