export function bookFixture(): any {
  return {
    schema_version: "0.1", structure_id: "book-1", profile: "illustrated", workspace_id: "w1", document_id: "d1",
    inputs: [], diagnostics: [], reviews: [], revisions: [],
    pages: [{ page_id: "p1", sequence_index: 0, printed_label: "1", canvas_id: "https://example.org/c1",
      canvas_width: 1000, canvas_height: 2000, canvas_xywh: [100,200,300,400], image_path: "/images/p1.png",
      image_sha256: "a".repeat(64), image_width: 150, image_height: 200, text_id: "t1", coverage: "ready" }],
    lines: [{ line_ref: "l1", page_id: "p1", original_line_id: "0", raw_text: "圖一　𠮷の花",
      image_xywh: [10,150,120,20], canvas_xywh: [120,500,240,40], source_locator: {} }],
    regions: [{ region_id: "r1", page_id: "p1", kind: "figure", image_xywh: [10,10,120,120],
      canvas_xywh: [120,220,240,240], line_refs: [], origin: "ocr_layout", source_locator: {} }],
    spans: [{ span_id: "s1", line_ref: "l1", range_cp: [0,7] }],
    units: [{ unit_id: "u1", kind: "figure", region_ids: ["r1"], span_ids: ["s1"],
      fields: [{ field_id: "f1", role: "caption", span_ids: ["s1"], raw_text: "圖一　𠮷の花", text: "圖一　𠮷の花", normalized_text: "圖一　𠮷の花" }] }],
    relations: [],
  };
}
