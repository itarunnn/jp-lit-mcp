import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

function readFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`./fixtures/next-digital-library/${name}`, import.meta.url),
      "utf-8"
    )
  );
}

function makeFetchOk(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-type"
          ? "application/json; charset=utf-8"
          : null;
      }
    },
    text: async () => JSON.stringify(payload),
    json: async () => payload
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createNextDigitalLibraryClient", () => {
  it("Book API を叩ける", async () => {
    const payload = readFixture("book-response.json");
    vi.stubGlobal("fetch", makeFetchOk(payload));

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    await expect(client.getBook("897115")).resolves.toEqual(payload);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      "https://lab.ndl.go.jp/dl/api/book/897115"
    );
  });

  it("Page API を叩ける", async () => {
    const payload = readFixture("page-response.json");
    vi.stubGlobal("fetch", makeFetchOk(payload));

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient({
      baseUrl: "https://lab.ndl.go.jp/dl/api/"
    });

    await expect(client.getPage("897115", 1)).resolves.toEqual(payload);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      "https://lab.ndl.go.jp/dl/api/page/897115_1"
    );
  });

  it("fulltext-json API を叩ける", async () => {
    const payload = readFixture("fulltext-json-response.json");
    vi.stubGlobal("fetch", makeFetchOk(payload));

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    const result = await client.getFulltextJson("897115");
    expect(result).toEqual(payload);
    expect((result as { list: unknown[] }).list).toHaveLength(2);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      "https://lab.ndl.go.jp/dl/api/book/fulltext-json/897115"
    );
  });

  it("getFulltextJson は application/octet-stream でも JSON をパースできる", async () => {
    const payload = readFixture("fulltext-json-response.json");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type"
              ? "application/octet-stream"
              : null;
          }
        },
        text: async () => JSON.stringify(payload),
        json: async () => payload
      })
    );

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    const result = await client.getFulltextJson("897115");
    expect(result).toEqual(payload);
  });

  it("getFulltextJson は過大なレスポンスを拒否する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get() {
            return "application/octet-stream";
          }
        },
        text: async () => `{"list":["${"a".repeat(5_100_000)}"]}`
      })
    );

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    await expect(client.getFulltextJson("897115")).rejects.toMatchObject({
      name: "UnsupportedPayloadError"
    });
  });

  it("404 は null を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found"
      })
    );

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    await expect(client.getBook("missing")).resolves.toBeNull();
    await expect(client.getPage("missing", 1)).resolves.toBeNull();
    await expect(client.getFulltextJson("missing")).resolves.toBeNull();
  });

  it("page/search API を叩ける", async () => {
    const payload = readFixture("page-search-response.json");
    vi.stubGlobal("fetch", makeFetchOk(payload));

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    const result = await client.searchPages("897115", "図書館", { size: 10, from: 0 });
    expect(result).toEqual(payload);
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("/page/search");
    expect(url).toContain("f-book=897115");
    expect(url).toContain("q-contents=%E5%9B%B3%E6%9B%B8%E9%A4%A8");
  });

  it("book/search API を叩ける", async () => {
    const payload = readFixture("book-search-response.json");
    vi.stubGlobal("fetch", makeFetchOk(payload));

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    const result = await client.searchBooks("大政奉還", {
      searchfield: "contentonly",
      size: 2,
      fNdc: "9*",
      fcIsClassic: true
    });
    expect(result).toEqual(payload);
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    const params = new URL(url).searchParams;
    expect(url).toContain("/book/search");
    expect(params.get("keyword")).toBe("大政奉還");
    expect(params.get("searchfield")).toBe("contentonly");
    expect(params.get("f-ndc")).toBe("9*");
    expect(params.get("fc-isClassic")).toBe("true");
    expect(params.get("field")).toBeNull();
    expect(params.get("ndc")).toBeNull();
    expect(params.get("isClassic")).toBeNull();
  });

  it("illustration/searchbytext API を叩ける", async () => {
    const payload = readFixture("illustration-search-response.json");
    vi.stubGlobal("fetch", makeFetchOk(payload));

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    const result = await client.searchIllustrations("富士山", { size: 2 });
    expect(result).toEqual(payload);
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    const params = new URL(url).searchParams;
    expect(url).toContain("/illustration/searchbytext");
    expect(params.get("keyword2vec")).toBe("富士山");
    expect(params.get("q-contents")).toBeNull();
    expect(params.get("graphictag")).toBeNull();
  });

  it("searchIllustrations は 404 で null を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" })
    );

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    await expect(client.searchIllustrations("missing")).resolves.toBeNull();
  });

  it("searchBooks は 404 で null を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" })
    );

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    await expect(client.searchBooks("missing")).resolves.toBeNull();
  });

  it("searchPages は 404 で null を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found"
      })
    );

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    await expect(client.searchPages("missing", "keyword")).resolves.toBeNull();
  });

  it("getBook はネットワークエラー（UpstreamHttpError 以外）を伝播する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    await expect(client.getBook("897115")).rejects.toBeInstanceOf(TypeError);
  });

  it("getBook は 500 も null を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error"
      })
    );

    const { createNextDigitalLibraryClient } = await import(
      "../src/sources/nextDigitalLibrary/adapter.js"
    );
    const client = createNextDigitalLibraryClient();

    await expect(client.getBook("1000732")).resolves.toBeNull();
  });
});
