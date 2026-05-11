import { normalizeText } from "../../lib/normalize.js";

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

export function firstHref(value: string | null | undefined): string | null {
  return cleanText(value?.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1] ?? null);
}

export function absolutizeUrl(baseUrl: string, pathOrUrl: string | null): string | null {
  if (!pathOrUrl) {
    return null;
  }

  try {
    return new URL(pathOrUrl, baseUrl).toString();
  } catch {
    return pathOrUrl;
  }
}

export function splitSubject(value: string | null) {
  if (!value) {
    return {
      periodClassification: null,
      field: null
    };
  }

  const [periodClassification, field] = value.split("-", 2).map((entry) => normalizeText(entry));

  return {
    periodClassification: periodClassification ?? null,
    field: field ?? null
  };
}
