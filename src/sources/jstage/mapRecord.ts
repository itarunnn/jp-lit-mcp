import { normalizeIssuedAt } from "../../lib/date.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { PersonRole, RecordItem } from "../../lib/types.js";

type MetaMap = Map<string, string[]>;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function readMetaTags(html: string): MetaMap {
  const meta = new Map<string, string[]>();
  const pattern = /<meta\s+[^>]*name="([^"]+)"[^>]*content="([^"]*)"[^>]*>/gi;

  for (const match of html.matchAll(pattern)) {
    const name = normalizeText(match[1])?.toLowerCase();
    const content = normalizeText(decodeHtmlEntities(match[2]));

    if (!name || !content) {
      continue;
    }

    const values = meta.get(name) ?? [];
    values.push(content);
    meta.set(name, values);
  }

  return meta;
}

function first(meta: MetaMap, ...keys: string[]) {
  for (const key of keys) {
    const value = meta.get(key)?.[0];

    if (value) {
      return value;
    }
  }

  return null;
}

function list(meta: MetaMap, ...keys: string[]) {
  return compactStrings(keys.flatMap((key) => meta.get(key) ?? []));
}

function toIssuedFields(value: string | null) {
  const issuedAt = normalizeIssuedAt(value);

  if (issuedAt.issuedAtPrecision === "unknown") {
    return {
      issued_at: null,
      issued_at_label: issuedAt.issuedAtLabel,
      issued_at_precision: "unknown" as const
    };
  }

  return {
    issued_at: issuedAt.issuedAt,
    issued_at_label: issuedAt.issuedAtLabel,
    issued_at_precision: issuedAt.issuedAtPrecision
  };
}

function toAuthors(meta: MetaMap): PersonRole[] {
  return list(meta, "citation_author", "authors")
    .filter((name, index, array) => array.indexOf(name) === index)
    .map((name) => ({
      name,
      role: "author"
    }));
}

export function mapJstageRecordResponse(sourceId: string, html: string): RecordItem {
  const meta = readMetaTags(html);
  const url = first(meta, "og:url");
  const doi = first(meta, "citation_doi", "doi", "dc.identifier");
  const volume = first(meta, "citation_volume", "volume");
  const issue = first(meta, "citation_issue", "issue");
  const firstPage = first(meta, "citation_firstpage", "firstpage");
  const lastPage = first(meta, "citation_lastpage", "lastpage");
  const pdfUrl = first(meta, "citation_pdf_url", "pdf_url");
  const accessControl = first(meta, "access_control");
  const printIssn = first(meta, "print_issn", "issn_l") ?? list(meta, "citation_issn")[0] ?? null;
  const onlineIssn = first(meta, "online_issn");
  const keywords = list(meta, "citation_keywords", "keywords");

  const mainTitle = first(meta, "citation_title", "title", "og:title") ?? "Untitled";

  return {
    source: "jstage_articles",
    source_id: sourceId,
    title: mainTitle,
    subtitle: null,
    title_reading: null,
    authors: toAuthors(meta),
    publisher: first(meta, "citation_publisher", "publisher"),
    journal_title: first(meta, "citation_journal_title", "journal_title"),
    ...toIssuedFields(first(meta, "citation_publication_date", "publication_date")),
    summary: null,
    url,
    availability: {
      online: Boolean(url),
      digital_collection: false
    },
    alternative_titles: compactStrings([
      first(meta, "title"),
      first(meta, "og:title")
    ]).filter((value, index, array) => array.indexOf(value) === index && value !== mainTitle),
    publication_place: null,
    language: first(meta, "citation_language", "language"),
    material_type: "article",
    extent: compactStrings([
      volume ? `vol.${volume}` : null,
      issue ? `no.${issue}` : null,
      firstPage ? `pp.${firstPage}${lastPage ? `-${lastPage}` : ""}` : null
    ]).join(", ") || null,
    subjects: keywords,
    identifiers: {
      ...(doi ? { doi } : {}),
      ...(printIssn ? { issn: printIssn } : {}),
      ...(onlineIssn ? { eissn: onlineIssn } : {})
    },
    table_of_contents: [],
    content_access: {
      has_page_images: false,
      has_text_coordinates: false,
      viewer_url: pdfUrl ?? url,
      access_note: accessControl
    },
    source_metadata: {
      journal_title: first(meta, "citation_journal_title", "journal_title"),
      journal_code: first(meta, "journal_code"),
      volume,
      issue,
      first_page: firstPage,
      last_page: lastPage,
      online_date: first(meta, "citation_online_date", "online_date"),
      pdf_url: pdfUrl,
      copyright: first(meta, "copyright"),
      access_control: accessControl
    },
    raw: {
      meta: Object.fromEntries(meta.entries())
    }
  };
}
