import { compactStrings, normalizeText } from "../../lib/normalize.js";

export const BASE_URL = "https://bibdb.ninjal.ac.jp";

export function htmlToText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanText(value: string | null | undefined): string | null {
  return normalizeText(value ? htmlToText(value) : null);
}

export function absolutizeUrl(pathOrUrl: string | null): string | null {
  if (!pathOrUrl) {
    return null;
  }

  try {
    return new URL(pathOrUrl, BASE_URL).toString();
  } catch {
    return pathOrUrl;
  }
}

export function splitTerms(value: string | null | undefined): string[] {
  return compactStrings((value ?? "").split(/[;；、,]/));
}

export function uniqueStrings(values: string[]) {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}
