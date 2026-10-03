import { describe, expect, it } from "vitest";
import { detectQueryScript } from "../src/lib/searchContext.js";
import { searchContextSchema } from "../src/lib/searchContextSchema.js";
import { buildSearchDiagnostics } from "../src/lib/searchDiagnostics.js";
import { searchOutputSchema } from "../src/lib/schemas.js";
describe("search context", () => {
  it.each([["A𠮷", "mixed"], ["𠮷", "han"], ["A吉", "mixed"], ["ABC", "latin"], ["123", "other"], ["かな", "kana"], ["漢字かな", "han_kana"], ["", "other"]])("classifies %s as %s", (query, script) => {
    expect(detectQueryScript(query)).toBe(script);
  });
  it("does not warn about Latin-only search when supplementary Han is present", () => {
    const codes = (query: string) => buildSearchDiagnostics({
      query,
      source: "cinii_articles",
      total: 1,
      ciniiAppIdPresent: true
    }).map(d => d.code);
    expect(codes("A𠮷")).not.toContain("SCRIPT_LATIN_QUERY");
    expect(codes("ABC")).toContain("SCRIPT_LATIN_QUERY");
  });
  it("accepts legacy output but rejects malformed context", () => {
    expect(searchOutputSchema.safeParse({
      query: "x",
      source: null,
      page: 1,
      limit: 48,
      total: 0,
      items: []
    }).success).toBe(true);
    const context = {
      schema_version: 1,
      producer_version: "test",
      requested_query: "x",
      query_script: "latin",
      aggregation: "single",
      fetch_limit_per_source: 50,
      total_semantics: "source_reported",
      sources: [{
          source: "cinii_articles",
          outcome: "completed",
          request: null,
          reported_total: 0,
          total_basis: "source_reported",
          fetched_count: 0,
          included_count: 0,
          error_category: null
        }]
    };
    expect(searchContextSchema.safeParse(context).success).toBe(true);
    expect(searchContextSchema.safeParse({
      ...context,
      schema_version: 2
    }).success).toBe(false);
    expect(searchContextSchema.safeParse({
      ...context,
      sources: [{
          ...context.sources[0],
          reported_total: -1
        }]
    }).success).toBe(false);
  });
});
