import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCiniiArticlesAdapter, createCiniiBooksAdapter, createCiniiDissertationsAdapter } from "../src/sources/ciniiResearch/adapter.js";
import { createJstageArticlesAdapter } from "../src/sources/jstage/adapter.js";
import { createNdlSearchAdapter, createNdlCatalogAdapter, createNdlArticlesAdapter, createNdlArticlesOnlineAdapter, createNdlReferenceBooksAdapter } from "../src/sources/ndlSearch/adapter.js";
import { createNdlDigitalAdapter } from "../src/sources/ndlDigital/adapter.js";
import { mapCiniiSearchResponseForSource } from "../src/sources/ciniiResearch/mapSearch.js";
import { mapJstageSearchResponse } from "../src/sources/jstage/mapSearch.js";
import { mapNdlSearchSearchResponse } from "../src/sources/ndlSearch/mapSearch.js";
import { mapNdlDigitalSearchResponse } from "../src/sources/ndlDigital/mapSearch.js";
import { projectNdlSruSearchResponse } from "../src/sources/ndlSearch/parseSru.js";

const params = {
  query: 'A𠮷 "quoted"',
  limit: 3,
  page: 2,
  issued_from: "2000",
  issued_to: "2020"
};
afterEach(() => vi.unstubAllGlobals());
describe("CiNii and J-STAGE descriptions", () => {
  it.each([createCiniiArticlesAdapter, createCiniiBooksAdapter, createCiniiDissertationsAdapter])("describes actual CiNii requests without credentials", async (factory) => {
    const adapter = factory({
      appId: "PRIVATE_SENTINEL",
      searchBaseUrl: "https://user:pass@example.org/opensearch/articles?token=PRIVATE_SENTINEL"
    });
    let sent = "";
    vi.stubGlobal("fetch", async (url: string) => { sent = String(url); return new Response(JSON.stringify({
      items: [],
      "opensearch:totalResults": "0"
    }), {
      headers: {
        "content-type": "application/json"
      }
    }); });
    const result = await adapter.search(params);
    const description = adapter.describeSearch!(params);
    expect(description.parameters).toMatchObject({
      q: params.query,
      count: "3",
      start: "4",
      from: "2000",
      until: "2020"
    });
    for (const [key, value] of Object.entries(description.parameters))
      expect(new URL(sent).searchParams.get(key)).toBe(String(value));
    expect(JSON.stringify(description)).not.toMatch(/PRIVATE_SENTINEL|appid|user:pass|token/);
    expect(result.summary).toEqual({
      outcome: "completed",
      reported_total: 0,
      total_basis: "source_reported"
    });
  });
  it("records ignored sort and source-specific filters", async () => {
    const adapter = createJstageArticlesAdapter();
    let sent = "";
    vi.stubGlobal("fetch", async (url: string) => { sent = String(url); return new Response('<feed><result><status>0</status></result><opensearch:totalResults>0</opensearch:totalResults></feed>'); });
    await adapter.search({
      ...params,
      sort_by: "title"
    });
    const description = adapter.describeSearch!({
      ...params,
      sort_by: "title"
    });
    expect(description.parameters).toMatchObject({
      article: params.query,
      start: "4",
      pubyearfrom: "2000",
      pubyearto: "2020"
    });
    expect(description.ignored_input_fields).toContain("sort_by");
    for (const [key, value] of Object.entries(description.parameters))
      expect(new URL(sent).searchParams.get(key)).toBe(String(value));
  });
  it.each([[undefined, "returned_count"], ["", "unknown"], ["invalid", "returned_count"], [-1, "unknown"]] as const)("keeps unreported CiNii totals unknown: %s", (raw, basis) => {
    expect(mapCiniiSearchResponseForSource({
      items: [],
      "opensearch:totalResults": raw
    }, "cinii_articles").summary).toMatchObject({
      reported_total: null,
      total_basis: basis
    });
  });
  it("distinguishes J-STAGE provider failure from a reported zero", () => {
    expect(mapJstageSearchResponse('<feed><result><status>1</status></result></feed>').summary).toEqual({
      outcome: "failed",
      reported_total: null,
      total_basis: "unknown"
    });
    expect(mapJstageSearchResponse('<feed><result><status>0</status></result><opensearch:totalResults>0</opensearch:totalResults></feed>').summary).toEqual({
      outcome: "completed",
      reported_total: 0,
      total_basis: "source_reported"
    });
  });
});
describe("NDL descriptions", () => {
  it.each([[createNdlCatalogAdapter, "iss-ndl-opac"], [createNdlArticlesAdapter, "zassaku"], [createNdlArticlesOnlineAdapter, "zassaku-online"], [createNdlDigitalAdapter, "ndl-dl"]] as const)("describes provider-restricted SRU", async (factory, provider) => {
    const adapter = factory();
    let sent = "";
    vi.stubGlobal("fetch", async (url: string) => { sent = String(url); return new Response(readFileSync('tests/fixtures/ndl-sru/search-ndl-catalog.xml', 'utf8')); });
    const input = {
      ...params,
      filters: {
        ndl: {
          subject: "文学",
          ndlc: "KH",
          ndc: "910"
        }
      }
    };
    await adapter.search(input);
    const description = adapter.describeSearch!(input);
    expect(description.parameters.startRecord).toBe("4");
    expect(description.parameters.query).toContain(`dpid=${provider}`);
    for (const [key, value] of Object.entries(description.parameters))
      expect(new URL(sent).searchParams.get(key)).toBe(String(value));
  });
  it("describes broad NDL search and ignored reference-book conditions", () => {
    expect(createNdlSearchAdapter().describeSearch!(params).parameters.query).toContain('anywhere=');
    const request = createNdlReferenceBooksAdapter().describeSearch!({
      ...params,
      sort_by: "title",
      filters: {
        ndl: {
          ndc: "9"
        }
      }
    });
    expect(request.parameters).toEqual({
      cs: "sanko",
      keyword: params.query,
      size: "3",
      from: "3"
    });
    expect(request.ignored_input_fields).toEqual(expect.arrayContaining(["issued_from", "issued_to", "sort_by", "filters.ndl.ndc"]));
  });
  it("preserves unknown total through SRU projection and digital mapping", () => {
    const projected = projectNdlSruSearchResponse('<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/"><records/></searchRetrieveResponse>');
    expect(mapNdlSearchSearchResponse(projected).summary).toMatchObject({
      reported_total: null
    });
    expect(mapNdlDigitalSearchResponse({
      totalResults: "0",
      items: []
    }).summary).toEqual({
      outcome: "completed",
      reported_total: 0,
      total_basis: "source_reported"
    });
  });
});
it("describes allowlisted effective conditions inherited from a custom base", () => {
  const request = createJstageArticlesAdapter({
    searchBaseUrl: "https://example.org/search?pubyearfrom=1990&token=PRIVATE_SENTINEL"
  }).describeSearch!({
    query: "q",
    limit: 1,
    page: 1
  });
  expect(request.parameters.pubyearfrom).toBe("1990");
  expect(JSON.stringify(request)).not.toContain("PRIVATE_SENTINEL");
});
it("records CiNii book category and supported issued-date sorting", () => {
  const input = {
    ...params,
    filters: {
      cinii: {
        category: "KG311"
      }
    },
    sort_by: "issued_date",
    sort_order: "asc"
  } as const;
  expect(createCiniiBooksAdapter().describeSearch!(input).parameters).toMatchObject({
    category: "KG311",
    sortorder: "2"
  });
  expect(createCiniiArticlesAdapter().describeSearch!(input).parameters).toMatchObject({
    sortorder: "1"
  });
  expect(createCiniiArticlesAdapter().describeSearch!(input).ignored_input_fields).toContain("filters.cinii.category");
});
