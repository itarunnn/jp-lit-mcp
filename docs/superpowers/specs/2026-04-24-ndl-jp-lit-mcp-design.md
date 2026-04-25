# NDL JP Literature MCP Design

## Overview

This project will provide an MCP server for Japanese literature and bibliography discovery.
The first release will support:

- NDL Search
- NDL Digital Collections

The server is intended to support conversational research workflows where the LLM searches, inspects records, and then writes summaries or synthesis outside the MCP layer.

The MCP server will not generate summaries itself. Its responsibility is retrieval, normalization, and source attribution.

## Goals

- Provide a single MCP interface for searching Japanese bibliography portals.
- Support both search and record-detail retrieval.
- Normalize core metadata into a shared schema.
- Preserve source-specific metadata for research use.
- Leave room to add CiNii Research and other sources later without changing the external tool model.

## Non-Goals For v1

- Automatic deduplication or record merging across NDL Search and NDL Digital Collections
- MCP-side summarization, interpretation, or prose generation
- Returning page image payloads from Digital Collections
- Returning text coordinate payloads from Next Digital Library
- Bulk crawling or large-scale harvesting workflows
- Advanced cross-source filtering abstraction
- User accounts, saved searches, or persistence

## External MCP Interface

The initial server will expose a small public surface:

### `jp_lit_search`

Search across supported sources or a specific source.

Arguments:

- `query`: string, required
- `source`: optional enum, initially `ndl_search` or `ndl_digital`
- `limit`: optional number
- `page`: optional number

### `jp_lit_get_record`

Fetch a normalized detailed record for a specific source and source identifier.

Arguments:

- `source`: enum, required
- `source_id`: string, required

Future extensions may add tools such as:

- `jp_lit_list_sources`
- `jp_lit_get_page_images`
- `jp_lit_get_text_coordinates`

These are intentionally out of scope for v1.

## Architecture

The system will use a modular adapter design.

### Layers

1. MCP server layer
   - Tool definitions
   - Argument validation
   - Response serialization
2. Service layer
   - Dispatch by `source`
   - Shared normalization logic
   - Shared response shaping
3. Source adapter layer
   - `ndl_search`
   - `ndl_digital`
   - future `cinii_research`

The external MCP contract stays stable while new source adapters are added internally.

## Source Strategy

The initial product will present a unified tool interface, but source adapters remain independent internally.

Important constraint:

- v1 must not aggressively merge records across NDL Search and NDL Digital Collections.

Reason:

- identifiers differ
- metadata completeness differs
- naive merging risks incorrect scholarly attribution

If the same work appears in both systems, they should initially be returned as separate source records unless a later, explicit reconciliation design is added.

## Search Response Schema

`jp_lit_search` returns enough data to choose the next record for inspection.

```json
{
  "query": "夏目漱石",
  "source": "ndl_search",
  "page": 1,
  "limit": 10,
  "total": 1234,
  "items": [
    {
      "source": "ndl_search",
      "source_id": "12345678",
      "title": "吾輩は猫である",
      "subtitle": null,
      "authors": [
        {
          "name": "夏目 漱石",
          "role": "author"
        }
      ],
      "publisher": "春陽堂",
      "issued_at": "1905",
      "issued_at_label": "1905",
      "issued_at_precision": "year",
      "summary": null,
      "url": "https://example.invalid",
      "availability": {
        "online": false,
        "digital_collection": true
      }
    }
  ]
}
```

### Search Schema Rules

- `source` and `source_id` are always required in each item.
- `authors` is an array of structured name-role objects, not plain strings.
- `issued_at` is normalized when possible.
- `issued_at_label` preserves the source-facing expression.
- `issued_at_precision` is one of `day`, `month`, `year`, or `unknown`.
- `summary` is only returned when the source provides one.

## Record Response Schema

`jp_lit_get_record` returns a fuller normalized record for synthesis and citation-aware use.

