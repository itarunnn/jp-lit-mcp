import { describe, expect, it, vi } from "vitest";

import { UnsupportedPayloadError } from "../src/lib/http.js";
import { createNdlAuthoritiesClient } from "../src/sources/ndlAuthorities/client.js";

const IROKAWA_SPARQL_JSON = {
  head: {
    vars: ["authority", "label", "type", "altLabel", "sameName", "sameNameLabel", "relationLabel"]
  },
  results: {
    bindings: [
      {
        authority: { type: "uri", value: "https://id.ndl.go.jp/auth/ndlna/00020172" },
        label: { type: "literal", value: "色川, 武大, 1929-1989" },
        type: { type: "uri", value: "http://id.ndl.go.jp/auth#personalNames" },
        altLabel: { type: "literal", value: "色川, 武大 (イロカワ, ブダイ)" },
        sameName: { type: "uri", value: "https://id.ndl.go.jp/auth/ndlna/00001930" },
        sameNameLabel: { type: "literal", value: "阿佐田, 哲也, 1929-1989" },
        relationLabel: { type: "literal", value: "筆名" }
      },
      {
        authority: { type: "uri", value: "https://id.ndl.go.jp/auth/ndlna/00020172" },
        label: { type: "literal", value: "色川, 武大, 1929-1989" },
        type: { type: "uri", value: "http://id.ndl.go.jp/auth#personalNames" },
        sameName: { type: "uri", value: "https://id.ndl.go.jp/auth/ndlna/00123456" },
        sameNameLabel: { type: "literal", value: "井上, 志摩夫, 1929-1989" },
        relationLabel: { type: "literal", value: "筆名" }
      }
    ]
  }
};

const SUBJECT_SPARQL_JSON = {
  head: {
    vars: ["authority", "label", "type", "altLabel", "broader", "broaderLabel", "related", "relatedLabel"]
  },
  results: {
    bindings: [
      {
        authority: { type: "uri", value: "https://id.ndl.go.jp/auth/ndlsh/00573140" },
        label: { type: "literal", value: "賭博" },
        type: { type: "uri", value: "http://id.ndl.go.jp/auth#topicalTerms" },
        altLabel: { type: "literal", value: "ギャンブル" },
        broader: { type: "uri", value: "https://id.ndl.go.jp/auth/ndlsh/00562549" },
        broaderLabel: { type: "literal", value: "娯楽" },
        related: { type: "uri", value: "https://id.ndl.go.jp/auth/ndlsh/01215654" },
        relatedLabel: { type: "literal", value: "カジノ" }
      }
    ]
  }
};

const NDC_596_7_SPARQL_JSON = {
  head: { vars: ["authority", "label", "type", "altLabel", "classification"] },
  results: {
    bindings: [
      {
        authority: { type: "uri", value: "https://id.ndl.go.jp/auth/ndlsh/00566222" },
        label: { type: "literal", value: "コーヒー" },
        type: { type: "uri", value: "http://id.ndl.go.jp/auth#topicalTerms" },
        altLabel: { type: "literal", value: "珈琲" },
        classification: { type: "uri", value: "http://id.ndl.go.jp/class/ndc10/596.7" }
      },
      {
        authority: { type: "uri", value: "https://id.ndl.go.jp/auth/ndlsh/00573562" },
        label: { type: "literal", value: "茶" },
        type: { type: "uri", value: "http://id.ndl.go.jp/auth#topicalTerms" },
        classification: { type: "uri", value: "http://id.ndl.go.jp/class/ndc10/596.7" }
      }
    ]
  }
};

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/sparql-results+json" }),
    json: async () => payload
  } as Response;
}

describe("ndl authorities client", () => {
  it("色川武大の筆名を same_identity_names として正規化する", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(IROKAWA_SPARQL_JSON));
    const client = createNdlAuthoritiesClient({ fetcher });

    const result = await client.resolve({ query: "色川武大", type: "person", limit: 5 });

    expect(result.items[0]).toMatchObject({
      authority_uri: "https://id.ndl.go.jp/auth/ndlna/00020172",
      type: "person",
      label: "色川, 武大, 1929-1989",
      variant_labels: ["色川, 武大 (イロカワ, ブダイ)"]
    });
    expect(result.search_hints.variant_terms).toEqual(["色川武大"]);
    expect(result.items[0].same_identity_names).toEqual([
      {
        label: "阿佐田, 哲也, 1929-1989",
        authority_uri: "https://id.ndl.go.jp/auth/ndlna/00001930",
        relation: "pseudonym",
        relation_label: "筆名"
      },
      {
        label: "井上, 志摩夫, 1929-1989",
        authority_uri: "https://id.ndl.go.jp/auth/ndlna/00123456",
        relation: "pseudonym",
        relation_label: "筆名"
      }
    ]);
    expect(result.search_hints.same_identity_terms).toEqual([
      "阿佐田哲也",
      "井上志摩夫"
    ]);
  });

  it("件名の関連語を reference_terms として扱い same_identity_terms に入れない", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(SUBJECT_SPARQL_JSON));
    const client = createNdlAuthoritiesClient({ fetcher });

    const result = await client.resolve({ query: "賭博", type: "subject", limit: 5 });

    expect(result.items[0]).toMatchObject({
      type: "subject",
      label: "賭博",
      variant_labels: ["ギャンブル"],
      broader_terms: [{ label: "娯楽", authority_uri: "https://id.ndl.go.jp/auth/ndlsh/00562549" }],
      related_terms: [{ label: "カジノ", authority_uri: "https://id.ndl.go.jp/auth/ndlsh/01215654" }]
    });
    expect(result.search_hints.variant_terms).toEqual(["ギャンブル"]);
    expect(result.search_hints.reference_terms).toEqual(["娯楽", "カジノ"]);
    expect(result.search_hints.same_identity_terms).toEqual([]);
  });

  it("NDC から件名標目を探索語候補として返す", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(NDC_596_7_SPARQL_JSON));
    const client = createNdlAuthoritiesClient({ fetcher });

    const result = await client.findTermsByClassification({
      classification: "596.7",
      scheme: "NDC10",
      limit: 20
    });

    expect(fetcher.mock.calls[0][0].toString()).toContain("skos%3ArelatedMatch");
    expect(result.classification).toEqual({ scheme: "NDC10", notation: "596.7" });
    expect(result.items.map((item) => item.label)).toEqual(["コーヒー", "茶"]);
    expect(result.items[0].source_metadata).toEqual({
      classification: "http://id.ndl.go.jp/class/ndc10/596.7"
    });
    expect(result.search_hints.preferred_terms).toEqual(["コーヒー", "茶"]);
    expect(result.search_hints.reference_terms).toEqual(["珈琲"]);
  });

  it("SPARQL JSON 以外の payload を UnsupportedPayloadError にする", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "text/html" }),
      json: async () => ({})
    } as Response);
    const client = createNdlAuthoritiesClient({ fetcher });

    await expect(client.resolve({ query: "色川武大", type: "person", limit: 5 })).rejects.toBeInstanceOf(
      UnsupportedPayloadError
    );
  });
});
