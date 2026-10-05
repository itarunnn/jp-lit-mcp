import { describe, expect, it } from "vitest";
import { validateWorkspace } from "../src/iiif/schemas.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { ocrCandidate, ocrSource } from "./fixtures/iiif/ocr.js";
describe("OCR provenance in existing workspaces", () => {
  it("preserves the original candidate and attributed provenance on save validation", () => {
    const w = sampleWorkspace(), t = ocrCandidate();
    (w.texts as unknown[]).push(t); w.regions[0].text_evidence_ids.push(t.text_id);
    expect(validateWorkspace(w).texts[0]).toEqual(t);
  });
  it("rejects automatic promotion of an OCR candidate to verified text", () => {
    const w = sampleWorkspace(), t = ocrCandidate(); t.verification_state = "human_verified";
    (w.texts as unknown[]).push(t);
    expect(() => validateWorkspace(w)).toThrow(/OCR/);
  });
});
describe("NDL Koten OCR line coordinates", () => {
  const raw = () => ({ imginfo: { img_width: 150, img_height: 200 }, contents: [[{
    id: 0, text: "舊字\n候補", boundingBox: [[10,20],[10,120],[60,20],[60,120]], confidence: .7,
  }]] });
  async function parse(data: unknown, source = ocrSource()) {
    const { normalizeKotenOutput } = await import("../src/iiif/ocr.js");
    return normalizeKotenOutput(data, source);
  }
  it("maps cropped and downsampled image pixels back to Canvas without changing text", async () => {
    const lines = await parse(raw());
    expect(lines[0]).toMatchObject({ line_id: "0", text: "舊字\n候補", image_xywh: [10,20,50,100], canvas_xywh: [120,240,100,200], detection_confidence: .7 });
    expect(lines[0].bounding_box).toEqual(raw().contents[0][0].boundingBox);
  });
  it.each(["dimensions", "outside", "nonfinite", "duplicate", "confidence"])("rejects incompatible output: %s", async (kind) => {
    const r = raw();
    if (kind === "dimensions") r.imginfo.img_width = 151;
    if (kind === "outside") r.contents[0][0].boundingBox[0][0] = -1;
    if (kind === "nonfinite") r.contents[0][0].boundingBox[0][0] = NaN;
    if (kind === "duplicate") r.contents[0].push(structuredClone(r.contents[0][0]));
    if (kind === "confidence") r.contents[0][0].confidence = 1.5;
    await expect(parse(r)).rejects.toThrow();
  });
  it("retains zero detected lines as an explicit empty candidate", async () => {
    const r = raw(); r.contents = [[]];
    expect(await parse(r)).toEqual([]);
  });
});
