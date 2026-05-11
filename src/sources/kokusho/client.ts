import { fetchJson } from "../../lib/http.js";
import type { KokushoAdapterOptions } from "../types.js";

const DEFAULT_BASE_URL = "https://kokusho.nijl.ac.jp";

function withBase(baseUrl: string, path: string) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relativePath = path.replace(/^\/+/, "");
  return new URL(relativePath, base).toString();
}

export interface KokushoClient {
  searchBiblios(query: string): Promise<unknown>;
  getBiblioDetail(bid: string): Promise<unknown>;
  searchFulltext(keyword: string): Promise<unknown>;
  searchImageTags(keyword: string, page: number): Promise<unknown>;
}

export function createKokushoClient(options: KokushoAdapterOptions = {}): KokushoClient {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  return {
    async searchBiblios(query) {
      const url = new URL(withBase(baseUrl, "/api/biblioSimpleSearch"));
      url.searchParams.set("searchkbn", "simple");
      url.searchParams.set("keyword", query);
      return fetchJson<unknown>(url.toString());
    },
    async getBiblioDetail(bid) {
      return fetchJson<unknown>(withBase(baseUrl, `/api/biblioDetail/${bid}`));
    },
    async searchFulltext(keyword) {
      const url = new URL(withBase(baseUrl, "/api/fulltextSearch"));
      url.searchParams.set("keyword", keyword);
      return fetchJson<unknown>(url.toString());
    },
    async searchImageTags(keyword, page) {
      const url = new URL(withBase(baseUrl, "/api/tagSearch"));
      url.searchParams.set("searchkbn", "simple");
      url.searchParams.set("keyword", keyword);
      url.searchParams.set("page", String(page));
      return fetchJson<unknown>(url.toString());
    }
  };
}
