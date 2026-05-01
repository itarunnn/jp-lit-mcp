import { projectRssChannelXml } from "../../lib/xml.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import { readNdlSearchString, readNdlSearchStringList } from "./mapSearch.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function toRecordArray(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      const record = asRecord(entry);

      return record ? [record] : [];
    });
  }

  const record = asRecord(value);

  return record ? [record] : [];
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

function extractCiniiCrid(value: unknown): string | null {
  for (const url of readNdlSearchStringList(value)) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === "cir.nii.ac.jp" && parsed.pathname.startsWith("/crid/")) {
        const crid = parsed.pathname.replace(/^\/crid\//, "").replace(/[/.].*/s, "");
        if (crid) return crid;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function extractJournalTitle(descriptions: unknown): string | null {
  for (const desc of readNdlSearchStringList(descriptions)) {
    const match = desc.match(/^掲載誌：(.+)/);
    if (!match) continue;
    const afterPrefix = match[1];
    const title = afterPrefix.split(/ =| \/| p\./)[ 0]?.trim() ?? null;
    return title || null;
  }
  return null;
}

function extractSubjects(value: unknown): string[] {
  const results: string[] = [];

  for (const entry of toRecordArray(value)) {
    if ("@_rdf:resource" in entry || "rdf:resource" in entry) {
      continue;
    }
    const text = readNdlSearchString(entry);
    if (text) {
      results.push(text);
    }
  }

  return compactStrings(results);
}

function extractNdc(value: unknown): string[] {
  return compactStrings(
    toRecordArray(value).flatMap((entry) => {
      const datatype = normalizeText(
        readNdlSearchString(entry["@_rdf:datatype"] ?? entry["rdf:datatype"])
      )?.toLowerCase();
      const text = readNdlSearchString(entry);

      return datatype?.endsWith("/ndc") && text ? [text] : [];
    })
  );
}

function extractNdlc(value: unknown): string[] {
  return compactStrings(
    toRecordArray(value).flatMap((entry) => {
      const resource = readNdlSearchString(
        entry["@_rdf:resource"] ?? entry["rdf:resource"]
      );
      const match = resource?.match(/\/class\/ndlc\/([^/]+)$/i);

      return match?.[1] ? [match[1]] : [];
    })
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
    categories.includes("デジタル") || viewerUrl !== null;

  const ciniiCrid = extractCiniiCrid(item["rdfs:seeAlso"]);

  return {
    id: extractSourceId(url),
    ciniiCrid: ciniiCrid ?? null,
    title:
      readNdlSearchString(item["dc:title"]) ??
      readNdlSearchString(item.title) ??
      "Untitled",
    subtitle:
      readNdlSearchString(item["dcndl:volumeTitle"]) ??
      readNdlSearchString(item["dcndl:volume"]),
    authors: toAuthors(item["dc:creator"] ?? item.author),
    publisher:
      readNdlSearchString(item["dc:publisher"]) ??
      readNdlSearchString(item["dcterms:publisher"]),
    issued: (() => {
      const structured =
        readNdlSearchString(item["dcterms:issued"]) ??
        readNdlSearchString(item["dc:date"]);
      if (structured) return structured;
      const pubDate = readNdlSearchString(item.pubDate);
      if (!pubDate) return null;
      const year = new Date(pubDate).getFullYear();
      return isNaN(year) ? null : String(year);
    })(),
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
    subjects: extractSubjects(item["dcterms:subject"]),
    classification: {
      ndc: extractNdc(item["dc:subject"]),
      ndlc: extractNdlc(item["dcterms:subject"])
    },
    viewerUrl,
    accessNote,
    hasPageImages: viewerUrl !== null,
    hasTextCoordinates: false,
    journalTitle: extractJournalTitle(item["dc:description"])
  };
}

export function projectNdlSearchLegacyRssXml(xml: string): JsonRecord {
  const projected = projectRssChannelXml(xml);
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

export function projectNdlSearchDetailXml(xml: string): JsonRecord {
  return projectNdlSearchLegacyRssXml(xml);
}

export function projectNdlSearchOpenSearchXml(xml: string): JsonRecord {
  return projectNdlSearchLegacyRssXml(xml);
}
