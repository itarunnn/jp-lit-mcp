import { describe, expect, it } from "vitest";

import {
  DEFAULT_LIVE_RETRY_COUNT,
  EXPECTED_TOOL_NAMES,
  LIVE_MATRIX_SOURCES,
  getLiveErrorMessage,
  isSkippableLiveError,
  pickPreferredLiveRecord,
  resolveIllustrationFallbackKeyword,
  resolveLiveReportPath,
  resolveLiveRetryCount,
  resolveOcrFallbackKeyword,
  resolveLiveSmokeSources,
  resolveLiveSmokeQuery
} from "../scripts/smoke-mcp.js";

describe("smoke-mcp tool manifest", () => {
  it("tracks all runtime tools exposed by the server", () => {
    expect(EXPECTED_TOOL_NAMES).toEqual([
      "jp_lit_annotate_session",
      "jp_lit_export_session",
      "jp_lit_get_fulltext",
      "jp_lit_get_record",
      "jp_lit_get_text_coordinates",
      "jp_lit_search",
      "jp_lit_search_fulltext",
      "jp_lit_search_illustrations",
      "jp_lit_search_pages"
    ]);
  });

  it("uses source-specific default queries for sparse providers", () => {
    expect(resolveLiveSmokeQuery("jstage_articles", undefined)).toBe("癌");
    expect(resolveLiveSmokeQuery("ndl_catalog", undefined)).toBe("菊池寛");
    expect(resolveLiveSmokeQuery("kokkai_minutes", undefined)).toBe("賭博");
    expect(resolveLiveSmokeQuery("teikoku_minutes", undefined)).toBe("賭博");
    expect(resolveLiveSmokeQuery("jstage_articles", "材料")).toBe("材料");
  });

  it("prefers ndl_digital records with next_digital_library.available=true", () => {
    const selected = pickPreferredLiveRecord("ndl_digital", [
      {
        source_id: "first",
        source_metadata: {
          next_digital_library: { available: false }
        }
      },
      {
        source_id: "second",
        source_metadata: {
          next_digital_library: { available: true }
        }
      }
    ]);

    expect(selected?.source_id).toBe("second");
  });

  it("uses a stable OCR fallback keyword for ndl_digital", () => {
    expect(resolveOcrFallbackKeyword("ndl_digital", undefined)).toBe("大政奉還");
    expect(resolveOcrFallbackKeyword("ndl_digital", "文明開化")).toBe("文明開化");
  });

  it("uses a stable illustration fallback keyword for ndl_digital", () => {
    expect(resolveIllustrationFallbackKeyword("ndl_digital", undefined)).toBe("富士山");
    expect(resolveIllustrationFallbackKeyword("ndl_digital", "鳥居")).toBe("鳥居");
  });

  it("treats jdcat 503 as skippable live smoke failure", () => {
    expect(
      getLiveErrorMessage({
        isError: true,
        content: [{ type: "text", text: "Upstream request failed: 503 Service Temporarily Unavailable" }]
      })
    ).toBe("Upstream request failed: 503 Service Temporarily Unavailable");
    expect(
      isSkippableLiveError("jdcat", {
        isError: true,
        content: [{ type: "text", text: "Upstream request failed: 503 Service Temporarily Unavailable" }]
      })
    ).toBe(true);
    expect(
      isSkippableLiveError("kokkai_minutes", {
        isError: true,
        content: [{ type: "text", text: "Upstream request failed: 503 Service Temporarily Unavailable" }]
      })
    ).toBe(false);
  });

  it("exposes stable default live smoke matrix sources", () => {
    expect(LIVE_MATRIX_SOURCES).toEqual([
      "ndl_catalog",
      "ndl_digital",
      "cinii_books",
      "nihu_bridge",
      "jstage_articles",
      "kokkai_minutes",
      "teikoku_minutes",
      "irdb",
      "jdcat"
    ]);
  });

  it("resolves live smoke sources from override or default matrix", () => {
    expect(resolveLiveSmokeSources(undefined)).toEqual(LIVE_MATRIX_SOURCES);
    expect(resolveLiveSmokeSources("ndl_catalog,jdcat")).toEqual([
      "ndl_catalog",
      "jdcat"
    ]);
  });

  it("uses stable defaults for live retry count", () => {
    expect(DEFAULT_LIVE_RETRY_COUNT).toBe(2);
    expect(resolveLiveRetryCount(undefined)).toBe(2);
    expect(resolveLiveRetryCount("3")).toBe(3);
  });

  it("writes matrix report to exports by default", () => {
    expect(resolveLiveReportPath("J:/apps/ndl-jp-lit-mcp", undefined)).toBe(
      "J:\\apps\\ndl-jp-lit-mcp\\exports\\live-smoke-report.json"
    );
    expect(
      resolveLiveReportPath("J:/apps/ndl-jp-lit-mcp", "J:/tmp/custom-report.json")
    ).toBe("J:\\tmp\\custom-report.json");
  });
});
