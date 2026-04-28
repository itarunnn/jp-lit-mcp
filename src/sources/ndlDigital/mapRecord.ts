import type { RecordItem } from "../../lib/types.js";
import {
  mapNdlSearchRecordResponse
} from "../ndlSearch/mapRecord.js";
import {
  readNdlSearchBoolean,
  readNdlSearchString
} from "../ndlSearch/mapSearch.js";

function inferViewerUrl(raw: Record<string, unknown>): string | null {
  const explicit =
    readNdlSearchString(raw.viewerUrl) ??
    readNdlSearchString(raw.viewer_url) ??
    readNdlSearchString(raw["dcndl:viewer"]);

  if (explicit) {
    return explicit;
  }

  const rawUrl =
    readNdlSearchString(raw.url) ??
    readNdlSearchString(raw.link) ??
    readNdlSearchString(raw["rdfs:seeAlso"]);

  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);

    return url.hostname === "dl.ndl.go.jp" ? rawUrl : null;
  } catch {
    return null;
  }
}

function readProviderId(raw: Record<string, unknown>): string | null {
  return (
    readNdlSearchString(raw.providerId) ??
    readNdlSearchString(raw.provider_id) ??
    readNdlSearchString(raw.dpid)
  );
}

function readProviderName(raw: Record<string, unknown>): string | null {
  return (
    readNdlSearchString(raw.providerName) ??
    readNdlSearchString(raw.provider_name) ??
    readNdlSearchString(raw.provider)
  );
}

function isNdlDigitalRecord(
  raw: Record<string, unknown>,
  base: RecordItem
): boolean {
  const providerId = readProviderId(raw);
  const providerName =
    readProviderName(raw) ?? base.source_metadata.provider_name ?? null;
  const hasNestedItems = Array.isArray(raw.list) && raw.list.length > 0;
  const isDigitalCollection =
    readNdlSearchBoolean(raw.digitalCollection) ||
    readNdlSearchBoolean(raw.digital_collection) ||
    (hasNestedItems && base.availability.digital_collection);

  if (providerId !== null) {
    return providerId === "ndl-dl" && isDigitalCollection;
  }

  return (
    isDigitalCollection &&
    providerName === "国立国会図書館デジタルコレクション"
  );
}

export function mapNdlDigitalRecordResponse(payload: unknown): RecordItem | null {
  const base = mapNdlSearchRecordResponse(payload);
  if (!base) {
    return null;
  }
  const raw = base.raw;
  if (!isNdlDigitalRecord(raw, base)) {
    return null;
  }

  const providerId = readProviderId(raw);
  const providerName =
    readProviderName(raw) ??
    base.source_metadata.provider_name ??
    (providerId?.startsWith("ndl-dl")
      ? "国立国会図書館デジタルコレクション"
      : null);
  const viewerUrl = inferViewerUrl(raw) ?? base.content_access.viewer_url;
  const accessNote =
    base.content_access.access_note ??
    readNdlSearchString(raw.accessNote) ??
    readNdlSearchString(raw.access_note);

  return {
    ...base,
    source: "ndl_digital",
    availability: {
      ...base.availability,
      digital_collection: true
    },
    table_of_contents: base.table_of_contents,
    content_access: {
      has_page_images:
        base.content_access.has_page_images ||
        readNdlSearchBoolean(raw.hasPageImages) ||
        readNdlSearchBoolean(raw.has_page_images),
      has_text_coordinates:
        base.content_access.has_text_coordinates ||
        readNdlSearchBoolean(raw.hasTextCoordinates) ||
        readNdlSearchBoolean(raw.has_text_coordinates),
      viewer_url: viewerUrl,
      access_note: accessNote
    },
    source_metadata: {
      ...base.source_metadata,
      provider_id: providerId,
      provider_name: providerName,
      raw_url:
        readNdlSearchString(raw.rawUrl) ??
        readNdlSearchString(raw.raw_url) ??
        base.source_metadata.raw_url ??
        null
    }
  };
}
