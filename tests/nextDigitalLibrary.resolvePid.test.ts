import { describe, expect, it } from "vitest";

import type { RecordItem } from "../src/lib/types.js";
import { resolveNextDigitalLibraryPid } from "../src/sources/nextDigitalLibrary/resolvePid.js";

function createRecord(
  overrides: Partial<Pick<RecordItem, "identifiers" | "content_access">> = {}
): Pick<RecordItem, "identifiers" | "content_access"> {
  return {
    identifiers: {},
    content_access: {
      has_page_images: false,
      has_text_coordinates: false,
      viewer_url: null,
      access_note: null
    },
    ...overrides
  };
}

describe("resolveNextDigitalLibraryPid", () => {
  it("identifiers.ndljp から PID を優先して解決する", () => {
    const result = resolveNextDigitalLibraryPid(
      createRecord({
        identifiers: {
          ndljp: "info:ndljp/pid/897115"
        },
        content_access: {
          has_page_images: true,
          has_text_coordinates: false,
          viewer_url: "https://dl.ndl.go.jp/pid/1111526/1/36",
          access_note: "インターネット公開"
        }
      })
    );

    expect(result).toEqual({
      pid: "897115",
      source: "ndljp"
    });
  });

  it("ndljp が無ければ viewer_url から PID を解決する", () => {
    const result = resolveNextDigitalLibraryPid(
      createRecord({
        content_access: {
          has_page_images: true,
          has_text_coordinates: false,
          viewer_url: "https://dl.ndl.go.jp/pid/1111526/1/36",
          access_note: "インターネット公開"
        }
      })
    );

    expect(result).toEqual({
      pid: "1111526",
      source: "viewer_url"
    });
  });

  it("viewer_url が /pid/{n} 直下でも解決する", () => {
    const result = resolveNextDigitalLibraryPid(
      createRecord({
        content_access: {
          has_page_images: true,
          has_text_coordinates: false,
          viewer_url: "https://dl.ndl.go.jp/pid/1000732",
          access_note: "インターネット公開"
        }
      })
    );

    expect(result).toEqual({
      pid: "1000732",
      source: "viewer_url"
    });
  });

  it("PID を解決できなければ null を返す", () => {
    const result = resolveNextDigitalLibraryPid(
      createRecord({
        identifiers: {
          ndljp: "not-a-pid"
        },
        content_access: {
          has_page_images: false,
          has_text_coordinates: false,
          viewer_url: "https://example.test/viewer/abc",
          access_note: null
        }
      })
    );

    expect(result).toBeNull();
  });
});
