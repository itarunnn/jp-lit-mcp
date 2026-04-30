import { normalizeIssuedAt } from "../../lib/date.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import type { PersonRole, RecordItem } from "../../lib/types.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return compactStrings(value.map((v) => (typeof v === "string" ? v : null)));
  }
  if (typeof value === "string") return [value];
  return [];
}

function stripPipeSuffix(s: string): string {
  const idx = s.indexOf("||");
  return idx === -1 ? s.trim() : s.slice(0, idx).trim();
}

function stripIdMarkup(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\|\|.*$/, "").trim();
}

function toIssuedFields(value: string | null) {
  const info = normalizeIssuedAt(value);
  if (info.issuedAtPrecision === "unknown") {
    return {
      issued_at: null,
      issued_at_label: info.issuedAtLabel,
      issued_at_precision: "unknown" as const
    };
  }
  return {
    issued_at: info.issuedAt,
    issued_at_label: info.issuedAtLabel,
    issued_at_precision: info.issuedAtPrecision
  };
}

function toAuthors(creators: string[]): PersonRole[] {
  return compactStrings(creators.map((c) => stripIdMarkup(c))).map((name) => ({
    name,
    role: "author"
  }));
}

export function mapNihuBridgeRecordResponse(payload: unknown): RecordItem | null {
  const record = asRecord(payload) ?? {};
  const rr = asRecord(record.researchResource);
  if (!rr) return null;

  const titles = asStringArray(rr.title);
  const headTitle = titles[0];
  if (!headTitle) return null;
  const title = stripPipeSuffix(headTitle) || "Untitled";
  const reading = (() => {
    const idx = headTitle.indexOf("||");
    if (idx === -1) return null;
    const r = headTitle.slice(idx + 2).trim();
    return r.length > 0 ? r : null;
  })();

  const altTitlesRaw = asStringArray(rr.alternativeTitle);
  const tailTitles = titles.slice(1);
  const alternative_titles = compactStrings(
    [...tailTitles, ...altTitlesRaw].map(stripPipeSuffix)
  );

  const creators = asStringArray(rr.creator);
  const contributors = asStringArray(rr.contributor);
  const authorEntries = toAuthors(creators);

  const publisher = normalizeText(asStringArray(rr.publisher)[0] ?? null);
  const description = normalizeText(asStringArray(rr.description)[0] ?? null);
  const subjects = compactStrings(
    [...asStringArray(rr.subject), ...asStringArray(rr.keyword)].map(stripPipeSuffix)
  );
  const language = normalizeText(asStringArray(rr.inLanguage)[0] ?? null);
  const materialType = normalizeText(asStringArray(rr.type)[0] ?? null);

  const temporalArr = Array.isArray(rr.temporal) ? rr.temporal : [];
  const temporalHead = asRecord(temporalArr[0]);
  const temporalDate =
    typeof temporalHead?.date === "string" ? temporalHead.date : null;
  const stripTimePart = (s: string) => { const i = s.indexOf("T"); return i === -1 ? s : s.slice(0, i); };
  const issuedSource =
    (temporalDate ? stripTimePart(temporalDate.split(",")[0]?.trim() ?? "") || null : null) ??
    (typeof rr.datePublished === "string" ? rr.datePublished : null);

  const spatialArr = Array.isArray(rr.spatial) ? rr.spatial : [];
  const spatialHead = asRecord(spatialArr[0]);
  const spatialDescription =
    compactStrings(asStringArray(spatialHead?.description)).join(" / ") || null;
  const spatialPlace =
    compactStrings(asStringArray(spatialHead?.place)).join(" / ") || null;

  const linkArr = Array.isArray(rr.link) ? rr.link : [];

  const databaseId = typeof rr.databaseId === "string" ? rr.databaseId : null;
  const researchResourceId =
    typeof rr.researchResourceId === "string" ? rr.researchResourceId : "";
  const url = `https://bridge.nihu.jp/integrated_searchresults_detail/${researchResourceId}`;
  const doi = typeof rr.doi === "string" ? rr.doi : null;
  const originalIds = asStringArray(rr.originalId);
  const license = normalizeText(asStringArray(rr.license)[0] ?? null);

  return {
    source: "nihu_bridge",
    source_id: researchResourceId,
    title,
    subtitle: null,
    title_reading: reading,
    authors: authorEntries,
    publisher,
    journal_title: null,
    ...toIssuedFields(issuedSource),
    summary: description,
    url,
    availability: {
      online: Boolean(url),
      digital_collection: false
    },
    alternative_titles,
    publication_place: null,
    language,
    material_type: materialType,
    extent: null,
    subjects,
    identifiers: {
      research_resource_id: researchResourceId,
      ...(databaseId ? { database_id: databaseId } : {}),
      ...(doi ? { doi } : {}),
      ...(originalIds.length > 0 ? { original_ids: originalIds } : {})
    },
    table_of_contents: [],
    content_access: {
      has_page_images: false,
      has_text_coordinates: false,
      viewer_url: url,
      access_note: license
    },
    source_metadata: {
      database_id: databaseId,
      research_resource_id: researchResourceId,
      doi,
      contributor: contributors.length > 0 ? contributors : null,
      temporal: temporalDate,
      spatial_description: spatialDescription,
      spatial_place: spatialPlace,
      license,
      links: linkArr
    },
    raw: record
  };
}