```json
{
  "source": "ndl_digital",
  "source_id": "987654321",
  "title": "吾輩は猫である",
  "subtitle": null,
  "alternative_titles": [],
  "authors": [
    {
      "name": "夏目 漱石",
      "role": "author"
    }
  ],
  "publisher": "春陽堂",
  "issued_at": "1905",
  "issued_at_label": "明治38年",
  "issued_at_precision": "year",
  "publication_place": "東京",
  "language": "jpn",
  "material_type": "book",
  "extent": "1冊",
  "subjects": [
    "日本小説"
  ],
  "identifiers": {
    "isbn": [],
    "issn": [],
    "ndl_bib_id": "12345678",
    "other": {}
  },
  "summary": null,
  "table_of_contents": [],
  "url": "https://example.invalid",
  "availability": {
    "online": true,
    "digital_collection": true,
    "access_note": "NDL access conditions may apply"
  },
  "content_access": {
    "has_page_images": true,
    "has_text_coordinates": false,
    "viewer_url": "https://example.invalid/viewer",
    "access_note": "Availability depends on source-side conditions"
  },
  "source_metadata": {
    "provider": "National Diet Library",
    "raw_url": "https://example.invalid/api"
  },
  "raw": {}
}
```

### Record Schema Rules

- `table_of_contents` is a normalized ordered array when present.
- `table_of_contents` belongs in record detail, not in search results.
- `content_access` exposes the availability of page images and text coordinates, but does not inline those heavy payloads.
- `raw` is preserved for source-specific detail and debugging.
- `source_metadata` stores lightweight provider context and fetch provenance.

## Date Handling

Date normalization is a known risk area and must be specified early.

### Shared fields

- `issued_at`: normalized value when derivable
- `issued_at_label`: original source label
- `issued_at_precision`: `day`, `month`, `year`, or `unknown`

### Rules

- If exact day is known, use `YYYY-MM-DD`.
- If only month is known, use `YYYY-MM`.
- If only year is known, use `YYYY`.
- If normalization is not reliable, set `issued_at` to `null`, preserve the original in `issued_at_label`, and set `issued_at_precision` to `unknown`.

This preserves both machine-usable dates and historically meaningful source expressions.

## Missing Data Semantics

The system should distinguish between:

- value not present in the source
- value not retrieved by the current adapter
- value structurally unavailable for this source

Practical v1 rule:

- use `null` for unknown scalar values
- use `[]` for list fields with no available entries
- use capability flags and notes for heavy content access fields

If later needed, explicit retrieval-status fields can be added without changing the top-level tool model.

## Heavy Content Strategy

Digital Collections page images and Next Digital Library text coordinates are valuable, but they should not be embedded in `jp_lit_get_record`.

Reason:

- payload size is large
- ordinary bibliography exploration does not always need them
- these capabilities vary strongly by source

For v1, record detail should expose only:

- `has_page_images`
- `has_text_coordinates`
- `viewer_url`
- `access_note`

Dedicated retrieval tools can be added later.

## Error Handling

The server should return clear failures for:

- unsupported source values
- missing required identifiers
- upstream API failures
- parse or normalization failures

Errors should preserve enough source context to help the LLM recover, but should not fabricate missing records.

## Testing Strategy

v1 should include:

- adapter unit tests for source response normalization
- schema-level tests for MCP tool output
- date normalization tests
- fixture-based tests for representative NDL Search and NDL Digital records

At least one fixture should cover:

- record with exact publication date
- record with year-only date
- record with table of contents
- record with digital access indicators

## Open Risks

- API usage conditions for Digital Collections images and related access paths must be reviewed before implementing image or coordinate retrieval tools.
- NDL Search and NDL Digital may expose overlapping records with different metadata quality.
- Historical Japanese dates and ambiguous publication labels may resist strict normalization.

## Recommendation

Build v1 as a metadata-first MCP server with a stable unified interface and internal source adapters.

This gives the LLM strong retrieval tools for conversational bibliography work while keeping room for future expansion into:

- CiNii Research
- page image retrieval
- text coordinate retrieval
- richer cross-source discovery
