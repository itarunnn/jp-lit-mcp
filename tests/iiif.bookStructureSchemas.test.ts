import { expect, it } from "vitest";
import { parseBookStructure } from "../src/iiif/bookStructureSchemas.js";
import { bookFixture } from "./fixtures/iiif/bookStructure.js";

it("preserves a non-text figure and a Unicode text range without inventing word geometry", () => {
  const b = bookFixture(); b.spans[0].range_cp = [0,6];
  const parsed = parseBookStructure(b);
  expect(parsed.regions[0].line_refs).toEqual([]);
  expect(parsed.units[0].fields[0].raw_text).toBe("圖一　𠮷の花");
  expect(parsed.spans[0].range_cp).toEqual([0,6]);
});

it.each(["dangling", "range", "bounds", "cycle", "duplicate", "raw"])("rejects %s corruption", kind => {
  const b = bookFixture(); b.spans[0].range_cp = [0,6];
  if (kind === "dangling") b.units[0].region_ids = ["missing"];
  if (kind === "range") b.spans[0].range_cp = [0,7];
  if (kind === "bounds") b.regions[0].canvas_xywh = [999,0,20,20];
  if (kind === "duplicate") b.regions.push(b.regions[0]);
  if (kind === "raw") b.units[0].fields[0].raw_text = "勝手な復元";
  if (kind === "cycle") b.relations = [{ relation_id: "rel1", kind: "contains", from_id: "u1", to_id: "u1", reasons: [], score: null, state: "candidate" }];
  expect(() => parseBookStructure(b)).toThrow();
});

it("retains unlocated text and independent entries with the same spelling", () => {
  const b = bookFixture(); b.spans[0].range_cp = [0,6];
  b.lines[0].image_xywh = null; b.lines[0].canvas_xywh = null;
  b.units = [{ unit_id: "e1", kind: "entry", region_ids: [], span_ids: ["s1"], fields: [] },
    { unit_id: "e2", kind: "entry", region_ids: [], span_ids: ["s1"], fields: [] }];
  expect(parseBookStructure(b).units.map(u => u.unit_id)).toEqual(["e1", "e2"]);
});
