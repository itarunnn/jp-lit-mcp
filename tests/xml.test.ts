import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchText, UpstreamHttpError } from "../src/lib/http.js";
import { parseXml, projectOpenSearchXml } from "../src/lib/xml.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("xml helpers", () => {
  it("OpenSearch XML を object に変換できる", () => {
    const xml =
      '<?xml version="1.0"?><rss><channel><title>test</title></channel></rss>';

    const parsed = parseXml(xml);

    expect(parsed.rss).toEqual({
      channel: {
        title: "test"
      }
    });
  });

  it("channel/item を JSON-compatible projection に落とせる", () => {
    const xml = `<?xml version="1.0"?>
      <rss>
        <channel>
          <openSearch:totalResults>1</openSearch:totalResults>
          <item>
            <title>国立国会図書館年報</title>
          </item>
        </channel>
      </rss>`;

    const projected = projectOpenSearchXml(xml);

    expect(projected).toEqual({
      channel: {
        "openSearch:totalResults": "1",
        item: {
          title: "国立国会図書館年報"
        }
      }
    });
  });
});

describe("fetchText", () => {
  it("response body と content-type を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type"
              ? "application/rss+xml; charset=utf-8"
              : null;
          }
        },
        text: async () =>
          '<?xml version="1.0"?><rss><channel><title>test</title></channel></rss>'
      })
    );

    await expect(fetchText("https://example.test/opensearch")).resolves.toEqual({
      text: '<?xml version="1.0"?><rss><channel><title>test</title></channel></rss>',
      contentType: "application/rss+xml; charset=utf-8"
    });
  });

  it("upstream 非 2xx は UpstreamHttpError を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway"
      })
    );

    await expect(fetchText("https://example.test/opensearch")).rejects.toEqual(
      new UpstreamHttpError(502, "Bad Gateway")
    );
  });
});
