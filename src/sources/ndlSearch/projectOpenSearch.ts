import { projectOpenSearchXml } from "../../lib/xml.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import { readNdlSearchString, readNdlSearchStringList } from "./mapSearch.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readTypedIdentifiers(value: unknown): Record<string, string> {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];
  const identifiers: Record<string, string> = {};

  for (const entry of entries) {
    const record = asRecord(entry);
    const text = readNdlSearchString(record?.["#text"] ?? entry);
    const type = normalizeText(
      readNdlSearchString(record?.["@_xsi:type"]) ??
        readNdlSearchString(record?.["xsi:type"])
    )?.toLowerCase();

    if (!text || !type) {
      continue;
    }

    if (type.endsWith("issn")) {
      identifiers.issn = text;
      continue;
    }

    if (type.endsWith("issnl")) {
      identifiers.issnl = text;
      continue;
    }

    if (type.endsWith("ndljp")) {
      identifiers.ndljp = text;
    }
  }

  return identifiers;
}

function extractSourceId(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? null;
  } catch {
    return null;
  }
}

function pickViewerUrl(value: unknown): string | null {
  return (
    readNdlSearchStringList(value).find((entry) => {
      try {
        return new URL(entry).hostname === "dl.ndl.go.jp";
      } catch {
        return false;
      }
    }) ?? null
  );
}

function toAuthors(value: unknown): Array<{ name: string; role: "author" }> {
  return compactStrings(readNdlSearchStringList(value)).map((name) => ({
    name,
    role: "author"
  }));
}

function projectItem(value: unknown): JsonRecord {
  const item = asRecord(value) ?? {};
  const url = readNdlSearchString(item.link) ?? readNdlSearchString(item.url);
  const categories = compactStrings(readNdlSearchStringList(item.category));
  const viewerUrl = pickViewerUrl(item["rdfs:seeAlso"]);
  const accessNote = readNdlSearchString(item["dcndl:access"]);
  const providerName = readNdlSearchString(item["dcndl:provider"]);
  const digitalCollection =
    categories.includes("デジタル") || viewerUrl !== null || providerName !== null;

  return {
    id: extractSourceId(url),
    title:
      readNdlSearchString(item["dc:title"]) ??
      readNdlSearchString(item.title) ??
      "Untitled",
    authors: toAuthors(item["dc:creator"] ?? item.author),
    publisher:
      readNdlSearchString(item["dc:publisher"]) ??
      readNdlSearchString(item["dcterms:publisher"]),
    url,
    online: accessNote !== null,
    digitalCollection,
    providerId: null,
    providerName,
    alternativeTitles: compactStrings(
      readNdlSearchStringList(item["dcndl:alternative"])
    ),
    publicationPlace: readNdlSearchString(item["dcndl:publicationPlace"]),
    language:
      readNdlSearchString(item["dc:language"]) ??
      readNdlSearchString(item["dcterms:language"]),
    materialType: categories.find((category) => category !== "デジタル") ?? null,
    identifiers: readTypedIdentifiers(item["dc:identifier"]),
    viewerUrl,
    accessNote,
    hasPageImages: viewerUrl !== null,
    hasTextCoordinates: false
  };
}

export function projectNdlSearchOpenSearchXml(xml: string): JsonRecord {
  const projected = projectOpenSearchXml(xml);
  const items = projected.items.map((item) => projectItem(item));
  const totalResults =
    readNdlSearchString(projected.channel["openSearch:totalResults"]) ?? null;
  const root: JsonRecord = {
    rss: projected.rss
      ? {
          ...projected.rss,
          channel: {
            ...projected.channel,
            item: items
          }
        }
      : null,
    channel: {
      ...projected.channel,
      item: items
    },
    totalResults,
    items
  };

  if (items.length === 1) {
    Object.assign(root, items[0]);
  }

  return root;
}
