import type { ManualViewingInfo, RecordItem } from "../../lib/types.js";
import {
  mapNdlSearchSearchEntry,
  readNdlSearchBoolean,
  readNdlSearchObject,
  readNdlSearchString,
  readNdlSearchStringList
} from "./mapSearch.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readMetaEntries(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      const record = asRecord(entry);

      return record ? [record] : [];
    });
  }

  const record = asRecord(value);

  return record ? [record] : [];
}

function readMetaField(
  meta: JsonRecord | null,
  key: string,
  fields: string[]
): string | null {
  if (!meta) {
    return null;
  }

  for (const entry of readMetaEntries(meta[key])) {
    for (const field of fields) {
      const value = readNdlSearchString(entry[field]);

      if (value) {
        return value;
      }
    }
  }

  return null;
}

function readMetaValue(meta: JsonRecord | null, key: string): string | null {
  return readMetaField(meta, key, ["v", "value"]);
}

function readMetaLabel(meta: JsonRecord | null, key: string): string | null {
  return readMetaField(meta, key, ["l", "label"]);
}

function readMetaList(meta: JsonRecord | null, key: string): string[] {
  if (!meta) {
    return [];
  }

  return readMetaEntries(meta[key]).flatMap((entry) =>
    readNdlSearchStringList(entry.v ?? entry.value)
  );
}

function readClassification(normalized: JsonRecord): {
  ndc: string[];
  ndlc: string[];
} {
  const classification = asRecord(normalized.classification);

  return {
    ndc: readNdlSearchStringList(classification?.ndc),
    ndlc: readNdlSearchStringList(classification?.ndlc)
  };
}

function readTocEntries(meta: JsonRecord | null): string[] {
  if (!meta) {
    return [];
  }

  return readMetaEntries(meta["t35050"]).flatMap((entry) => {
    const v = readNdlSearchString(entry.v ?? entry.value);
    if (!v || v === "目次") {
      return [];
    }
    const r = readNdlSearchString(entry.r);
    return [r ? `${v} (${r})` : v];
  });
}

function readTocEntriesPlain(meta: JsonRecord | null): string[] {
  if (!meta) {
    return [];
  }

  return readMetaEntries(meta["t35052"]).flatMap((entry) => {
    const v = readNdlSearchString(entry.v ?? entry.value);
    return v ? [v] : [];
  });
}

function aggregateToc(itemMetas: (JsonRecord | null)[]): string[] {
  const withPages = itemMetas.flatMap((meta) => readTocEntries(meta));
  if (withPages.length > 0) {
    return withPages;
  }
  return itemMetas.flatMap((meta) => readTocEntriesPlain(meta));
}

function aggregateSummary(itemMetas: (JsonRecord | null)[]): string | null {
  for (const meta of itemMetas) {
    const summary = readMetaValue(meta, "t35200");
    if (summary) {
      return summary;
    }
  }
  return null;
}

function buildManualViewingInfo(
  accessNote: string | null,
  transmissionLabels: string[],
  viewerUrl: string | null
): ManualViewingInfo | null {
  const individualTransmission = transmissionLabels.find((label) =>
    label.includes("個人送信")
  );
  if (individualTransmission) {
    return {
      available: true,
      access_type: "individual_transmission",
      label: individualTransmission,
      note: "MCPから全文は自動取得できませんが、NDLの登録利用者としてログインすれば手動で閲覧できます。",
      viewer_url: viewerUrl
    };
  }

  const libraryTransmission = transmissionLabels.find((label) =>
    label.includes("図書館送信")
  );
  if (libraryTransmission) {
    return {
      available: true,
      access_type: "library_transmission",
      label: libraryTransmission,
      note: "MCPから全文は自動取得できませんが、図書館向けデジタル化資料送信サービスの参加館で手動閲覧できる可能性があります。",
      viewer_url: viewerUrl
    };
  }

  if (accessNote?.includes("国立国会図書館内限定")) {
    return {
      available: true,
      access_type: "ndl_onsite_only",
      label: accessNote,
      note: "MCPから全文は自動取得できません。手動閲覧には国立国会図書館内の端末利用が必要です。",
      viewer_url: viewerUrl
    };
  }

  return null;
}

function normalizeViewerUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.hostname === "dl.ndl.go.jp" ? value : null;
  } catch {
    return null;
  }
}

function readMetaViewerUrl(meta: JsonRecord | null): string | null {
  return (
    normalizeViewerUrl(readMetaValue(meta, "k30012")) ??
    normalizeViewerUrl(readMetaField(meta, "k30012", ["i"])) ??
    normalizeViewerUrl(readMetaField(meta, "k31000", ["i"]))
  );
}

function readItemTypes(item: JsonRecord | null): string[] {
  if (!item) {
    return [];
  }

  return readNdlSearchStringList(item.type);
}

function scoreItemRecord(item: JsonRecord | null): number {
  if (!item) {
    return -1;
  }

  const meta = asRecord(item.meta);
  const itemTypes = readItemTypes(item);
  let score = 0;

  if (readMetaViewerUrl(meta)) {
    score += 4;
  }

  if (readMetaValue(meta, "k39022")) {
    score += 3;
  }

  if (readMetaValue(meta, "k80404")) {
    score += 2;
  }

  if (itemTypes.includes("digital")) {
    score += 2;
  }

  if (itemTypes.includes("accessible")) {
    score += 1;
  }

  return score;
}

