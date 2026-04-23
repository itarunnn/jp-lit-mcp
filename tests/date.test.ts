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

  it("/ 区切りの year-month を month 精度で返す", () => {
    expect(normalizeIssuedAt("1934/5")).toEqual({
      issuedAt: "1934-05",
      issuedAtLabel: "1934/5",
      issuedAtPrecision: "month"
    });
  });

  it("前後空白は trim 後に正規化する", () => {
    expect(normalizeIssuedAt(" 1905-04-01 ")).toEqual({
      issuedAt: "1905-04-01",
      issuedAtLabel: "1905-04-01",
      issuedAtPrecision: "day"
    });
  });

  it("無効月は unknown に落とす", () => {
    expect(normalizeIssuedAt("1934-13")).toEqual({
      issuedAt: null,
      issuedAtLabel: "1934-13",
      issuedAtPrecision: "unknown"
    });

    expect(normalizeIssuedAt("1934-00")).toEqual({
      issuedAt: null,
      issuedAtLabel: "1934-00",
      issuedAtPrecision: "unknown"
    });
  });

  it("無効日は unknown に落とす", () => {
    expect(normalizeIssuedAt("1905-02-31")).toEqual({
      issuedAt: null,
      issuedAtLabel: "1905-02-31",
      issuedAtPrecision: "unknown"
    });
  });

  it("day=00 は unknown に落とす", () => {
    expect(normalizeIssuedAt("1905-04-00")).toEqual({
      issuedAt: null,
      issuedAtLabel: "1905-04-00",
      issuedAtPrecision: "unknown"
    });
  });

  it("30日月の31日は unknown に落とす", () => {
    expect(normalizeIssuedAt("1905-04-31")).toEqual({
      issuedAt: null,
      issuedAtLabel: "1905-04-31",
      issuedAtPrecision: "unknown"
    });
  });

  it("うるう年の2月29日は day 精度で返す", () => {
    expect(normalizeIssuedAt("2000-02-29")).toEqual({
      issuedAt: "2000-02-29",
      issuedAtLabel: "2000-02-29",
      issuedAtPrecision: "day"
    });
  });

  it("うるう年でない年の2月29日は unknown に落とす", () => {
    expect(normalizeIssuedAt("1900-02-29")).toEqual({
      issuedAt: null,
      issuedAtLabel: "1900-02-29",
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
