import { fetchText, UpstreamHttpError } from "../../lib/http.js";
import type { SourceAdapter } from "../types.js";
import { mapKokkaiMeetingResponse } from "./mapRecord.js";
import { mapKokkaiSearchResponse } from "./mapSearch.js";

const KOKKAI_SPEECH_BASE_URL = "https://kokkai.ndl.go.jp/api/speech";
const KOKKAI_MEETING_BASE_URL = "https://kokkai.ndl.go.jp/api/meeting";
const TEIKOKU_SPEECH_BASE_URL = "https://teikokugikai-i.ndl.go.jp/api/emp/speech";
const TEIKOKU_MEETING_BASE_URL = "https://teikokugikai-i.ndl.go.jp/api/emp/meeting";

interface KokkaiAdapterOptions {
  speechBaseUrl?: string;
  meetingBaseUrl?: string;
}

function normalizeDateBound(value: string, isStart: boolean): string {
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) {
    return isStart ? `${trimmed}-01-01` : `${trimmed}-12-31`;
  }
  return trimmed;
}

function createAdapter(
  source: "kokkai_minutes" | "teikoku_minutes",
  defaultSpeechBaseUrl: string,
  defaultMeetingBaseUrl: string,
  options: KokkaiAdapterOptions = {}
): SourceAdapter {
  const speechBaseUrl = options.speechBaseUrl ?? defaultSpeechBaseUrl;
  const meetingBaseUrl = options.meetingBaseUrl ?? defaultMeetingBaseUrl;

  return {
    source,
    async search({ query, limit, page, issued_from, issued_to }) {
      const url = new URL(speechBaseUrl);
      const startRecord = (page - 1) * limit + 1;

      url.searchParams.set("any", query);
      url.searchParams.set("maximumRecords", String(limit));
      url.searchParams.set("startRecord", String(startRecord));
      url.searchParams.set("recordPacking", "json");
      if (issued_from) {
        url.searchParams.set("from", normalizeDateBound(issued_from, true));
      }
      if (issued_to) {
        url.searchParams.set("until", normalizeDateBound(issued_to, false));
      }

      const payload = await fetchText(url.toString());
      return mapKokkaiSearchResponse(source, payload.text);
    },
    async getRecord(sourceId) {
      const issueID = sourceId.split("_").slice(0, -1).join("_");

      const url = new URL(meetingBaseUrl);
      url.searchParams.set("issueID", issueID);
      url.searchParams.set("recordPacking", "json");

      try {
        const payload = await fetchText(url.toString());
        return mapKokkaiMeetingResponse(source, sourceId, payload.text);
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.status === 404) {
          return null;
        }
        throw error;
      }
    }
  };
}

export function createKokkaiAdapter(options: KokkaiAdapterOptions = {}): SourceAdapter {
  return createAdapter("kokkai_minutes", KOKKAI_SPEECH_BASE_URL, KOKKAI_MEETING_BASE_URL, options);
}

export function createTeikokuAdapter(options: KokkaiAdapterOptions = {}): SourceAdapter {
  return createAdapter("teikoku_minutes", TEIKOKU_SPEECH_BASE_URL, TEIKOKU_MEETING_BASE_URL, options);
}