function selectPreferredItemRecord(value: unknown): JsonRecord | null {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];
  const records = entries.flatMap((entry) => {
    const record = asRecord(entry);

    return record ? [record] : [];
  });

  if (records.length === 0) {
    return null;
  }

  return records.reduce((best, current) =>
    scoreItemRecord(current) > scoreItemRecord(best) ? current : best
  );
}

function normalizeRecordPayload(record: JsonRecord): {
  normalized: JsonRecord;
  raw: JsonRecord;
} | null {
  if (Array.isArray(record.list) && record.list.length === 0) {
    return null;
  }

  if (!Array.isArray(record.list)) {
    return {
      normalized: record,
      raw: record
    };
  }

  const listRecord = asRecord(record.list[0]) ?? {};
  const topMeta = asRecord(listRecord.meta);
  const itemRecord = selectPreferredItemRecord(listRecord.items);
  const itemMeta = asRecord(itemRecord?.meta);

  const rawItems = Array.isArray(listRecord.items)
    ? listRecord.items
    : listRecord.items != null
    ? [listRecord.items]
    : [];
  const allItemMetas = rawItems.flatMap((item) => {
    const r = asRecord(item);
    return r ? [asRecord(r.meta)] : [];
  });

  const sourceId = readNdlSearchString(listRecord.id ?? itemRecord?.id);
  const viewerUrl = readMetaViewerUrl(itemMeta);
  const accessNote = readMetaValue(itemMeta, "k39020");
  const transmissionLabels = readMetaList(itemMeta, "k39021");
  const providerName = readMetaValue(itemMeta, "k80404");
  const digitalCollection =
    readMetaValue(itemMeta, "k39022") !== null ||
    viewerUrl !== null ||
    providerName !== null;
  const identifiers: JsonRecord = {};
  const issn = readMetaValue(topMeta, "k00220");
  const issnl = readMetaValue(topMeta, "k28569");
  const ndljp = readMetaValue(itemMeta, "k31000");

  if (issn) {
    identifiers.issn = issn;
  }

  if (issnl) {
    identifiers.issnl = issnl;
  }

  if (ndljp) {
    identifiers.ndljp = ndljp;
  }

  return {
    normalized: {
      id: sourceId,
      title:
        readMetaValue(topMeta, "t02451") ?? readMetaValue(topMeta, "t02450"),
      authors: readMetaList(topMeta, "t0245c").map((name) => ({
        name,
        role: "author"
      })),
      publisher: readMetaValue(topMeta, "t02600"),
      url: sourceId
        ? `https://ndlsearch.ndl.go.jp/books/${sourceId}`
        : undefined,
      online: viewerUrl !== null,
      digitalCollection,
      alternativeTitles: readMetaList(topMeta, "t02460"),
      publicationPlace: readMetaLabel(topMeta, "t02600"),
      language: readMetaValue(topMeta, "k00410"),
      materialType: readMetaValue(topMeta, "k09022"),
      identifiers,
      tableOfContents: aggregateToc(allItemMetas),
      summary: aggregateSummary(allItemMetas),
      hasPageImages: viewerUrl !== null,
      hasTextCoordinates: false,
      viewerUrl,
      accessNote,
      manualViewing: buildManualViewingInfo(
        accessNote,
        transmissionLabels,
        viewerUrl
      ),
      providerId: null,
      providerName
    },
    raw: record
  };
}

export function mapNdlSearchRecordResponse(payload: unknown): RecordItem | null {
  const result = normalizeRecordPayload(asRecord(payload) ?? {});
  if (!result) {
    return null;
  }
  const { normalized, raw } = result;
  const base = mapNdlSearchSearchEntry(normalized);
  const classification = readClassification(normalized);
  const manualViewing = asRecord(
    normalized.manualViewing ?? normalized.manual_viewing
  ) as ManualViewingInfo | null;

  return {
    ...base,
    alternative_titles: readNdlSearchStringList(
      normalized.alternativeTitles ?? normalized.alternative_titles
    ),
    publication_place: readNdlSearchString(
      normalized.publicationPlace ?? normalized.publication_place
    ),
    language: readNdlSearchString(normalized.language),
    material_type: readNdlSearchString(
      normalized.materialType ?? normalized.material_type
    ),
    extent: readNdlSearchString(normalized.extent),
    subjects: readNdlSearchStringList(
      normalized.subjects ?? normalized.subject
    ),
    identifiers: readNdlSearchObject(normalized.identifiers),
    table_of_contents: readNdlSearchStringList(
      normalized.tableOfContents ?? normalized.table_of_contents
    ),
    content_access: {
      has_page_images: readNdlSearchBoolean(
        normalized.hasPageImages ?? normalized.has_page_images
      ),
      has_text_coordinates: readNdlSearchBoolean(
        normalized.hasTextCoordinates ?? normalized.has_text_coordinates
      ),
      viewer_url: readNdlSearchString(
        normalized.viewerUrl ?? normalized.viewer_url
      ),
      access_note: readNdlSearchString(
        normalized.accessNote ?? normalized.access_note
      ),
      ...(manualViewing ? { manual_viewing: manualViewing } : {})
    },
    source_metadata: {
      provider_id: readNdlSearchString(
        normalized.providerId ?? normalized.provider_id
      ),
      provider_name: readNdlSearchString(
        normalized.providerName ?? normalized.provider_name ?? normalized.provider
      ),
      raw_url: readNdlSearchString(normalized.rawUrl ?? normalized.raw_url),
      classification
    },
    raw
  };
}
