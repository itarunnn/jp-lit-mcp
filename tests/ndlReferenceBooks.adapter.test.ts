import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`./fixtures/ndl-reference-books/${name}`, import.meta.url),
      "utf-8"
    )
  );
}

function referenceBookDetailPayload(referenceBook: boolean): unknown {
  return {
    list: [
      {
        id: "R100000002-I000002972211",
        meta: {
          t02450: [{ v: "哲学辞典" }],
          t0245c: [{ v: "哲学辞典編集委員会" }],
          t02600: [{ v: "東京堂出版" }],
          t02604: [{ v: "1985" }],
          k09022: [{ v: "図書" }],
          t06500: [{ v: "哲学" }],
          ...(referenceBook ? { t09800: [{ v: "SANKO" }] } : {}),
          k09810: [{ v: "103.3" }],
          t09812: [{ v: "第4版(1985年刊)と同内容。" }],
          t09815: [{ s: "1" }]
        },
        items: []
      }
    ]
  };
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(payload)
  };
}

describe("NDL 参考図書紹介 mapper", () => {
  it("紹介文と参考NDCを通常の書誌分類と分けて正規化する", async () => {
    const payload = readFixture("search-response.json");
    const { mapNdlReferenceBooksSearchResponse } = await import(
      "../src/sources/ndlSearch/mapReferenceBooks.js"
    );

    const result = mapNdlReferenceBooksSearchResponse(payload);

    expect(result.total).toBe(197);
    expect(result.items).toEqual([
      expect.objectContaining({
        source_id: "R100000002-I000002456549",
        title: "哲学辞典",
        summary: null,
        source_metadata: expect.objectContaining({
          reference_book: true,
          reference_ndc: ["103.3"],
          introduction: null,
          has_introduction: false
        })
      }),
      expect.objectContaining({
        source_id: "R100000002-I000002972211",
        title: "哲学辞典",
        summary: "第4版(1985年刊)と同内容。",
        source_metadata: expect.objectContaining({
          reference_book: true,
          reference_ndc: ["103.3"],
          introduction: "第4版(1985年刊)と同内容。",
          has_introduction: true
        })
      })
    ]);
    expect(result.items[0]?.source_metadata).not.toHaveProperty(
      "classification"
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createNdlReferenceBooksAdapter", () => {
  it("SANKO endpointへkeyword・size・0始まりfromを送る", async () => {
    const payload = JSON.stringify(readFixture("search-response.json"));
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      text: async () => payload
    });
    vi.stubGlobal("fetch", fetch);

    const { createNdlReferenceBooksAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlReferenceBooksAdapter({
      recordBaseUrl: "https://example.test/api/bib/external/search"
    });

    const result = await adapter.search({ query: "哲学", limit: 2, page: 2 });

    const url = new URL(fetch.mock.calls[0]?.[0] as string);
    expect(adapter.source).toBe("ndl_reference_books");
    expect(result.total).toBe(197);
    expect(result.items[0]?.source).toBe("ndl_reference_books");
    expect(url.searchParams.get("cs")).toBe("sanko");
    expect(url.searchParams.get("keyword")).toBe("哲学");
    expect(url.searchParams.get("size")).toBe("2");
    expect(url.searchParams.get("from")).toBe("2");
    expect(url.searchParams.has("operation")).toBe(false);
  });

  it("SANKO detailの紹介文と参考NDCを詳細結果へ保持する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(referenceBookDetailPayload(true))
    ));
    const { createNdlReferenceBooksAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlReferenceBooksAdapter({
      recordBaseUrl: "https://example.test/api/bib/external/search"
    });

    const record = await adapter.getRecord("R100000002-I000002972211");

    expect(record).toMatchObject({
      source: "ndl_reference_books",
      summary: "第4版(1985年刊)と同内容。",
      source_metadata: {
        reference_book: true,
        reference_ndc: ["103.3"],
        introduction: "第4版(1985年刊)と同内容。",
        has_introduction: true
      }
    });
  });

  it("非SANKO detailを参考図書として返さない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(referenceBookDetailPayload(false))
    ));
    const { createNdlReferenceBooksAdapter } = await import(
      "../src/sources/ndlSearch/adapter.js"
    );
    const adapter = createNdlReferenceBooksAdapter({
      recordBaseUrl: "https://example.test/api/bib/external/search"
    });

    await expect(
      adapter.getRecord("R100000002-I000002972211")
    ).resolves.toBeNull();
  });
});
