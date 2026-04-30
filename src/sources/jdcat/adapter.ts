import { fetchJson, UpstreamHttpError } from "../../lib/http.js";
import type { SourceAdapter } from "../types.js";
import { mapJdcatRecordResponse } from "./mapRecord.js";
import { mapJdcatSearchResponse } from "./mapSearch.js";

const DEFAULT_BASE_URL = "https://jdcat.jsps.go.jp";

interface JdcatAdapterOptions {
  baseUrl?: string;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export function createJdcatAdapter(
  options: JdcatAdapterOptions = {}
): SourceAdapter {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);

  return {
    source: "jdcat",
    async search({ query, limit, page, filters }) {
      const url = new URL(`${baseUrl}/api/records/`);
      const jdcat = filters?.jdcat;

      let q = query;
      if (jdcat?.subject) q += ` AND subject:${jdcat.subject}`;
      if (jdcat?.geographic) q += ` AND geographic:${jdcat.geographic}`;
      if (jdcat?.contributor) q += ` AND contributor:${jdcat.contributor}`;
      if (jdcat?.title) q += ` AND title:${jdcat.title}`;

      url.searchParams.set("q", q);
      url.searchParams.set("size", String(limit));
      url.searchParams.set("page", String(page));

      if (jdcat?.temporal) url.searchParams.set("temporal", jdcat.temporal);
      if (jdcat?.creator) url.searchParams.set("creator", jdcat.creator);

      return mapJdcatSearchResponse(await fetchJson(url.toString()));
    },
    async getRecord(sourceId) {
      const url = new URL(`${baseUrl}/api/records/${encodeURIComponent(sourceId)}`);

      try {
        return mapJdcatRecordResponse(await fetchJson(url.toString()));
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    }
  };
}
