import type { SearchItem } from "../../lib/types.js";
import type { SearchResult } from "../types.js";
import { mapNdlSearchSearchResponse } from "../ndlSearch/mapSearch.js";

function toNdlDigitalSearchItem(item: SearchItem): SearchItem {
  return {
    ...item,
    source: "ndl_digital",
    availability: {
      ...item.availability,
      digital_collection: true
    }
  };
}

export function mapNdlDigitalSearchResponse(payload: unknown): SearchResult {
  const base = mapNdlSearchSearchResponse(payload);
  const items = base.items
    .filter((item) => item.availability.digital_collection)
    .map((item) => toNdlDigitalSearchItem(item));

  return {
    total: items.length === base.items.length ? base.total : items.length,
    items
  };
}
