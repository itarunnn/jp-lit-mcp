import { describe, expect, it } from "vitest";

import { buildDuplicateClusters } from "../src/lib/duplicateClustering.js";
import type { SearchItem } from "../src/lib/types.js";

function item(overrides: Partial<SearchItem>): SearchItem {
  return {
    source: "ndl_catalog",
    source_id: "id",
    title: "日本文学史",
    subtitle: null,
    title_reading: null,
    authors: [{ name: "佐藤一郎", role: null }],
    publisher: "東京書房",
    journal_title: null,
    issued_at: "1999",
    issued_at_label: "1999",
    issued_at_precision: "year",
    summary: null,
    url: null,
    availability: { online: false, digital_collection: false },
    material_type: "book",
    subjects: [],
    table_of_contents: [],
    source_metadata: {},
    duplicate_key: null,
    duplicate_count: 1,
    related_records: [],
    ...overrides
  };
}

describe("buildDuplicateClusters", () => {
  it("uses shared duplicate_key as a strong cluster", () => {
    const items = [
      item({ source: "ndl_catalog", source_id: "ndl-1", duplicate_key: "k1" }),
      item({ source: "cinii_books", source_id: "cinii-1", duplicate_key: "k1" })
    ];

    const result = buildDuplicateClusters(items, {
      clusterLimit: 20,
      clusterOffset: 0,
      memberLimit: 5
    });

    expect(result.summary.cluster_count).toBe(1);
    expect(result.clusters[0]?.duplicate_confidence).toBe("strong");
    expect(result.clusters[0]?.reasons).toContain("shared_duplicate_key");
    expect(result.clusters[0]?.representative.source).toBe("ndl_catalog");
  });

  it("clusters same title author year across sources without deleting records", () => {
    const items = [
      item({ source: "ndl_search", source_id: "search-1", publisher: null }),
      item({
        source: "jstage_articles",
        source_id: "jstage-1",
        journal_title: "文学研究",
        publisher: null
      })
    ];

    const result = buildDuplicateClusters(items, {
      clusterLimit: 20,
      clusterOffset: 0,
      memberLimit: 5
    });

    expect(result.summary.cluster_count).toBe(1);
    expect(result.summary.singleton_count).toBe(0);
    expect(result.clusters[0]?.member_count).toBe(2);
    expect(result.clusters[0]?.caution).toContain("自動削除");
  });

  it("uses loose keys even when duplicate_key differs", () => {
    const items = [
      item({ source: "ndl_catalog", source_id: "ndl-1", duplicate_key: "k1" }),
      item({ source: "cinii_books", source_id: "cinii-1", duplicate_key: "k2" })
    ];

    const result = buildDuplicateClusters(items, {
      clusterLimit: 20,
      clusterOffset: 0,
      memberLimit: 5
    });

    expect(result.clusters.some((cluster) =>
      cluster.reasons.includes("title_author_year_match")
    )).toBe(true);
  });

  it("does not cluster repeated appearances of the same source record", () => {
    const first = item({ source: "ndl_catalog", source_id: "same-id" });
    const result = buildDuplicateClusters([first, { ...first }], {
      clusterLimit: 20,
      clusterOffset: 0,
      memberLimit: 5
    });

    expect(result.summary.cluster_count).toBe(0);
    expect(result.clusters).toEqual([]);
  });
});
