import { normalizeIssuedAt } from "../../lib/date.js";
import type { RecordItem, SourceName } from "../../lib/types.js";

interface KokkaiSpeechEntry {
  speechID: string;
  speechOrder: number;
  speaker: string;
  speakerYomi?: string;
  speakerGroup?: string;
  speakerPosition?: string;
  speakerRole?: string;
  speech: string;
  startPage?: number;
  speechURL?: string;
}

interface KokkaiMeetingRecord {
  issueID: string;
  session: number;
  nameOfHouse: string;
  nameOfMeeting: string;
  issue: string;
  date: string;
  meetingURL: string;
  pdfURL?: string;
  speechRecord: KokkaiSpeechEntry[];
}

interface KokkaiMeetingResponse {
  numberOfRecords: number;
  numberOfReturn: number;
  startRecord: number;
  record?: KokkaiMeetingRecord[];
  meetingRecord?: KokkaiMeetingRecord[];
}

function mapSpeech(s: KokkaiSpeechEntry) {
  return {
    speech_id: s.speechID,
    speech_order: s.speechOrder,
    speaker: s.speaker,
    speaker_yomi: s.speakerYomi ?? null,
    speaker_group: s.speakerGroup || null,
    speaker_position: s.speakerPosition || null,
    speaker_role: s.speakerRole || null,
    speech: s.speech,
    start_page: s.startPage ?? null,
    speech_url: s.speechURL ?? null
  };
}

export function mapKokkaiMeetingResponse(
  source: "kokkai_minutes" | "teikoku_minutes",
  sourceId: string,
  json: string
): RecordItem | null {
  const parsed: KokkaiMeetingResponse = JSON.parse(json);
  const records = Array.isArray(parsed.record)
    ? parsed.record
    : Array.isArray(parsed.meetingRecord)
      ? parsed.meetingRecord
      : [];

  if (records.length === 0) {
    return null;
  }

  const meeting = records[0];
  const issuedAt = normalizeIssuedAt(meeting.date);
  const speeches = Array.isArray(meeting.speechRecord) ? meeting.speechRecord : [];

  const title = `${meeting.nameOfHouse}${meeting.nameOfMeeting} 第${meeting.session}回国会 ${meeting.issue}（${meeting.date}）`;
  const alternativeTitle = `第${meeting.session}回国会${meeting.nameOfHouse}${meeting.nameOfMeeting}${meeting.issue}`;

  const dateFields =
    issuedAt.issuedAtPrecision === "unknown"
      ? {
          issued_at: null as null,
          issued_at_label: issuedAt.issuedAtLabel,
          issued_at_precision: "unknown" as const
        }
      : {
          issued_at: issuedAt.issuedAt,
          issued_at_label: issuedAt.issuedAtLabel,
          issued_at_precision: issuedAt.issuedAtPrecision
        };

  const result: RecordItem = {
    source: source as SourceName,
    source_id: sourceId,
    title,
    subtitle: null,
    title_reading: null,
    authors: [],
    publisher: "国立国会図書館",
    journal_title: `${meeting.nameOfHouse}${meeting.nameOfMeeting}`,
    summary: null,
    url: meeting.meetingURL || null,
    availability: { online: Boolean(meeting.meetingURL), digital_collection: false },
    alternative_titles: [alternativeTitle],
    publication_place: "日本",
    language: "ja",
    material_type: "parliamentary_record",
    extent: null,
    subjects: [],
    identifiers: {
      issue_id: meeting.issueID,
      session: meeting.session
    },
    table_of_contents: [],
    content_access: {
      has_page_images: true,
      has_text_coordinates: false,
      viewer_url: meeting.meetingURL || null,
      access_note: null
    },
    source_metadata: {
      issue_id: meeting.issueID,
      session: meeting.session,
      name_of_house: meeting.nameOfHouse,
      name_of_meeting: meeting.nameOfMeeting,
      issue: meeting.issue,
      pdf_url: meeting.pdfURL ?? null,
      speech_count: speeches.length,
      speeches: speeches.map(mapSpeech)
    },
    raw: { meeting },
    ...dateFields
  };

  return result;
}
