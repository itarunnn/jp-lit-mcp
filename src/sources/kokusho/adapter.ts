import { UpstreamHttpError } from "../../lib/http.js";
import { networkRestrictionError } from "../archiveShared.js";
import type { KokushoAdapterOptions, SourceAdapter } from "../types.js";
import { createKokushoClient } from "./client.js";
import { mapKokushoRecordResponse } from "./mapRecord.js";
import { mapKokushoSearchResponse } from "./mapSearch.js";

export function createKokushoAdapter(options: KokushoAdapterOptions = {}): SourceAdapter {
  const client = createKokushoClient(options);

  return {
    source: "kokusho",
    async search({ query, limit }) {
      try {
        const payload = await client.searchBiblios(query);
        const result = mapKokushoSearchResponse(payload);
        return {
          total: result.total,
          items: result.items.slice(0, limit),
          facets: result.facets
        };
      } catch (error) {
        throw networkRestrictionError(error);
      }
    },
    async getRecord(sourceId) {
      try {
        const payload = await client.getBiblioDetail(sourceId);
        return mapKokushoRecordResponse(payload);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }
        throw networkRestrictionError(error);
      }
    }
  };
}
