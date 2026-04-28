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

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "));
}

function cleanText(value: string | null | undefined): string | null {
  return normalizeText(value ? stripTags(value).replace(/\s+/g, " ").trim() : null);
}

function readMetaTags(html: string): MetaMap {
  const meta = new Map<string, string[]>();
  const pattern = /<meta\s+[^>]*name="([^"]+)"[^>]*content="([^"]*)"[^>]*>/gi;

  for (const match of html.matchAll(pattern)) {
    const name = normalizeText(match[1])?.toLowerCase();
    const content = cleanText(match[2]);

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

function matchRow(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<tr>\\s*<th>${escaped}<\\/th>\\s*<td>([\\s\\S]*?)<\\/td>\\s*<\\/tr>`,
    "i"
  );

  return html.match(pattern)?.[1] ?? null;
}

function extractListItems(html: string | null) {
  if (!html) {
    return [];
  }

  const matches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  if (matches.length === 0) {
    const single = cleanText(html);
    return single ? [single] : [];
  }

  return compactStrings(matches.map((match) => cleanText(match[1])));
}

function extractLabeledValue(html: string | null, label: string) {
  if (!html) {
    return null;
  }

  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `${escaped}<\\/span>\\s*([^<\\n]+)`,
    "i"
  );

  return cleanText(html.match(pattern)?.[1] ?? null);
}

function extractFirstLink(html: string | null) {
  if (!html) {
    return null;
  }

  return cleanText(html.match(/<a [^>]*href="([^"]+)"/i)?.[1] ?? null);
}

function extractFileMimeType(html: string | null) {
  if (!html) {
    return null;
  }

  return cleanText(html.match(/\(([^()]+\/[^()]+)\)/i)?.[1] ?? null);
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

function toAuthors(meta: MetaMap, creatorsHtml: string | null): PersonRole[] {
  const metaAuthors = list(meta, "citation_author").map((name) => ({
    name,
    role: "author"
  }));

  if (metaAuthors.length > 0) {
    return metaAuthors;
  }

  return extractListItems(creatorsHtml).map((name) => ({
    name,
    role: "author"
  }));
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return compactStrings(values).filter(
    (value, index, array) => array.indexOf(value) === index
  );
}

export function mapIrdbRecordResponse(sourceId: string, html: string): RecordItem {
  const meta = readMetaTags(html);
  const titleRow = matchRow(html, "タイトル");
  const creatorsRow = matchRow(html, "作成者");
  const descriptionRow = matchRow(html, "内容注記");
  const publisherRow = matchRow(html, "出版者");
  const dateRow = matchRow(html, "日付");
  const languageRow = matchRow(html, "言語");
  const resourceTypeRow = matchRow(html, "資源タイプ");
  const publicationTypeRow = matchRow(html, "出版タイプ");
  const identifierRow = matchRow(html, "資源識別子");
  const journalRow = matchRow(html, "収録誌情報");
  const fileRow = matchRow(html, "ファイル");
  const updatedRow = matchRow(html, "コンテンツ更新日時");
  const repositoryRow = html.match(
    /<div class="panel-heading">([\s\S]*?)<\/div>/i
  )?.[1] ?? null;
  const titleMain = first(meta, "citation_title") ?? extractListItems(titleRow)[0] ?? "Untitled";
  const titleReading = extractLabeledValue(titleRow, "ja-Kana");
  const englishTitle = extractLabeledValue(titleRow, "en");
  const summaryCandidates = extractListItems(descriptionRow).filter(
    (value) => value !== "application/pdf"
  );
  const issuedAtLabel =
    extractLabeledValue(dateRow, "Issued") ??
    cleanText(dateRow);
  const sourceUri = extractFirstLink(identifierRow);
  const fileUrl = extractFirstLink(fileRow);
  const fileMimeType = extractFileMimeType(fileRow);
  const journalTitle =
    extractLabeledValue(journalRow, "ja") ??
    extractLabeledValue(journalRow, "en");
  const journalIssn = extractLabeledValue(journalRow, "PISSN");
  const journalNcid = extractLabeledValue(journalRow, "NCID");
  const startingPage = extractLabeledValue(journalRow, "開始ページ");
  const endingPage = extractLabeledValue(journalRow, "終了ページ");
  const volume = extractLabeledValue(journalRow, "巻");
  const number = extractLabeledValue(journalRow, "号");
  const url = first(meta, "og:url") ?? `https://irdb.nii.ac.jp${sourceId}`;

  return {
    source: "irdb",
    source_id: sourceId,
    title: titleMain,
    subtitle: null,
    title_reading: titleReading,
    authors: toAuthors(meta, creatorsRow),
    publisher:
      extractLabeledValue(publisherRow, "ja") ??
      extractLabeledValue(publisherRow, "en") ??
      cleanText(publisherRow),
    journal_title: journalTitle,
    ...toIssuedFields(issuedAtLabel),
    summary:
      extractLabeledValue(descriptionRow, "ja") ??
      extractLabeledValue(descriptionRow, "en") ??
      summaryCandidates[0] ??
      null,
    url,
    availability: {
      online: true,
      digital_collection: false
    },
    alternative_titles: uniqueStrings([englishTitle]),
    publication_place: null,
    language: extractListItems(languageRow)[0] ?? null,
    material_type: cleanText(resourceTypeRow),
    extent: uniqueStrings([
      volume ? `vol.${volume}` : null,
      number ? `no.${number}` : null,
      startingPage ? `pp.${startingPage}${endingPage ? `-${endingPage}` : ""}` : null
    ]).join(", ") || null,
    subjects: [],
    identifiers: {
      ...(sourceUri ? { uri: sourceUri } : {}),
      ...(journalIssn ? { pissn: journalIssn } : {}),
      ...(journalNcid ? { ncid: journalNcid } : {})
    },
    table_of_contents: [],
    content_access: {
      has_page_images: false,
      has_text_coordinates: false,
      viewer_url: fileUrl ?? sourceUri ?? url,
      access_note: fileMimeType
    },
    source_metadata: {
      irname: cleanText(repositoryRow),
      repository_name: cleanText(repositoryRow),
      source_uri: sourceUri,
      publication_type: cleanText(publicationTypeRow),
      resource_type: cleanText(resourceTypeRow),
      journal_issn: journalIssn,
      journal_ncid: journalNcid,
      journal_volume: volume,
      journal_number: number,
      starting_page: startingPage,
      ending_page: endingPage,
      file_url: fileUrl,
      file_mime_type: fileMimeType,
      record_updated_at: cleanText(updatedRow)
    },
    raw: {
      meta: Object.fromEntries(meta.entries()),
      sections: {
        title: titleRow,
        creators: creatorsRow,
        description: descriptionRow,
        publisher: publisherRow,
        date: dateRow,
        identifiers: identifierRow,
        journal: journalRow,
        file: fileRow
      }
    }
  };
}
