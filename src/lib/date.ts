import type { DateInfo } from "./types.js";
import { normalizeText } from "./normalize.js";

const YEAR_ONLY = /^\d{4}$/;
const YEAR_MONTH = /^(\d{4})[./-](\d{1,2})$/;
const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUnknown(value: string | null): DateInfo {
  return {
    issuedAt: null,
    issuedAtLabel: value,
    issuedAtPrecision: "unknown"
  };
}

function isValidMonth(month: number): boolean {
  return month >= 1 && month <= 12;
}

function isValidDay(year: number, month: number, day: number): boolean {
  if (!isValidMonth(month) || day < 1) {
    return false;
  }

  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return day <= maxDay;
}

export function normalizeIssuedAt(input: string | null | undefined): DateInfo {
  const value = normalizeText(input);

  if (!value) {
    return toUnknown(null);
  }

  const fullDateMatch = value.match(FULL_DATE);
  if (fullDateMatch) {
    const year = Number(fullDateMatch[1]);
    const month = Number(fullDateMatch[2]);
    const day = Number(fullDateMatch[3]);

    if (!isValidDay(year, month, day)) {
      return toUnknown(value);
    }

    return {
      issuedAt: value,
      issuedAtLabel: value,
      issuedAtPrecision: "day"
    };
  }

  const monthMatch = value.match(YEAR_MONTH);
  if (monthMatch) {
    const month = Number(monthMatch[2]);

    if (!isValidMonth(month)) {
      return toUnknown(value);
    }

    return {
      issuedAt: `${monthMatch[1]}-${month.toString().padStart(2, "0")}`,
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

  return toUnknown(value);
}
