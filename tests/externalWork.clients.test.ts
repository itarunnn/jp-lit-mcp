import { describe, expect, it, vi } from "vitest";

import { createCrossrefClient } from "../src/sources/externalWork/crossrefClient.js";
import { createOpenAlexClient } from "../src/sources/externalWork/openalexClient.js";

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" }
  });
}

describe("external work clients", () => {
  it("looks up Crossref by normalized DOI and adds optional mailto", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        message: {
          DOI: "10.1234/GENJI",
          title: ["源氏物語研究"],
          author: [{ given: "太郎", family: "山田" }],
          issued: { "date-parts": [[2020, 4, 1]] },
          URL: "https://doi.org/10.1234/genji",
          "container-title": ["日本文学"],
          type: "journal-article",
          "is-referenced-by-count": 3
        }
      })
    );
    const client = createCrossrefClient({
      baseUrl: "https://crossref.test/works",
      mailto: "research@example.test",
      fetcher
    });

    const result = await client.lookup({
      doi: "https://doi.org/10.1234/GENJI",
      title: null,
      authors: [],
      issued_year: null
    });

    const requested = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(requested.pathname).toBe("/works/10.1234%2Fgenji");
    expect(requested.searchParams.get("mailto")).toBe("research@example.test");
    expect(result).toMatchObject({
      provider: "crossref",
      status: "ok",
      item_count: 1,
      items: [
        {
          doi: "10.1234/genji",
          title: "源氏物語研究",
          authors: ["山田 太郎"],
          issued_year: "2020",
          cited_by_count: 3
        }
      ]
    });
  });

  it("queries OpenAlex with api_key and per_page for title/year lookup", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: "https://openalex.org/W123",
            doi: "https://doi.org/10.1234/genji",
            title: "源氏物語研究",
            authorships: [
              { author: { display_name: "山田 太郎" } }
            ],
            publication_year: 2020,
            primary_location: {
              source: { display_name: "日本文学" },
              landing_page_url: "https://example.test/work"
            },
            type: "article",
            cited_by_count: 4
          }
        ]
      })
    );
    const client = createOpenAlexClient({
      baseUrl: "https://openalex.test/works",
      apiKey: "oa-key",
      fetcher
    });

    const result = await client.lookup({
      doi: null,
      title: "源氏物語研究",
      authors: ["山田太郎"],
      issued_year: "2020"
    });

    const requested = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(requested.searchParams.get("search")).toBe("源氏物語研究");
    expect(requested.searchParams.get("per_page")).toBe("5");
    expect(requested.searchParams.has("per-page")).toBe(false);
    expect(requested.searchParams.get("api_key")).toBe("oa-key");
    expect(requested.searchParams.get("filter")).toContain("from_publication_date:2020-01-01");
    expect(result.items[0]).toMatchObject({
      provider: "openalex",
      id: "https://openalex.org/W123",
      doi: "10.1234/genji",
      title: "源氏物語研究",
      authors: ["山田 太郎"],
      issued_year: "2020"
    });
  });

  it("looks up OpenAlex DOI records under the works endpoint rather than a doi: URL scheme", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "https://openalex.org/W456",
        doi: "https://doi.org/10.1234/genji",
        title: "源氏物語研究",
        authorships: [],
        publication_year: 2020,
        primary_location: null,
        type: "article",
        cited_by_count: 0
      })
    );
    const client = createOpenAlexClient({
      baseUrl: "https://openalex.test/works",
      apiKey: "oa-key",
      fetcher
    });

    await client.lookup({
      doi: "10.1234/GENJI",
      title: null,
      authors: [],
      issued_year: null
    });

    const requested = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(requested.protocol).toBe("https:");
    expect(requested.pathname).toBe("/works/doi:10.1234%2Fgenji");
    expect(requested.searchParams.get("api_key")).toBe("oa-key");
  });

  it("skips OpenAlex without an api key instead of failing or calling upstream", async () => {
    const fetcher = vi.fn();
    const client = createOpenAlexClient({
      baseUrl: "https://openalex.test/works",
      apiKey: "",
      fetcher
    });

    const result = await client.lookup({
      doi: "10.1234/genji",
      title: null,
      authors: [],
      issued_year: null
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      provider: "openalex",
      status: "skipped",
      item_count: 0
    });
    expect(result.note).toMatch(/OPENALEX_API_KEY/);
  });
});
