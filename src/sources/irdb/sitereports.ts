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
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
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
    if (
      url.protocol !== "https:" ||
      url.hostname !== "sitereports.nabunken.go.jp" ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    const recordId = url.pathname.match(/^\/(\d+)\/?$/)?.[1];
    if (!recordId) {
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
