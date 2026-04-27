import { normalizeIssuedAt } from "../../lib/date.js";
import type { SearchItem } from "../../lib/types.js";
import type { SearchResult } from "../types.js";

const SUMMARY_MAX_LENGTH = 500;

interface KokkaiSpeechRecord {
  speechID: string;
  issueID: string;
  session: number;
  nameOfHouse: string;
  nameOfMeeting: string;
  issue: string;
  date: string;
  speechOrder: number;
  speaker: string;
  speakerYomi: string;
  speakerGroup: string;
  speakerPosition: string;
  speakerRole: string;
  speech: string;
  startPage: number;
  speechURL: string;
  meetingURL: string;
  pdfURL: string;
}

interface KokkaiResponse {
  numberOfRecords: number;
  numberOfReturn: number;
  startRecord: number;
  nextRecordPosition?: number;
  record: KokkaiSpeechRecord[];
}

function truncateSpeech(speech: string): string {
  if (speech.length <= SUMMARY_MAX_LENGTH) {
    return speech;
  }
  return speech.slice(0, SUMMARY_MAX_LENGTH) + "…";
}

function resolveRole(speakerRole: string, speakerPosition: string): string | null {
  if (speakerRole) return speakerRole;
  if (speakerPosition) return speakerPosition;
  return null;
}

function mapKokkaiRecord(
  source: "kokkai_minutes" | "teikoku_minutes",
  record: KokkaiSpeechRecord
): SearchItem {
  const issuedAt = normalizeIssuedAt(record.date);
  const role = resolveRole(record.speakerRole, record.speakerPosition);
  const subjects = record.speakerGroup ? [record.speakerGroup] : [];
  const summary = record.speech ? truncateSpeech(record.speech) : null;
  const subtitle = null;

  const title = `${record.speaker} — ${record.nameOfHouse}${record.nameOfMeeting} 第${record.session}回国会 ${record.issue}（${record.date}）`;

  const dateFields =
    issuedAt.issuedAtPrecision === "unknown"
      ? {
          issued_at: null,
          issued_at_label: issuedAt.issuedAtLabel,
          issued_at_precision: "unknown" as const
        }
      : {
          issued_at: issuedAt.issuedAt,
          issued_at_label: issuedAt.issuedAtLabel,
          issued_at_precision: issuedAt.issuedAtPrecision
        };

  return {
    source,
    source_id: record.speechID,
    title,
    subtitle,
    title_reading: record.speakerYomi || null,
    authors: [{ name: record.speaker, role }],
    publisher: "国立国会図書館",
    journal_title: `${record.nameOfHouse}${record.nameOfMeeting}`,
    ...dateFields,
    summary,
    url: record.speechURL || null,
    availability: { online: Boolean(record.speechURL), digital_collection: false },
    material_type: "parliamentary_record",
    subjects,
    duplicate_key: record.issueID,
    duplicate_count: 1,
    related_records: []
  };
}

export function mapKokkaiSearchResponse(
  source: "kokkai_minutes" | "teikoku_minutes",
  json: string
): SearchResult {
  const parsed: KokkaiResponse = JSON.parse(json);
  const records = Array.isArray(parsed.record) ? parsed.record : [];
  const items = records.map((record) => mapKokkaiRecord(source, record));
  const total = Number(parsed.numberOfRecords);

  return {
    total: Number.isFinite(total) ? total : items.length,
    items
  };
}
