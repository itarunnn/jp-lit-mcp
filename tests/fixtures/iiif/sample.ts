export function sampleWorkspace() {
  return {
    schema_version: "0.1",
    workspace_id: "w1",
    created_at: "2026-10-05T00:00:00Z",
    documents: [
      {
        document_id: "d1",
        candidate: {
          source: "manual",
          source_id: "m1",
          record_url: "https://example.org/book",
          manifest_url: "https://example.org/m",
          acquisition: "manual_url",
          verification_state: "candidate",
        },
        receipt: {
          requested_url: "https://example.org/m",
          final_url: "https://example.org/m",
          retrieved_at: "2026-10-05T00:00:00Z",
          sha256: "a".repeat(64),
          bytes: 200,
        },
        declared_id: "https://example.org/m",
        presentation_version: "3",
        label: [{ language: "ja", values: ["試料"] }],
        sequences: [{ sequence_id: "https://example.org/m", label: [] }],
        selected_sequence_id: "https://example.org/m",
        canvases: [
          {
            canvas_id: "https://example.org/c1",
            label: [{ language: null, values: ["1"] }],
            canvas_index_1based: 1,
            width: 1000,
            height: 2000,
            images: [
              {
                image_id: "https://example.org/full.jpg",
                width: 2000,
                height: 4000,
                target: "https://example.org/c1",
                service: {
                  service_id: "https://example.org/image",
                  version: "2",
                  profile: "http://iiif.io/api/image/2/level2.json",
                },
              },
            ],
            text_refs: [],
          },
        ],
        rights: [],
        diagnostics: [],
      },
    ],
    windows: [
      {
        window_id: "window1",
        document_id: "d1",
        canvas_id: "https://example.org/c1",
      },
    ],
    regions: [
      {
        selection: {
          region_id: "r1",
          window_id: "window1",
          canvas_id: "https://example.org/c1",
          xywh: [100, 200, 300, 400],
          coordinate_space: "canvas",
          rotation_degrees: 0,
        },
        mapping_state: "manifest_declared",
        tags: ["図版"],
        selection_reason: "比較",
        note: "",
        text_evidence_ids: [],
      },
    ],
    texts: [],
    viewer_state: {
      adapter_version: "mirador-4.2.6-v1",
      windows: [],
      native_state: null,
    },
  };
}
