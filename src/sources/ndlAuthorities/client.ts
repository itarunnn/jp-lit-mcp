import {
  fetchWithTimeout,
  UnsupportedPayloadError,
  UpstreamHttpError
} from "../../lib/http.js";
import type {
  AuthorityTermsByClassificationInput,
  AuthorityTermsByClassificationOutput,
  ResolveAuthorityInput,
  ResolveAuthorityOutput
} from "../../lib/schemas.js";

const DEFAULT_SPARQL_URL = "https://id.ndl.go.jp/auth/ndla/sparql";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface NdlAuthoritiesClientOptions {
  sparqlUrl?: string;
  fetcher?: Fetcher;
}

interface SparqlBindingValue {
  type: string;
  value: string;
}

interface SparqlResponse {
  results?: {
    bindings?: Record<string, SparqlBindingValue>[];
  };
}

function bindingValue(binding: Record<string, SparqlBindingValue>, key: string) {
  return binding[key]?.value ?? null;
}

function normalizeAuthorityType(value: string | null): ResolveAuthorityOutput["items"][number]["type"] {
  if (!value) return "unknown";
  if (value.includes("personalNames")) return "person";
  if (value.includes("corporateNames")) return "corporate";
  if (value.includes("topicalTerms")) return "subject";
  if (value.includes("uniformTitles")) return "uniform_title";
  if (value.includes("genreForms")) return "genre";
  return "unknown";
}

function normalizeRelation(label: string | null) {
  if (label === "筆名") return "pseudonym" as const;
  if (label === "旧名") return "former_name" as const;
  if (label === "本名") return "real_name" as const;
  if (label) return "related_name" as const;
  return "unknown" as const;
}

function compactAuthorityTerm(label: string) {
  return label
    .replace(/,\s*\d{4}-\d{4}$/, "")
    .replace(/\s*[（(][ァ-ヶー・,\s]+[）)]/g, "")
    .replace(/[,\s]/g, "")
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

async function readSparqlJson(response: Response): Promise<SparqlResponse> {
  const contentType = response.headers?.get("content-type") ?? null;
  if (contentType && !contentType.toLowerCase().includes("json")) {
    throw new UnsupportedPayloadError(
      `SPARQL JSON payload required but received ${contentType}`
    );
  }

  try {
    return (await response.json()) as SparqlResponse;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new UnsupportedPayloadError(
        "SPARQL JSON payload required but upstream returned non-JSON content"
      );
    }

    throw error;
  }
}

function buildSparqlQuery(input: ResolveAuthorityInput) {
  const escaped = input.query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const typeFilter =
    input.type === "person"
      ? 'FILTER(CONTAINS(STR(?type), "personalNames"))'
      : input.type === "corporate"
        ? 'FILTER(CONTAINS(STR(?type), "corporateNames"))'
        : input.type === "subject"
          ? 'FILTER(CONTAINS(STR(?type), "topicalTerms"))'
          : input.type === "uniform_title"
            ? 'FILTER(CONTAINS(STR(?type), "uniformTitles"))'
            : input.type === "genre"
              ? 'FILTER(CONTAINS(STR(?type), "genreForms"))'
              : "";

  return `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xl: <http://www.w3.org/2008/05/skos-xl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?authority ?label ?type ?altLabel ?sameName ?sameNameLabel ?relationLabel ?broader ?broaderLabel ?narrower ?narrowerLabel ?related ?relatedLabel
WHERE {
  ?authority rdfs:label ?label ;
             skos:inScheme ?type .
  FILTER(CONTAINS(STR(?label), "${escaped}") || EXISTS {
    ?authority xl:altLabel ?altNode .
    ?altNode xl:literalForm ?altMatch .
    FILTER(CONTAINS(STR(?altMatch), "${escaped}"))
  })
  ${typeFilter}
  OPTIONAL { ?authority xl:altLabel ?alt . ?alt xl:literalForm ?altLabel . }
  OPTIONAL { ?authority skos:related ?sameName . ?sameName rdfs:label ?sameNameLabel . OPTIONAL { ?sameName skos:note ?relationLabel . } }
  OPTIONAL { ?authority skos:broader ?broader . ?broader rdfs:label ?broaderLabel . }
  OPTIONAL { ?authority skos:narrower ?narrower . ?narrower rdfs:label ?narrowerLabel . }
  OPTIONAL { ?authority skos:related ?related . ?related rdfs:label ?relatedLabel . }
}
LIMIT ${input.limit * 20}
`;
}

