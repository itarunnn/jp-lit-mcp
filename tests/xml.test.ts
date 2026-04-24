import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchText,
  UnsupportedPayloadError,
  UpstreamHttpError
} from "../src/lib/http.js";
import {
  InvalidXmlError,
  parseXml,
  parseXmlPayload,
  projectOpenSearchXml
} from "../src/lib/xml.js";

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

  it("channel/item を一定 shape に投影し、attributes と複数 item を保持する", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0" xml:lang="ja">
        <channel data-source="ndl">
          <openSearch:totalResults>2</openSearch:totalResults>
          <item data-kind="book">
            <title>国立国会図書館年報</title>
          </item>
          <item data-kind="journal">
            <title>国文学論集</title>
          </item>
        </channel>
      </rss>`;

    const projected = projectOpenSearchXml(xml);

    expect(projected).toEqual({
      rss: {
        "@_version": "2.0",
        "@_xml:lang": "ja",
        channel: {
          "@_data-source": "ndl",
          "openSearch:totalResults": "2",
          item: [
            {
              "@_data-kind": "book",
              title: "国立国会図書館年報"
            },
            {
              "@_data-kind": "journal",
              title: "国文学論集"
            }
          ]
        }
      },
      channel: {
        "@_data-source": "ndl",
        "openSearch:totalResults": "2",
        item: [
          {
            "@_data-kind": "book",
            title: "国立国会図書館年報"
          },
          {
            "@_data-kind": "journal",
            title: "国文学論集"
          }
        ]
      },
      items: [
        {
          "@_data-kind": "book",
          title: "国立国会図書館年報"
        },
        {
          "@_data-kind": "journal",
          title: "国文学論集"
        }
      ]
    });
  });

  it("壊れた XML は InvalidXmlError を投げる", () => {
    expect(() => parseXml("<rss><channel><item></channel></rss>")).toThrow(
      InvalidXmlError
    );
  });

  it("XML payload guard は content-type 不一致と JSON body を拒否する", () => {
    const xml =
      '<?xml version="1.0"?><rss><channel><title>test</title></channel></rss>';

    expect(() =>
      parseXmlPayload({
        text: xml,
        contentType: "text/html; charset=utf-8"
      })
    ).toThrow(UnsupportedPayloadError);

    expect(() =>
      parseXmlPayload({
        text: '{"ok":true}',
        contentType: "application/json"
      })
    ).toThrow(UnsupportedPayloadError);

    expect(() =>
      parseXmlPayload({
        text: '{"ok":true}',
        contentType: null
      })
    ).toThrow(UnsupportedPayloadError);
  });

  it("XML payload guard は XML content-type の payload を通す", () => {
    const xml =
      '<?xml version="1.0"?><rss><channel><title>test</title></channel></rss>';

    const parsed = parseXmlPayload({
      text: xml,
      contentType: "application/rss+xml; charset=utf-8"
    });

    expect(parsed.rss).toEqual({
      channel: {
        title: "test"
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
