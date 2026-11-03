import { afterEach, describe, expect, it, vi } from "vitest";

import { createNationalArchivesAdapter } from "../src/sources/nationalArchives/adapter.js";
import { createJacarAdapter } from "../src/sources/jacar/adapter.js";
import { createNinjalBibliographyAdapter } from "../src/sources/ninjalBibliography/adapter.js";
import { createKokushoAdapter } from "../src/sources/kokusho/adapter.js";

afterEach(() => vi.unstubAllGlobals());

const sourceFactories = [
  ["national_archives", createNationalArchivesAdapter],
  ["jacar", createJacarAdapter],
  ["ninjal_bibliography", createNinjalBibliographyAdapter]
] as const;

// 外部検索を固定順の113件で代替し、実adapterとmapperの返却結果を検証する。
function installHtmlSource(source: string) {
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = new URL(input);
    const size = Number(url.searchParams.get("rows") ?? url.searchParams.get("per"));
    const offset = source === "ninjal_bibliography"
      ? Number(url.searchParams.get("skip") ?? "0")
      : (Number(url.searchParams.get("page")) - 1) * size;
    const rows: string[] = [];
    for (let position = offset + 1; position <= Math.min(offset + size, 113); position++) {
      const title = `資料${position}`;
      if (source === "national_archives") rows.push(`<a href="/file/${position}.html">${title}</a>`);
      else if (source === "jacar") rows.push(`<a href="/das/meta/A${String(position).padStart(11, "0")}">${title}</a>`);
      else rows.push(`<li class="media"><a href="/bunken/ja/article/${position}">${title}</a></li>`);
    }
    return new Response(`<html><span data-count="113">113 件中</span>${rows.join("\n")}</html>`, {
      headers: { "content-type": "text/html" }
    });
  });
}

describe.each(sourceFactories)("%s の利用者ページ", (source, factory) => {
  it.each([
    { limit: 5, page: 2, first: "資料6", last: "資料10", count: 5 },
    { limit: 30, page: 2, first: "資料31", last: "資料60", count: 30 },
    { limit: 30, page: 4, first: "資料91", last: "資料113", count: 23 },
    { limit: 30, page: 5, first: undefined, last: undefined, count: 0 }
  ])("limit=$limit page=$page は欠落なく返す", async ({ limit, page, first, last, count }) => {
    installHtmlSource(source);
    const result = await factory().search({ query: "資料", limit, page });
    expect(result.total).toBe(113);
    expect(result.items).toHaveLength(count);
    expect(result.items[0]?.title).toBe(first);
    expect(result.items.at(-1)?.title).toBe(last);
    // 中間の重複・欠落も検出する。
    expect(result.items.map(item => item.title)).toEqual(
      Array.from({ length: count }, (_, index) => `資料${(page - 1) * limit + index + 1}`)
    );
  });
});

describe("国書DBの利用者ページ", () => {
  it.each([
    { page: 1, ids: ["101", "102"] },
    { page: 2, ids: ["103"] },
    { page: 3, ids: [] }
  ])("page=$page は対応する区間を返す", async ({ page, ids }) => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify([
      { bid: 101, name: "資料一" }, { bid: 102, name: "資料二" }, { bid: 103, name: "資料三" }
    ]), { headers: { "content-type": "application/json" } }));
    const result = await createKokushoAdapter().search({ query: "資料", limit: 2, page });
    expect(result.total).toBe(3);
    expect(result.items.map(item => item.source_id)).toEqual(ids);
  });
});
