import { describe, expect, it } from "vitest";
import { normalizeServiceInfo } from "../src/iiif/serviceInfo.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
describe("Image Service original dimensions", () => {
  it("checks the service identity, API version and positive original pixel dimensions", () => {
    const w = sampleWorkspace(),
      service = w.documents[0].canvases[0].images[0].service;
    const raw = {
      "@context": "http://iiif.io/api/image/2/context.json",
      "@id": service.service_id,
      width: 2000,
      height: 4000,
      profile: service.profile,
    };
    const resource = (value: unknown) => ({
      body: Buffer.from(JSON.stringify(value)),
      content_type: "application/json",
      receipt: w.documents[0].receipt,
    });
    expect(normalizeServiceInfo(resource(raw), service as any).width).toBe(
      2000,
    );
    for (const patch of [
      { "@id": "https://example.org/other" },
      { "@context": "http://iiif.io/api/image/3/context.json" },
      { width: 0 },
      { height: 1.5 },
    ])
      expect(() =>
        normalizeServiceInfo(resource({ ...raw, ...patch }), service as any),
      ).toThrow();
    expect(
      normalizeServiceInfo(
        resource({
          ...raw,
          "@context": "http://iiif.io/api/image/3/context.json",
          type: "ImageService3",
          id: service.service_id,
          profile: "level1",
        }),
        { ...service, version: "3" } as any,
      ).version,
    ).toBe("3");
  });
});
