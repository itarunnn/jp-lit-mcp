import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function readFixture(name: string) {
  return readFileSync(
    new URL(`./fixtures/ndl-sru/${name}`, import.meta.url),
    "utf-8"
  );
}

describe("projectNdlSruSearchResponse", () => {
  it("catalog fixture を mapper 互換 shape に投影できる", async () => {
    const { projectNdlSruSearchResponse } = await import(
      "../src/sources/ndlSearch/parseSru.js"
    );

    const result = projectNdlSruSearchResponse(
      readFixture("search-ndl-catalog-dcndl-xml.xml")
    );

    expect(result.totalResults).toBe("4997098");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items[0]).toMatchObject({
      id: "R100000002-I000001268385",
      title: "あ : 小森典詩作品集",
      digitalCollection: true,
      materialType: "図書"
    });
    expect(result.facets).toMatchObject({
      providers: {
        R100000002: 4996561
      },
      ndc: {
        "9": 408529
      }
    });
  });

  it("articles fixture から journalTitle と ciniiCrid を抽出できる", async () => {
    const { projectNdlSruSearchResponse } = await import(
      "../src/sources/ndlSearch/parseSru.js"
    );

    const result = projectNdlSruSearchResponse(
      readFixture("search-ndl-articles.xml")
    );

    expect(result.items[0]).toMatchObject({
      id: "R000000004-I028622976",
      ciniiCrid: "1520009409428206720",
      journalTitle: "日本英学史学会英学史研究",
      materialType: "記事・論文"
    });
  });

  it("articles-online fixture から accessRights と viewerUrl を抽出できる", async () => {
    const { projectNdlSruSearchResponse } = await import(
      "../src/sources/ndlSearch/parseSru.js"
    );

    const result = projectNdlSruSearchResponse(
      readFixture("search-ndl-articles-online.xml")
    );

    expect(result.items[0]).toMatchObject({
      id: "R000000004-I033033602",
      accessNote: "インターネット公開",
      viewerUrl: "https://dl.ndl.go.jp/info:ndljp/pid/11449002",
      digitalCollection: true
    });
  });

  it("dcterms:tableOfContents が複数ある場合 tableOfContents 配列に投影される", async () => {
    const { projectNdlSruSearchResponse } = await import(
      "../src/sources/ndlSearch/parseSru.js"
    );

    const result = projectNdlSruSearchResponse(readFixture("search-toc.xml"));

    expect(result.items[0]).toMatchObject({
      id: "R100000002-I000007654321",
      tableOfContents: ["金剛石", "月下の陣", "羅生門"]
    });
  });
});
