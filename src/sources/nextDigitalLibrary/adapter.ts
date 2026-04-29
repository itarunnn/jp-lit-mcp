import {
  fetchJson,
  fetchWithTimeout,
  UnsupportedPayloadError,
  UpstreamHttpError
} from "../../lib/http.js";

const DEFAULT_BASE_URL = "https://lab.ndl.go.jp/dl/api";
const MAX_FULLTEXT_RESPONSE_CHARS = 5_000_000;

export type NextDigitalLibraryJson = Record<string, unknown>;

export interface NextDigitalLibraryBridgeInfo {
  pid: string;
  available: boolean;
  reason: string | null;
  book_api_url: string;
}

export interface NextDigitalLibraryAdapterOptions {
  baseUrl?: string;
}

export interface SearchPagesOptions {
  size?: number;
  from?: number;
}

export type SearchField = "contentonly" | "metaonly" | "all";

export interface SearchBooksOptions {
  searchfield?: SearchField;
  size?: number;
  from?: number;
  fNdc?: string;
  fcIsClassic?: boolean;
}

export interface SearchIllustrationsOptions {
  size?: number;
  from?: number;
}

export interface NextDigitalLibraryClient {
  /** 全 UpstreamHttpError を null として扱う（availability 判定用）。getPage / getFulltextJson / searchPages は 404 のみ null。 */
  getBook(pid: string): Promise<NextDigitalLibraryJson | null>;
  getPage(pid: string, page: number): Promise<NextDigitalLibraryJson | null>;
  getFulltextJson(pid: string): Promise<NextDigitalLibraryJson | null>;
  searchPages(pid: string, keyword: string, options?: SearchPagesOptions): Promise<NextDigitalLibraryJson | null>;
  searchBooks(keyword: string, options?: SearchBooksOptions): Promise<NextDigitalLibraryJson | null>;
  searchIllustrations(keyword: string, options?: SearchIllustrationsOptions): Promise<NextDigitalLibraryJson | null>;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

export function createNextDigitalLibraryClient(
  options: NextDigitalLibraryAdapterOptions = {}
): NextDigitalLibraryClient {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  return {
    async getBook(pid) {
      try {
        return await fetchJson<NextDigitalLibraryJson>(
          joinUrl(baseUrl, `/book/${encodeURIComponent(pid)}`)
        );
      } catch (error) {
        if (error instanceof UpstreamHttpError) {
          return null;
        }

        throw error;
      }
    },
    async getPage(pid, page) {
      try {
        return await fetchJson<NextDigitalLibraryJson>(
          joinUrl(baseUrl, `/page/${encodeURIComponent(pid)}_${page}`)
        );
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    },
    async getFulltextJson(pid) {
      try {
        const response = await fetchWithTimeout(
          joinUrl(baseUrl, `/book/fulltext-json/${encodeURIComponent(pid)}`)
        );
        if (!response.ok) {
          throw new UpstreamHttpError(response.status, response.statusText);
        }

        const text = await response.text();
        if (text.length > MAX_FULLTEXT_RESPONSE_CHARS) {
          throw new UnsupportedPayloadError(
            `Fulltext payload too large: ${text.length} characters`
          );
        }

        return JSON.parse(text) as NextDigitalLibraryJson;
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    },
    async searchPages(pid, keyword, options = {}) {
      try {
        const params = new URLSearchParams({ "f-book": pid, "q-contents": keyword });
        if (options.size !== undefined) params.set("size", String(options.size));
        if (options.from !== undefined) params.set("from", String(options.from));

        return await fetchJson<NextDigitalLibraryJson>(
          `${joinUrl(baseUrl, "/page/search")}?${params.toString()}`
        );
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    },
    async searchIllustrations(keyword, options = {}) {
      try {
        const params = new URLSearchParams({ keyword2vec: keyword });
        if (options.size !== undefined) params.set("size", String(options.size));
        if (options.from !== undefined) params.set("from", String(options.from));

        return await fetchJson<NextDigitalLibraryJson>(
          `${joinUrl(baseUrl, "/illustration/searchbytext")}?${params.toString()}`
        );
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    },
    async searchBooks(keyword, options = {}) {
      try {
        const params = new URLSearchParams({ keyword });
        if (options.searchfield) params.set("searchfield", options.searchfield);
        if (options.size !== undefined) params.set("size", String(options.size));
        if (options.from !== undefined) params.set("from", String(options.from));
        if (options.fNdc) params.set("f-ndc", options.fNdc);
        if (options.fcIsClassic !== undefined) params.set("fc-isClassic", String(options.fcIsClassic));

        return await fetchJson<NextDigitalLibraryJson>(
          `${joinUrl(baseUrl, "/book/search")}?${params.toString()}`
        );
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }

        throw error;
      }
    }
  };
}
