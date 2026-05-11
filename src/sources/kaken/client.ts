import { fetchText } from "../../lib/http.js";
import { parseXml } from "../../lib/xml.js";
import type {
  SearchKakenProjectsInput,
  SearchKakenProjectsOutput
} from "../../lib/schemas.js";

const DEFAULT_SEARCH_URL = "https://kaken.nii.ac.jp/opensearch/";
const DEFAULT_DETAIL_BASE_URL = "https://kaken.nii.ac.jp/ja/grant/";
const CAUTION =
  "KAKEN は研究課題・報告書の入口です。成果リスト中の論文・図書は、CiNii / J-STAGE / IRDB / NDL などで文献として確認してください。";

type Fetcher = typeof fetchText;
type KakenSearchInput = Omit<SearchKakenProjectsInput, "force_refresh">;
type KakenProject = SearchKakenProjectsOutput["items"][number];
type KakenOutput = KakenProject["outputs_preview"][number];

interface KakenClientOptions {
  searchUrl?: string;
  detailBaseUrl?: string;
  appId?: string;
  fetcher?: Fetcher;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return asArray(value).filter(isRecord);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

function attr(record: Record<string, unknown>, name: string) {
  return asString(record[`@_${name}`]);
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return asString(value);
  if (typeof value === "number") return String(value);
  if (isRecord(value)) return asString(value["#text"]);
  return null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function splitSlashList(value: string | null) {
  if (!value) return [];
  return unique(value.split(/\s*\/\s*/));
}

function firstText(record: Record<string, unknown>, key: string) {
  return textOf(record[key]);
}

function normalizeProjectId(awardNumber: string | null, id: string | null) {
  const raw = awardNumber ?? id ?? "";
  return raw.replace(/^KAKENHI-PROJECT-/, "");
}

function normalizeKakenUrl(url: string | null, projectId: string, detailBaseUrl: string) {
  const fallback = new URL(`KAKENHI-PROJECT-${projectId}/`, detailBaseUrl).toString();
  const value = url ?? fallback;
  if (value.includes("/ja/grant/")) return value;
  return value.replace("https://kaken.nii.ac.jp/grant/", "https://kaken.nii.ac.jp/ja/grant/");
}

function buildAffiliation(member: Record<string, unknown>) {
  return unique([
    textOf(member.institution),
    textOf(member.department),
    textOf(member.jobTitle)
  ].flatMap((value) => (value ? [value] : []))).join(" ") || null;
}

function findPrincipalInvestigator(summary: Record<string, unknown>) {
  const member = asRecordArray(summary.member).find(
    (entry) => attr(entry, "role") === "principal_investigator"
  );
  if (!member) return null;
  const personalName = isRecord(member.personalName) ? member.personalName : {};
  const enriched = isRecord(member.enriched) ? member.enriched : {};
  const name = textOf(personalName.fullName);
  if (!name) return null;

  return {
    name,
    affiliation: buildAffiliation(member),
    researcher_number:
      textOf(enriched.researcherNumber) ?? attr(member, "eradCode")
  };
}

function extractKeywords(summary: Record<string, unknown>) {
  const keywordList = isRecord(summary.keywordList) ? summary.keywordList : {};
  return unique(asArray(keywordList.keyword).flatMap((keyword) => {
    const value = textOf(keyword);
    return value ? [value] : [];
  }));
}

function extractSummary(summary: Record<string, unknown>) {
  const paragraphList = isRecord(summary.paragraphList) ? summary.paragraphList : {};
  const paragraphs = asArray(paragraphList.paragraph)
    .flatMap((paragraph) => {
      const value = textOf(paragraph);
      return value ? [value] : [];
    });
  return paragraphs.length > 0 ? paragraphs.join("\n") : null;
}

function extractFiscalYears(summary: Record<string, unknown>) {
  const period = isRecord(summary.periodOfAward) ? summary.periodOfAward : {};
  const start = textOf(period.startDate);
  const end = textOf(period.endDate);
  if (start && end) return `${start} - ${end}`;
  return start ?? end;
}

function mapGrantAward(
  grantAward: Record<string, unknown>,
  detailBaseUrl: string
): KakenProject {
  const summary = isRecord(grantAward.summary) ? grantAward.summary : {};
  const projectId = normalizeProjectId(attr(grantAward, "awardNumber"), attr(grantAward, "id"));
  const urlList = isRecord(grantAward.urlList) ? grantAward.urlList : {};
  const url = normalizeKakenUrl(textOf(asArray(urlList.url)[0]), projectId, detailBaseUrl);
  const title = firstText(summary, "title") ?? projectId;
  const principalInvestigator = findPrincipalInvestigator(summary);
  const keywords = extractKeywords(summary);

  return {
    project_id: projectId,
    title,
    url,
    principal_investigator: principalInvestigator,
    fiscal_years: extractFiscalYears(summary),
    project_type: textOf(summary.category),
    fields: [],
    keywords,
    summary: extractSummary(summary),
    detail_fetched: false,
    detail_omitted_reason: null,
    report_pdf_status: "not_checked",
    report_pdfs: [],
    outputs_preview: [],
    search_hints: buildSearchHints(title, principalInvestigator, keywords)
  };
}

function extractTableCell(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(`<tr[^>]*>\\s*<th[^>]*>\\s*${escaped}\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>\\s*<\\/tr>`, "i")
  );
  return match?.[1] ? stripTags(match[1]) : null;
}

function extractReportPdfs(html: string, detailUrl: string): KakenProject["report_pdfs"] {
  const entries: KakenProject["report_pdfs"] = [];
  const normalizePdfUrl = (value: string) => value.replace(
    "https://kaken.nii.ac.jp/ja/file/",
    "https://kaken.nii.ac.jp/file/"
  );
  const metaMatches = Array.from(
    html.matchAll(/<meta[^>]+name=["']citation-pdf-url["'][^>]+content=["']([^"']+)["'][^>]*>/gi)
  );
  for (const match of metaMatches) {
    const url = match[1] ? normalizePdfUrl(match[1]) : null;
    if (url) entries.push({ label: "研究成果報告書", fiscal_year: null, url });
  }

  for (const match of html.matchAll(/<a[^>]+href=["']([^"']*seika\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const rawUrl = match[1];
    if (!rawUrl) continue;
    const url = normalizePdfUrl(new URL(rawUrl, detailUrl).toString());
    const label = stripTags(match[2] ?? "") || "研究成果報告書";
    if (!entries.some((entry) => entry.url === url)) {
      entries.push({ label, fiscal_year: null, url });
    }
  }

  return entries;
}

function normalizeOutputType(rawType: string | null): KakenOutput["type"] {
  if (!rawType) return "other";
  if (rawType.includes("雑誌論文") || rawType.includes("論文")) return "journal_article";
  if (rawType.includes("図書")) return "book";
  if (rawType.includes("学会発表") || rawType.includes("発表")) return "conference_presentation";
  if (rawType.includes("報告書")) return "report";
  return "other";
}

function extractAdjacentValue(block: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(`<h5[^>]*>\\s*${escaped}\\s*<\\/h5>\\s*<div[^>]*>([\\s\\S]*?)<\\/div>`, "i")
  );
  return match?.[1] ? stripTags(match[1]) : null;
}

function extractFirstLink(block: string) {
  const match = block.match(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/i);
  return match?.[1] ?? null;
}

function extractOutputs(html: string, includeOutputs: boolean): KakenOutput[] {
  if (!includeOutputs) return [];
  const matches = Array.from(
    html.matchAll(/<h4[^>]*>\s*\[([^\]]+)\]\s*([\s\S]*?)(?:<span[^>]*class=["'][^"']*year[^"']*["'][^>]*>(.*?)<\/span>)?\s*<\/h4>/gi)
  );

  return matches.slice(0, 10).map((match, index) => {
    const rawType = stripTags(match[1] ?? "") || null;
    const title = stripTags(match[2] ?? "");
    const year = match[3] ? stripTags(match[3]) : null;
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? html.length;
    const block = html.slice(start, end);
    const authors = splitSlashList(extractAdjacentValue(block, "著者名/発表者名"))
      .flatMap((value) => value.split(/\s*,\s*/))
      .map((value) => value.trim())
      .filter(Boolean);

    return {
      type: normalizeOutputType(rawType),
      raw_type: rawType,
      title,
      authors,
      year,
      doi: extractAdjacentValue(block, "DOI"),
      url: extractFirstLink(block),
      note: null
    };
  }).filter((output) => output.title.length > 0);
}

function applyDetail(
  project: KakenProject,
  html: string,
  includeOutputs: boolean
): KakenProject {
  const fields = splitSlashList(extractTableCell(html, "審査区分/研究分野"));
  const keywords = splitSlashList(extractTableCell(html, "キーワード"));
  const summary = extractTableCell(html, "研究成果の概要") ?? project.summary;
  const reportPdfs = extractReportPdfs(html, project.url);

  return {
    ...project,
    fields: fields.length > 0 ? fields : project.fields,
    keywords: keywords.length > 0 ? keywords : project.keywords,
    summary,
    detail_fetched: true,
    detail_omitted_reason: null,
    report_pdf_status: reportPdfs.length > 0 ? "found" : "none_found",
    report_pdfs: reportPdfs,
    outputs_preview: extractOutputs(html, includeOutputs),
    search_hints: buildSearchHints(
      project.title,
      project.principal_investigator,
      keywords.length > 0 ? keywords : project.keywords
    )
  };
}

function buildSearchHints(
  title: string,
  principalInvestigator: KakenProject["principal_investigator"],
  keywords: string[]
): KakenProject["search_hints"] {
  return {
    project_terms: unique([title]),
    researcher_terms: unique(principalInvestigator ? [principalInvestigator.name] : []),
    keyword_terms: unique(keywords),
    caution: CAUTION
  };
}

function parseSearchXml(xml: string, detailBaseUrl: string) {
  const root = parseXml(xml);
  const grantAwards = isRecord(root.grantAwards) ? root.grantAwards : {};
  const total = Number(textOf(grantAwards.totalResults) ?? "0");
  const items = asRecordArray(grantAwards.grantAward).map((grantAward) =>
    mapGrantAward(grantAward, detailBaseUrl)
  );

  return {
    total: Number.isFinite(total) && total >= 0 ? total : items.length,
    items
  };
}

function buildSearchUrl(searchUrl: string, appId: string, input: KakenSearchInput) {
  const url = new URL(searchUrl);
  url.searchParams.set("appid", appId);
  url.searchParams.set("kw", input.query);
  url.searchParams.set("format", "xml");
  url.searchParams.set("rw", String(input.limit));
  url.searchParams.set("lang", "ja");
  if (input.researcher_name) {
    url.searchParams.set("qg", input.researcher_name);
  }
  if (input.from_fiscal_year) {
    url.searchParams.set("s1", String(input.from_fiscal_year));
  }
  if (input.to_fiscal_year) {
    url.searchParams.set("s2", String(input.to_fiscal_year));
  }
  const start = (input.page - 1) * input.limit + 1;
  url.searchParams.set("st", String(start));
  return url;
}

export function createKakenClient(options: KakenClientOptions = {}) {
  const searchUrl = options.searchUrl ?? DEFAULT_SEARCH_URL;
  const detailBaseUrl = options.detailBaseUrl ?? DEFAULT_DETAIL_BASE_URL;
  const appId = options.appId ?? process.env.CINII_RESEARCH_APP_ID ?? "";
  const fetcher = options.fetcher ?? fetchText;

  return {
    async searchProjects(input: KakenSearchInput): Promise<SearchKakenProjectsOutput> {
      if (!appId.trim()) {
        throw new Error("KAKEN API requires CINII_RESEARCH_APP_ID.");
      }

      const payload = await fetcher(buildSearchUrl(searchUrl, appId, input));
      const parsed = parseSearchXml(payload.text, detailBaseUrl);
      const limited = parsed.items.slice(0, input.limit);
      const detailLimit = Math.min(input.detail_limit, limited.length);
      const items: KakenProject[] = [];

      for (const [index, project] of limited.entries()) {
        if (index >= detailLimit) {
          items.push({
            ...project,
            detail_omitted_reason: "detail_limit_exceeded",
            report_pdf_status: "not_checked"
          });
          continue;
        }

        try {
          const detail = await fetcher(new URL(project.url));
          items.push(applyDetail(project, detail.text, input.include_outputs));
        } catch {
          items.push({
            ...project,
            detail_fetched: false,
            detail_omitted_reason: "fetch_failed",
            report_pdf_status: "fetch_failed"
          });
        }
      }

      return {
        query: input.query,
        page: input.page,
        limit: input.limit,
        total: parsed.total,
        items
      };
    }
  };
}

export type KakenClient = ReturnType<typeof createKakenClient>;
