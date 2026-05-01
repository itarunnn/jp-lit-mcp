import {
  findSessionsInputSchema,
  findSessionsOutputSchema
} from "../lib/schemas.js";
import type {
  FindSessionsOutput
} from "../lib/schemas.js";
import type { SessionDocument, SessionEntry } from "../lib/persistence/types.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";

type MatchedField = "query" | "selected_title" | "notes";

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/\s+/g, " ")
    .trim();
}

function createPreview(value: string | null | undefined, maxLength = 120) {
  if (!value) {
    return null;
  }

  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1)}…`;
}

function entryMatchesQuery(entry: SessionEntry, normalizedQuery: string): boolean {
  const query = entry.input.query;
  return typeof query === "string" && normalizeText(query).includes(normalizedQuery);
}

function entryMatchesSelectedTitle(entry: SessionEntry, normalizedQuery: string): boolean {
  return entry.selected_items.some((item) =>
    normalizeText(item.title).includes(normalizedQuery)
  );
}

function entryMatchesNotes(entry: SessionEntry, normalizedQuery: string): boolean {
  return entry.notes.some((note) => normalizeText(note).includes(normalizedQuery));
}

function collectMatchedFields(
  session: SessionDocument,
  normalizedQuery: string
): MatchedField[] {
  const matchedFields: MatchedField[] = [];

  if (session.entries.some((entry) => entryMatchesQuery(entry, normalizedQuery))) {
    matchedFields.push("query");
  }
  if (session.entries.some((entry) => entryMatchesSelectedTitle(entry, normalizedQuery))) {
    matchedFields.push("selected_title");
  }
  if (session.entries.some((entry) => entryMatchesNotes(entry, normalizedQuery))) {
    matchedFields.push("notes");
  }

  return matchedFields;
}

function pickQueryPreview(session: SessionDocument, normalizedQuery: string) {
  const matchedEntry =
    session.entries.find((entry) => entryMatchesQuery(entry, normalizedQuery)) ??
    session.entries.find((entry) => typeof entry.input.query === "string");

  const query = matchedEntry?.input.query;
  return typeof query === "string" ? createPreview(query) : null;
}

function pickNotePreview(session: SessionDocument, normalizedQuery: string) {
  for (const entry of session.entries) {
    const matchedNote = entry.notes.find((note) =>
      normalizeText(note).includes(normalizedQuery)
    );
    if (matchedNote) {
      return createPreview(matchedNote);
    }
  }

  for (const entry of session.entries) {
    if (entry.notes.length > 0) {
      return createPreview(entry.notes[0]);
    }
  }

  return null;
}

function countSelectedItems(session: SessionDocument) {
  return session.entries.reduce(
    (count, entry) => count + entry.selected_items.length,
    0
  );
}

export function createJpLitFindSessionsTool(sessionStore: SessionStore) {
  return async (input: unknown) => {
    const parsed = findSessionsInputSchema.parse(input);
    const normalizedQuery = normalizeText(parsed.query);
    const sessions = await sessionStore.listAll();

    const matchedItems = sessions
      .map((session) => {
        const matchedFields = collectMatchedFields(session, normalizedQuery);
        if (matchedFields.length === 0) {
          return null;
        }

        return {
          session_id: session.session_id,
          created_at: session.created_at,
          updated_at: session.updated_at,
          matched_fields: matchedFields,
          query_preview: pickQueryPreview(session, normalizedQuery),
          selected_count: countSelectedItems(session),
          note_preview: pickNotePreview(session, normalizedQuery)
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

    const structuredContent: FindSessionsOutput = findSessionsOutputSchema.parse({
      query: parsed.query,
      limit: parsed.limit,
      total: matchedItems.length,
      items: matchedItems.slice(0, parsed.limit)
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(structuredContent, null, 2)
        }
      ],
      structuredContent
    };
  };
}