function buildClassificationSparqlQuery(input: AuthorityTermsByClassificationInput) {
  const escaped = input.classification.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const schemeUri =
    input.scheme === "NDC10"
      ? "http://id.ndl.go.jp/class/ndc10"
      : input.scheme === "NDC9"
        ? "http://id.ndl.go.jp/class/ndc9"
        : input.scheme === "NDC8"
          ? "http://id.ndl.go.jp/class/ndc8"
          : "http://id.ndl.go.jp/class/ndc6";

  return `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xl: <http://www.w3.org/2008/05/skos-xl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?authority ?label ?type ?altLabel ?classification
WHERE {
  ?authority rdfs:label ?label ;
             skos:inScheme ?type ;
             skos:relatedMatch ?classification .
  FILTER(CONTAINS(STR(?type), "topicalTerms"))
  FILTER(STR(?classification) = "${escaped}" || STRENDS(STR(?classification), "/${escaped}"))
  FILTER(CONTAINS(STR(?classification), "${schemeUri}"))
  OPTIONAL { ?authority xl:altLabel ?alt . ?alt xl:literalForm ?altLabel . }
}
LIMIT ${input.limit * 10}
`;
}

function addLinkedTerm(
  items: { label: string; authority_uri: string | null }[],
  label: string | null,
  authorityUri: string | null
) {
  if (!label) return;
  if (items.some((item) => item.label === label && item.authority_uri === authorityUri)) return;
  items.push({ label, authority_uri: authorityUri });
}

function buildCaution(
  requestedType: ResolveAuthorityInput["type"],
  items: ResolveAuthorityOutput["items"] = []
) {
  const itemTypes = new Set(items.map((item) => item.type));
  const identityOnly =
    requestedType === "person" ||
    requestedType === "corporate" ||
    (requestedType === "all" &&
      itemTypes.size > 0 &&
      Array.from(itemTypes).every((type) => type === "person" || type === "corporate"));

  if (identityOnly) {
    return "same_identity_terms は同一人物・同一団体の別名義です。名義別に探す場合とまとめて探す場合を分けてください。";
  }
  if (requestedType === "uniform_title") {
    return "variant_terms は同一著作の翻訳タイトル・別タイトル候補です。タイトルに含まれる語だけでなく著作典拠として確認してください。";
  }
  if (requestedType === "genre") {
    return "genre は資料のテーマではなく形式・ジャンルです。漫画についての研究書を探す場合は subject も確認してください。";
  }
  return "reference_terms は上位語・下位語・関連語を含み、調査意図を広げる可能性があります。必要時のみ使ってください。";
}

