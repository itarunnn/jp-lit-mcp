import { describe, expect, it } from "vitest";

import { createSourceRegistry } from "../src/services/sourceRegistry.js";
import type { SourceAdapter } from "../src/sources/types.js";

const dummyAdapter: SourceAdapter = {
  source: "ndl_search",
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

  it("未対応 source で例外を投げる", () => {
    const registry = createSourceRegistry([dummyAdapter]);

    expect(() => registry.get("ndl_digital")).toThrow("Unsupported source");
  });
});
