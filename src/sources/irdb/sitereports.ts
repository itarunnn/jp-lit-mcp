export interface SitereportsReference {
  record_id: string;
  record_url: string;
  doi: string | null;
}

export function normalizeSitereportsUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.hostname !== "sitereports.nabunken.go.jp") {
      return value;
    }
    url.protocol = "https:";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

export function deriveSitereportsReference(
  sourceUri: string | null,
  doi: string | null = null
): SitereportsReference | null {
  const normalized = normalizeSitereportsUrl(sourceUri);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (url.hostname !== "sitereports.nabunken.go.jp") {
      return null;
    }
    const recordId = url.pathname.split("/").filter(Boolean).at(-1);
    if (!recordId || !/^\d+$/.test(recordId)) {
      return null;
    }
    return {
      record_id: recordId,
      record_url: `https://sitereports.nabunken.go.jp/${recordId}`,
      doi
    };
  } catch {
    return null;
  }
}
