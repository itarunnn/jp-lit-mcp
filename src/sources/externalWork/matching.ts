import type {
  EnrichRecordOutputQuery,
  ExternalWorkItem,
  MatchAssessment
} from "./types.js";

const CAUTION =
  "Crossref/OpenAlex の一致は書誌確認の補助で、本文到達性や研究上の重要度を保証しません。日本語人文系では未収録・低引用でも重要文献がありえます。";

export function normalizeDoi(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .toLowerCase();
}

export function normalizeTitleForMatch(value: string | null | undefined) {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[『』「」【】《》〈〉〔〕（）()［\]\[\]{}]/g, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function normalizeAuthor(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function bigrams(value: string) {
  if (value.length <= 1) return value ? [value] : [];
  const grams: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    grams.push(value.slice(index, index + 2));
  }
  return grams;
}

function diceCoefficient(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  if (leftGrams.length === 0 || rightGrams.length === 0) return 0;

  const rightCounts = new Map<string, number>();
  for (const gram of rightGrams) {
    rightCounts.set(gram, (rightCounts.get(gram) ?? 0) + 1);
  }

  let overlap = 0;
  for (const gram of leftGrams) {
    const count = rightCounts.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(gram, count - 1);
    }
  }

  return (2 * overlap) / (leftGrams.length + rightGrams.length);
}

function titleMatches(left: string, right: string) {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.replace(/の/g, "") === right.replace(/の/g, "")) return true;
  return diceCoefficient(left, right) >= 0.86;
}

function hasAuthorOverlap(candidateAuthors: string[], queryAuthors: string[]) {
  const candidateSet = new Set(candidateAuthors.map(normalizeAuthor).filter(Boolean));
  if (candidateSet.size === 0) return false;

  return queryAuthors
    .map(normalizeAuthor)
    .filter(Boolean)
    .some((author) => candidateSet.has(author));
}

export function assessMatchConfidence(
  candidate: Pick<ExternalWorkItem, "doi" | "title" | "authors" | "issued_year">,
  query: EnrichRecordOutputQuery
): MatchAssessment {
  const reasons: string[] = [];
  const missing: string[] = [];
  const candidateDoi = normalizeDoi(candidate.doi);
  const queryDoi = normalizeDoi(query.doi);
  const doiMatches = Boolean(candidateDoi && queryDoi && candidateDoi === queryDoi);

  if (candidateDoi && queryDoi) {
    if (doiMatches) {
      reasons.push("doi_match");
    } else {
      missing.push("doi_match");
    }
  }

  const normalizedCandidateTitle = normalizeTitleForMatch(candidate.title);
  const normalizedQueryTitle = normalizeTitleForMatch(query.title);
  const hasTitleMatch = titleMatches(normalizedCandidateTitle, normalizedQueryTitle);
  if (hasTitleMatch) {
    reasons.push("title_match");
  } else if (query.title) {
    missing.push("title_match");
  }

  const yearMatches =
    Boolean(candidate.issued_year && query.issued_year) &&
    candidate.issued_year === query.issued_year;
  if (yearMatches) {
    reasons.push("year_match");
  } else if (query.issued_year) {
    missing.push("year_match");
  }

  const authorMatches = hasAuthorOverlap(candidate.authors, query.authors);
  if (authorMatches) {
    reasons.push("author_overlap");
  } else if (query.authors.length > 0) {
    missing.push("author_overlap");
  }

  let matchConfidence: MatchAssessment["match_confidence"] = "none";
  if (doiMatches) {
    matchConfidence = missing.length > 0 ? "medium" : "high";
  } else if (hasTitleMatch && (yearMatches || authorMatches)) {
    matchConfidence = "high";
  } else if (hasTitleMatch) {
    matchConfidence = "medium";
  } else if (reasons.length > 0) {
    matchConfidence = "low";
  }

  return {
    match_confidence: matchConfidence,
    reasons: unique(reasons),
    missing: unique(missing),
    caution: CAUTION
  };
}

export { CAUTION as ENRICH_RECORD_CAUTION };
