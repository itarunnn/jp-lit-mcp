import type { XmlObject } from "../../lib/xml.js";
import { parseSruXml } from "../../lib/xml.js";
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

function removeFragment(url: string | null): string | null {
  if (!url) {
    return null;
  }

  return url.replace(/#.*$/, "");
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

function extractTypedIdentifiers(value: unknown): Record<string, string> {
  const identifiers: Record<string, string> = {};

  for (const entry of toRecordArray(value)) {
    const datatype = normalizeText(entry["@_rdf:datatype"] as string | null)?.toLowerCase();
    const text = readNdlSearchString(entry);

    if (!datatype || !text) {
      continue;
    }

    if (datatype.endsWith("/issn")) {
      identifiers.issn = text;
      continue;
    }

    if (datatype.endsWith("/issnl")) {
      identifiers.issnl = text;
      continue;
    }

    if (datatype.endsWith("/ndlbibid")) {
      identifiers.ndlbibid = text;
      continue;
    }

    if (datatype.endsWith("/jpno")) {
      identifiers.jpno = text;
      continue;
    }

    if (datatype.endsWith("/niibibid")) {
      identifiers.niibibid = text;
    }
  }

  return identifiers;
}

function extractProviderName(adminResource: JsonRecord | null): string | null {
  if (!adminResource) {
    return null;
  }

  return readNdlSearchString(adminResource["dcterms:provenance"]);
}

function flattenResourceLinks(...values: unknown[]): string[] {
  return compactStrings(
    values.flatMap((value) => readNdlSearchStringList(value))
  );
}

function pickUrl(links: string[], aboutUrl: string | null): string | null {
  const ndlBooksLink = links.find((link) => {
    try {
      const url = new URL(link);

      return (
        url.hostname === "ndlsearch.ndl.go.jp" &&
        url.pathname.startsWith("/books/")
      );
    } catch {
      return false;
    }
  });

  return ndlBooksLink ?? removeFragment(aboutUrl);
}

function pickViewerUrl(links: string[]): string | null {
  return (
    links.find((link) => {
      try {
        return new URL(link).hostname === "dl.ndl.go.jp";
      } catch {
        return false;
      }
    }) ?? null
  );
}

function extractCiniiCrid(links: string[]): string | null {
  for (const link of links) {
    try {
      const url = new URL(link);
      if (url.hostname === "cir.nii.ac.jp" && url.pathname.startsWith("/crid/")) {
        const crid = url.pathname.replace(/^\/crid\//, "").replace(/[/.].*/s, "");

        if (crid) {
          return crid;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function readTitleTranscription(dcTitle: unknown): string | null {
  const record = asRecord(dcTitle);
  if (!record) {
    return null;
  }

  const desc = asRecord(record["rdf:Description"]);
  if (!desc) {
    return null;
  }

  return readNdlSearchString(desc["dcndl:transcription"]);
}

function extractSubjects(value: unknown): string[] {
  const results: string[] = [];

  for (const entry of toRecordArray(value)) {
    if ("@_rdf:resource" in entry) {
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
      const datatype = normalizeText(entry["@_rdf:datatype"] as string | null)?.toLowerCase();
      const text = readNdlSearchString(entry);

      return datatype && /\/ndc\d*$/.test(datatype) && text ? [text] : [];
    })
  );
}

function extractNdlc(value: unknown): string[] {
  return compactStrings(
    toRecordArray(value).flatMap((entry) => {
      const resource = readNdlSearchString(entry["@_rdf:resource"]);
      const match = resource?.match(/\/class\/ndlc\/([^/]+)$/i);

      return match?.[1] ? [match[1]] : [];
    })
  );
}

function readMaterialTypeLabel(value: unknown): string | null {
  const entries = toRecordArray(value);

  for (const entry of entries) {
    const label = readNdlSearchString(entry["@_rdfs:label"] ?? entry.rdfs_label ?? entry.label);

    if (label) {
      return label;
    }
  }

  return readNdlSearchString(value);
}

function pickBibResource(rdf: JsonRecord): JsonRecord | null {
  const resources = toRecordArray(rdf["dcndl:BibResource"]);

  if (resources.length === 0) {
    return null;
  }

  return (
    resources.find((resource) =>
      Boolean(
        readNdlSearchString(resource["dcterms:title"]) ??
          readNdlSearchString(resource["dc:title"])
      )
    ) ?? resources[0] ?? null
  );
}

function pickBibAdminResource(rdf: JsonRecord): JsonRecord | null {
  const resources = toRecordArray(rdf["dcndl:BibAdminResource"]);

  return resources[0] ?? null;
}

function pickItemRecords(rdf: JsonRecord): JsonRecord[] {
  return toRecordArray(rdf["dcndl:Item"]);
}

function parseFacetGroup(extraResponseData: XmlObject | null, groupName: string) {
  if (!extraResponseData) {
    return {};
  }

  const facets = asRecord(extraResponseData.facets) ?? extraResponseData;
  const lists = toRecordArray(facets.lst);
  const target = lists.find((entry) => readNdlSearchString(entry["@_name"]) === groupName);

  if (!target) {
    return {};
  }

  const result: Record<string, number> = {};
  for (const entry of toRecordArray(target.int)) {
    const name = readNdlSearchString(entry["@_name"]);
    const count = Number(readNdlSearchString(entry));

    if (!name || !Number.isFinite(count)) {
      continue;
    }

    result[name] = count;
  }

  return result;
}

function projectRecord(record: JsonRecord): JsonRecord | null {
  const recordData = asRecord(record.recordData);
  const rdf = asRecord(recordData?.["rdf:RDF"]);
  const bib = rdf ? pickBibResource(rdf) : null;

  if (!rdf || !bib) {
    return null;
  }

  const admin = pickBibAdminResource(rdf);
  const itemRecords = pickItemRecords(rdf);
  const aboutUrl = removeFragment(readNdlSearchString(bib["@_rdf:about"]));
  const itemLinks = flattenResourceLinks(
    ...itemRecords.map((entry) => entry["rdfs:seeAlso"]),
    ...itemRecords.map((entry) => entry["dcterms:relation"])
  );
  const bibLinks = flattenResourceLinks(
    bib["rdfs:seeAlso"],
    bib["dcterms:relation"]
  );
  const allLinks = compactStrings([...itemLinks, ...bibLinks]);
  const viewerUrl = pickViewerUrl(allLinks);
  const accessNote =
    readNdlSearchString(bib["dcterms:accessRights"]) ??
    readNdlSearchString(bib["dcndl:access"]);
  const materialType = readMaterialTypeLabel(bib["dcndl:materialType"]);
  const digitalCollection =
    viewerUrl !== null ||
    materialType === "オンライン資料" ||
    readNdlSearchString(bib["dcndl:collection"]) !== null ||
    readNdlSearchString(bib["dcterms:description"])?.includes("国立国会図書館デジタルコレクション") === true;

  return {
    id: extractSourceId(aboutUrl),
    ciniiCrid: extractCiniiCrid(allLinks),
    title: bib["dcterms:title"] ?? bib["dc:title"] ?? "Untitled",
    titleReading: readTitleTranscription(bib["dc:title"]),
    subtitle:
      bib["dcndl:volumeTitle"] ??
      bib["dcndl:volume"] ??
      bib["dcndl:seriesTitle"] ??
      null,
    creator: bib["dcterms:creator"] ?? bib["dc:creator"] ?? null,
    publisher: bib["dcterms:publisher"] ?? bib["dc:publisher"] ?? null,
    issued: bib["dcterms:issued"] ?? bib["dcterms:date"] ?? null,
    url: pickUrl(allLinks, aboutUrl),
    online: accessNote !== null || viewerUrl !== null,
    digitalCollection,
    providerId: null,
    providerName: extractProviderName(admin),
    alternativeTitles: readNdlSearchStringList(
      bib["dcndl:alternative"] ?? bib["dcterms:alternative"]
    ),
    publicationPlace: bib["dcndl:publicationPlace"] ?? null,
    language: bib["dcterms:language"] ?? bib["dc:language"] ?? null,
    materialType,
    identifiers: extractTypedIdentifiers(bib["dcterms:identifier"]),
    subjects: extractSubjects(bib["dcterms:subject"]),
    classification: {
      ndc: extractNdc(bib["dc:subject"]),
      ndlc: extractNdlc(bib["dcterms:subject"])
    },
    tableOfContents: readNdlSearchStringList(bib["dcterms:tableOfContents"]),
    viewerUrl,
    accessNote,
    hasPageImages: viewerUrl !== null,
    hasTextCoordinates: false,
    journalTitle: bib["dcndl:publicationName"] ?? null,
    relation: bib["dcterms:relation"] ?? null,
    seeAlso: bib["rdfs:seeAlso"] ?? null
  };
}

export function projectNdlSruSearchResponse(xml: string): JsonRecord {
  const parsed = parseSruXml(xml);
  const items = parsed.records
    .flatMap((record) => {
      const projected = projectRecord(record);

      return projected ? [projected] : [];
    });

  return {
    totalResults: String(parsed.numberOfRecords),
    items,
    facets: {
      providers: parseFacetGroup(parsed.extraResponseData, "REPOSITORY_NO"),
      ndc: parseFacetGroup(parsed.extraResponseData, "NDC"),
      issued_years: parseFacetGroup(parsed.extraResponseData, "ISSUED_DATE")
    }
  };
}
