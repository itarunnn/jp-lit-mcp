import { describe, expect, it } from "vitest";

import { normalizeIssuedAt } from "../src/lib/date.js";
import { compactStrings } from "../src/lib/normalize.js";

describe("normalizeIssuedAt", () => {
  it("exact ISO date を day 精度で返す", () => {
    expect(normalizeIssuedAt("1905-04-01")).toEqual({
      issuedAt: "1905-04-01",
      issuedAtLabel: "1905-04-01",
      issuedAtPrecision: "day"
    });
  });

  it("year-month を month 精度で返す", () => {
    expect(normalizeIssuedAt("1934.5")).toEqual({
      issuedAt: "1934-05",
      issuedAtLabel: "1934.5",
      issuedAtPrecision: "month"
    });
  });

  it("year only を year 精度で返す", () => {
    expect(normalizeIssuedAt("1905")).toEqual({
      issuedAt: "1905",
      issuedAtLabel: "1905",
      issuedAtPrecision: "year"
    });
  });

  it("解釈できない文字列は label を残して unknown を返す", () => {
    expect(normalizeIssuedAt("昭和初期")).toEqual({
      issuedAt: null,
      issuedAtLabel: "昭和初期",
      issuedAtPrecision: "unknown"
    });
  });

  it("空値はすべて null/unknown にする", () => {
    expect(normalizeIssuedAt("  ")).toEqual({
      issuedAt: null,
      issuedAtLabel: null,
      issuedAtPrecision: "unknown"
    });
  });
});

describe("compactStrings", () => {
  it("空文字や空白を除去してトリム済み配列を返す", () => {
    expect(compactStrings(["  foo ", null, " ", undefined, "bar"])).toEqual([
      "foo",
      "bar"
    ]);
  });
});
