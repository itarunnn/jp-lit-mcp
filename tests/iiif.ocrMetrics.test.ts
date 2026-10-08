import { describe, expect, it } from "vitest";

describe("OCR reference agreement", () => {
  it.each([
    ["甲乙丙", "甲丁丙", 1, 0, 0],
    ["甲乙丙", "甲丙", 0, 1, 0],
    ["甲乙", "甲丁乙", 0, 0, 1],
    ["𠮷野", "吉野", 1, 0, 0],
  ])("counts edits in code points: %s -> %s", async (ref, candidate, s, d, i) => {
    const { compareOcrText } = await import("../src/iiif/ocrMetrics.js");
    const result = compareOcrText(ref as string, candidate as string).strict;
    expect(result).toMatchObject({ distance: 1, substitutions: s, deletions: d, insertions: i });
    expect(result.reference_characters).toBe(ref === "甲乙丙" ? 3 : 2);
  });
  it("keeps a reading-order error visible when character F1 is perfect", async () => {
    const { compareOcrText } = await import("../src/iiif/ocrMetrics.js");
    expect(compareOcrText("甲乙", "乙甲").strict).toMatchObject({ distance: 2, cer: 1, f1: 1 });
  });
  it("counts repeated characters rather than a set of unique characters", async () => {
    const { compareOcrText } = await import("../src/iiif/ocrMetrics.js");
    expect(compareOcrText("甲乙乙", "乙甲").strict).toMatchObject({ precision: 1, recall: 2 / 3, f1: .8 });
  });
  it("reports strict and layout-insensitive agreement without compatibility folding", async () => {
    const { compareOcrText } = await import("../src/iiif/ocrMetrics.js");
    const result = compareOcrText("が\n甲　乙", "か\u3099甲乙");
    expect(result.strict.distance).toBeGreaterThan(0);
    expect(result.without_layout_whitespace).toMatchObject({ distance: 0, reference_characters: 3 });
    expect(compareOcrText("Ａ", "A").without_layout_whitespace.distance).toBe(1);
  });
  it("does not assign an accuracy to an empty reference and allows CER above one", async () => {
    const { compareOcrText } = await import("../src/iiif/ocrMetrics.js");
    expect(compareOcrText("", "字").strict).toMatchObject({ distance: 1, cer: null, recall: null, f1: null });
    expect(compareOcrText("", "").strict.f1).toBeNull();
    expect(compareOcrText("甲", "甲乙丙").strict.cer).toBe(2);
  });
  it("bounds expensive comparisons", async () => {
    const { compareOcrText } = await import("../src/iiif/ocrMetrics.js");
    expect(() => compareOcrText("甲".repeat(2001), "乙".repeat(2001))).toThrow(/上限/);
  });
  it("reports zero F1 when OCR returns no text against a nonempty reference",async()=>{
    const {compareOcrText}=await import("../src/iiif/ocrMetrics.js");
    expect(compareOcrText("甲乙","").strict).toMatchObject({deletions:2,cer:1,recall:0,f1:0});
  });
});
