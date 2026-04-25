import { describe, expect, it } from "vitest";

import { createSourceRegistry } from "../src/services/sourceRegistry.js";
import type { SourceAdapter } from "../src/sources/types.js";

const dummyAdapter: SourceAdapter = {
  source: "ndl_search",
  search: async () => ({ total: 0, items: [] }),
  getRecord: async () => null
};

const ndlDigitalAdapter: SourceAdapter = {
  source: "ndl_digital",
  search: async () => ({ total: 0, items: [] }),
  getRecord: async () => null
};

const ciniiArticlesAdapter: SourceAdapter = {
  source: "cinii_articles",
  search: async () => ({ total: 0, items: [] }),
  getRecord: async () => null
};

const ciniiBooksAdapter: SourceAdapter = {
  source: "cinii_books",
  search: async () => ({ total: 0, items: [] }),
  getRecord: async () => null
};

describe("createSourceRegistry", () => {
  it("source 名から adapter を引ける", () => {
    const registry = createSourceRegistry([dummyAdapter]);

    expect(registry.get("ndl_search")).toBe(dummyAdapter);
  });

  it("登録済み source 一覧を返す", () => {
    const registry = createSourceRegistry([dummyAdapter]);

    expect(registry.list()).toEqual(["ndl_search"]);
  });

  it("複数 adapter の source 一覧を返す", () => {
    const registry = createSourceRegistry([
      dummyAdapter,
      ndlDigitalAdapter,
      ciniiArticlesAdapter,
      ciniiBooksAdapter
    ]);

    expect(registry.list()).toEqual([
      "ndl_search",
      "ndl_digital",
      "cinii_articles",
      "cinii_books"
    ]);
  });

  it("未対応 source で例外を投げる", () => {
    const registry = createSourceRegistry([dummyAdapter]);

    expect(() => registry.get("ndl_digital")).toThrow("Unsupported source");
  });

  it("同じ source の adapter 重複登録で例外を投げる", () => {
    expect(() =>
      createSourceRegistry([
        dummyAdapter,
        {
          ...dummyAdapter,
          search: async () => ({ total: 1, items: [] })
        }
      ])
    ).toThrow("Duplicate source");
  });
});
