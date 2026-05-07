import { normalizeIssuedAt } from "../lib/date.js";
import { UpstreamHttpError } from "../lib/http.js";
import { compactStrings, normalizeText } from "../lib/normalize.js";
import type { DateFields, PersonRole } from "../lib/types.js";

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
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeHtml(value: string): string {
  return htmlToText(value);
}

export function extractLabel(text: string, label: string): string | null {
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:：]?\\s*([^\\n<]+?)(?=\\s*(?:請求番号|作成年月日|階層|画像数|利用制限|レファレンスコード|$))`);
  return normalizeText(text.match(pattern)?.[1] ?? null);
}

export function extractDlValue(html: string, label: string): string | null {
  const pattern = new RegExp(
    `<dt[^>]*>\\s*${escapeRegExp(label)}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`,
    "i"
  );
  const value = html.match(pattern)?.[1];
  return value ? normalizeText(htmlToText(value)) : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toIssuedFields(value: string | null | undefined): DateFields {
  const issuedAt = normalizeIssuedAt(value);
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

export function parseCsvRecords(csv: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...body] = rows.filter((entry) => entry.some((cellValue) => cellValue.trim()));
  if (!headers) {
    return [];
  }

  return body.map((entry) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      const normalizedHeader = index === 0 ? header.replace(/^\uFEFF/, "") : header;
      record[normalizedHeader] = entry[index] ?? "";
    });
    return record;
  });
}

export function csvFirst(csv: string | null | undefined): Record<string, string> {
  return csv ? parseCsvRecords(csv)[0] ?? {} : {};
}

export function numberFromText(value: string | null | undefined): number | null {
  const match = value?.match(/\d+/);
  if (!match) {
    return null;
  }
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

export function toAuthors(value: string | null | undefined, role: string): PersonRole[] {
  return compactStrings([value]).map((name) => ({ name, role }));
}

export function networkRestrictionError(error: unknown): Error {
  if (error instanceof UpstreamHttpError && error.status === 403) {
    return new Error(
      "Upstream request failed: 403 Forbidden（VPN・ネットワーク制限の可能性があります）"
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}
