import { describe, expect, it } from "vitest";
import { regionToImageCrop } from "../src/iiif/evidence.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
const info = {
  service_id: "https://example.org/image",
  version: "2",
  width: 2000,
  height: 4000,
  profile: "http://iiif.io/api/image/2/level1.json",
  rights: [],
  receipt: sampleWorkspace().documents[0].receipt,
};
describe("Canvas to image geometry", () => {
  it("scales Canvas coordinates to image pixels and requests a bounded display rendition", () => {
    const w = sampleWorkspace();
    const r = regionToImageCrop(
      w.regions[0].selection as any,
      w.documents[0].canvases[0] as any,
      info as any,
    );
    expect(r.image_xywh).toEqual([200, 400, 600, 800]);
    expect(r.image_url).toBe(
      "https://example.org/image/200,400,600,800/,800/0/default.jpg",
    );
    const large = regionToImageCrop(
      {
        ...w.regions[0].selection,
        xywh: [0, 0, 1000, 2000],
        rotation_degrees: 90,
      } as any,
      w.documents[0].canvases[0] as any,
      info as any,
    );
    expect(large.image_url).toBe(
      "https://example.org/image/0,0,2000,4000/,2048/0/default.jpg",
    );
  });
  it("uses verified service dimensions for a thumbnail painting and defers unverified dimensions", () => {
    const w = sampleWorkspace(),
      c = w.documents[0].canvases[0];
    c.images[0].width = 500;
    c.images[0].height = 1000;
    expect(
      regionToImageCrop(w.regions[0].selection as any, c as any, info as any)
        .image_xywh,
    ).toEqual([200, 400, 600, 800]);
    expect(
      regionToImageCrop(w.regions[0].selection as any, c as any).status,
    ).toBe("unsupported");
    expect(
      regionToImageCrop(
        w.regions[0].selection as any,
        c as any,
        { ...info, service_id: "https://example.org/other" } as any,
      ).status,
    ).toBe("unsupported");
  });
  it("rejects composite and partial painting without inventing a crop", () => {
    const w = sampleWorkspace();
    const c = w.documents[0].canvases[0];
    expect(
      regionToImageCrop(
        w.regions[0].selection as any,
        { ...c, images: [...c.images, ...c.images] } as any,
      ).status,
    ).toBe("unsupported");
    expect(
      regionToImageCrop(
        w.regions[0].selection as any,
        {
          ...c,
          images: [{ ...c.images[0], target: c.canvas_id + "#xywh=0,0,1,1" }],
        } as any,
      ).image_url,
    ).toBeNull();
  });
});
