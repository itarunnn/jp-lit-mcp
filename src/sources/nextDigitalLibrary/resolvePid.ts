import type { RecordItem } from "../../lib/types.js";

export type NextDigitalLibraryPidSource = "ndljp" | "viewer_url";

export interface NextDigitalLibraryPidResolution {
  pid: string;
  source: NextDigitalLibraryPidSource;
}

function extractPid(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const ndljpMatch = trimmed.match(/info:ndljp\/pid\/(\d+)/i);
  if (ndljpMatch) {
    return ndljpMatch[1] ?? null;
  }

  const pathMatch = trimmed.match(/\/pid\/(\d+)(?:[/?#]|$)/i);
  if (pathMatch) {
    return pathMatch[1] ?? null;
  }

  const numericMatch = trimmed.match(/^\d+$/);
  if (numericMatch) {
    return trimmed;
  }

  return null;
}

function readNdljpIdentifier(identifiers: Record<string, unknown>): string | null {
  const value = identifiers.ndljp;

  if (typeof value === "string") {
    return value;
  }

  return null;
}

export function resolveNextDigitalLibraryPid(
  record: Pick<RecordItem, "identifiers" | "content_access">
): NextDigitalLibraryPidResolution | null {
  const ndljpPid = extractPid(readNdljpIdentifier(record.identifiers));
  if (ndljpPid) {
    return {
      pid: ndljpPid,
      source: "ndljp"
    };
  }

  const viewerPid = extractPid(record.content_access.viewer_url);
  if (viewerPid) {
    return {
      pid: viewerPid,
      source: "viewer_url"
    };
  }

  return null;
}