export function createNdlAuthoritiesClient(options: NdlAuthoritiesClientOptions = {}) {
  const sparqlUrl = options.sparqlUrl ?? DEFAULT_SPARQL_URL;
  const fetcher: Fetcher =
    options.fetcher ?? ((input, init) => fetchWithTimeout(input, init));

  return {
    async resolve(input: ResolveAuthorityInput): Promise<ResolveAuthorityOutput> {
      const url = new URL(sparqlUrl);
      url.searchParams.set("query", buildSparqlQuery(input));
      url.searchParams.set("format", "application/sparql-results+json");

      const response = await fetcher(url, {
        headers: { accept: "application/sparql-results+json, application/json" }
      });
      if (!response.ok) {
        throw new UpstreamHttpError(response.status, response.statusText);
      }

      const payload = await readSparqlJson(response);
      const bindings = payload.results?.bindings;
      if (!Array.isArray(bindings)) {
        throw new UnsupportedPayloadError("SPARQL JSON results are required");
      }

      const byUri = new Map<string, ResolveAuthorityOutput["items"][number]>();
      for (const binding of bindings) {
        const authorityUri = bindingValue(binding, "authority");
        const label = bindingValue(binding, "label");
        if (!authorityUri || !label) continue;

        const item =
          byUri.get(authorityUri) ??
          {
            authority_uri: authorityUri,
            id: authorityUri.split("/").pop() ?? null,
            type: normalizeAuthorityType(bindingValue(binding, "type")),
            label,
            label_reading: null,
            label_romanized: null,
            variant_labels: [],
            same_identity_names: [],
            broader_terms: [],
            narrower_terms: [],
            related_terms: [],
            source_metadata: {}
          };

        const altLabel = bindingValue(binding, "altLabel");
        if (altLabel && !item.variant_labels.includes(altLabel)) {
          item.variant_labels.push(altLabel);
        }

        const sameNameLabel = bindingValue(binding, "sameNameLabel");
        if ((item.type === "person" || item.type === "corporate") && sameNameLabel) {
          const relationLabel = bindingValue(binding, "relationLabel");
          const linked = {
            label: sameNameLabel,
            authority_uri: bindingValue(binding, "sameName"),
            relation: normalizeRelation(relationLabel),
            relation_label: relationLabel
          };
          if (!item.same_identity_names.some((entry) => entry.label === linked.label)) {
            item.same_identity_names.push(linked);
          }
        }

        addLinkedTerm(item.broader_terms, bindingValue(binding, "broaderLabel"), bindingValue(binding, "broader"));
        addLinkedTerm(item.narrower_terms, bindingValue(binding, "narrowerLabel"), bindingValue(binding, "narrower"));
        if (item.type !== "person" && item.type !== "corporate") {
          addLinkedTerm(item.related_terms, bindingValue(binding, "relatedLabel"), bindingValue(binding, "related"));
        }
        byUri.set(authorityUri, item);
      }

      const total = byUri.size;
      const items = Array.from(byUri.values()).slice(0, input.limit);
      const preferredTerms = unique(items.map((item) => compactAuthorityTerm(item.label)));
      const variantTerms = unique(items.flatMap((item) => item.variant_labels.map(compactAuthorityTerm)));
      const sameIdentityTerms = unique(
        items.flatMap((item) => item.same_identity_names.map((name) => compactAuthorityTerm(name.label)))
      );
      const referenceTerms = unique(
        items.flatMap((item) => [
          ...item.broader_terms.map((term) => compactAuthorityTerm(term.label)),
          ...item.narrower_terms.map((term) => compactAuthorityTerm(term.label)),
          ...item.related_terms.map((term) => compactAuthorityTerm(term.label))
        ])
      );

      return {
        query: input.query,
        type: input.type,
        total,
        limit: input.limit,
        items,
        search_hints: {
          preferred_terms: preferredTerms,
          variant_terms: variantTerms,
          same_identity_terms: sameIdentityTerms,
          reference_terms: referenceTerms,
          caution: buildCaution(input.type, items)
        }
      };
    },

    async findTermsByClassification(
      input: AuthorityTermsByClassificationInput
    ): Promise<AuthorityTermsByClassificationOutput> {
      const url = new URL(sparqlUrl);
      url.searchParams.set("query", buildClassificationSparqlQuery(input));
      url.searchParams.set("format", "application/sparql-results+json");

      const response = await fetcher(url, {
        headers: { accept: "application/sparql-results+json, application/json" }
      });
      if (!response.ok) {
        throw new UpstreamHttpError(response.status, response.statusText);
      }

      const payload = await readSparqlJson(response);
      const bindings = payload.results?.bindings;
      if (!Array.isArray(bindings)) {
        throw new UnsupportedPayloadError("SPARQL JSON results are required");
      }

      const byUri = new Map<string, ResolveAuthorityOutput["items"][number]>();
      for (const binding of bindings) {
        const authorityUri = bindingValue(binding, "authority");
        const label = bindingValue(binding, "label");
        if (!authorityUri || !label) continue;

        const item =
          byUri.get(authorityUri) ??
          {
            authority_uri: authorityUri,
            id: authorityUri.split("/").pop() ?? null,
            type: normalizeAuthorityType(bindingValue(binding, "type")),
            label,
            label_reading: null,
            label_romanized: null,
            variant_labels: [],
            same_identity_names: [],
            broader_terms: [],
            narrower_terms: [],
            related_terms: [],
            source_metadata: {
              classification: bindingValue(binding, "classification")
            }
          };
        const altLabel = bindingValue(binding, "altLabel");
        if (altLabel && !item.variant_labels.includes(altLabel)) {
          item.variant_labels.push(altLabel);
        }
        byUri.set(authorityUri, item);
      }

      const total = byUri.size;
      const items = Array.from(byUri.values()).slice(0, input.limit);
      return {
        classification: {
          scheme: input.scheme,
          notation: input.classification
        },
        total,
        limit: input.limit,
        items,
        search_hints: {
          preferred_terms: unique(items.map((item) => compactAuthorityTerm(item.label))),
          reference_terms: unique(items.flatMap((item) => item.variant_labels.map(compactAuthorityTerm))),
          caution:
            "分類から得た件名標目は未知文献探索の入口です。分類範囲が広い場合や NDC の版が異なる場合は、年代・資料種別・分類前方一致などと組み合わせて絞り込んでください。"
        }
      };
    }
  };
}

export type NdlAuthoritiesClient = ReturnType<typeof createNdlAuthoritiesClient>;
