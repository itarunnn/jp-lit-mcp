import {
  listSessionsInputSchema,
  listSessionsOutputSchema,
  sourceSchema
} from "../lib/schemas.js";
import type { ListSessionsOutput } from "../lib/schemas.js";
import type { SessionDocument } from "../lib/persistence/types.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";

type Source = ReturnType<typeof sourceSchema.parse>;

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

function countSelectedItems(session: SessionDocument) {
  return session.entries.reduce(
    (count, entry) => count + entry.selected_items.length,
    0
  );
}

function collectSources(session: SessionDocument) {
  const sources = new Set<Source>();
  const addSource = (value: unknown) => {
    const parsed = sourceSchema.safeParse(value);
    if (parsed.success) {
      sources.add(parsed.data);
    }
  };

  for (const entry of session.entries) {
    addSource(entry.input.source);
    for (const item of entry.selected_items) {
      addSource(item.source);
    }
  }

  for (const plan of session.trace?.source_plans ?? []) {
    addSource(plan.source);
  }
  for (const action of session.trace?.next_actions ?? []) {
    addSource(action.source);
  }

  return Array.from(sources).sort();
}

function pickQueryPreview(session: SessionDocument) {
  for (const entry of session.entries) {
    const query = entry.input.query;
    if (typeof query === "string") {
      return createPreview(query);
    }
  }

  return null;
}

function pickSelectedTitlePreview(session: SessionDocument) {
  for (const entry of session.entries) {
    const title = entry.selected_items[0]?.title;
    if (title) {
      return createPreview(title);
    }
  }

  return null;
}

function getTraceCounts(session: SessionDocument) {
  return {
    source_plan_count: session.trace?.source_plans.length ?? 0,
    open_question_count: session.trace?.open_questions.length ?? 0,
    next_action_count: session.trace?.next_actions.length ?? 0,
    decision_count: session.entries.reduce(
      (count, entry) => count + (entry.trace?.decisions.length ?? 0),
      0
    ),
    evidence_scope_count: session.entries.reduce(
      (count, entry) => count + (entry.trace?.evidence_scope.length ?? 0),
      0
    )
  };
}

function hasTrace(session: SessionDocument) {
  const counts = getTraceCounts(session);
  return Boolean(
    session.trace?.research_goal ||
      session.trace?.scope_note ||
      counts.source_plan_count > 0 ||
      counts.open_question_count > 0 ||
      counts.next_action_count > 0 ||
      counts.decision_count > 0 ||
      counts.evidence_scope_count > 0 ||
      session.entries.some((entry) => entry.trace?.intent || entry.trace?.search_attempt)
  );
}

function isAfterOrEqual(value: string, lowerBound?: string) {
  return lowerBound === undefined || value >= lowerBound;
}

function isBeforeOrEqual(value: string, upperBound?: string) {
  return upperBound === undefined || value <= upperBound;
}

export function createJpLitListSessionsTool(sessionStore: SessionStore) {
  return async (input: unknown) => {
    const parsed = listSessionsInputSchema.parse(input);
    const sessions = await sessionStore.listAll();

    const items = sessions
      .map((session) => {
        const sources = collectSources(session);
        const selectedCount = countSelectedItems(session);
        const traceCounts = getTraceCounts(session);
        const sessionHasTrace = hasTrace(session);
        const sessionHasSelected = selectedCount > 0;

        return {
          session_id: session.session_id,
          created_at: session.created_at,
          updated_at: session.updated_at,
          research_goal: session.trace?.research_goal ?? null,
          scope_note: session.trace?.scope_note ?? null,
          entry_count: session.entries.length,
          selected_count: selectedCount,
          source_count: sources.length,
          sources,
          query_preview: pickQueryPreview(session),
          selected_title_preview: pickSelectedTitlePreview(session),
          has_trace: sessionHasTrace,
          has_selected: sessionHasSelected,
          trace_counts: traceCounts
        };
      })
      .filter((item) =>
        isAfterOrEqual(item.updated_at, parsed.updated_from) &&
        isBeforeOrEqual(item.updated_at, parsed.updated_to) &&
        isAfterOrEqual(item.created_at, parsed.created_from) &&
        isBeforeOrEqual(item.created_at, parsed.created_to) &&
        (parsed.has_trace === undefined || item.has_trace === parsed.has_trace) &&
        (parsed.has_selected === undefined || item.has_selected === parsed.has_selected) &&
        (parsed.source === undefined || item.sources.includes(parsed.source))
      )
      .sort((left, right) => {
        const comparison = left[parsed.sort_by].localeCompare(right[parsed.sort_by]);
        return parsed.sort_order === "asc" ? comparison : -comparison;
      });

    const structuredContent: ListSessionsOutput = listSessionsOutputSchema.parse({
      limit: parsed.limit,
      total: items.length,
      sort_by: parsed.sort_by,
      sort_order: parsed.sort_order,
      filters: {
        updated_from: parsed.updated_from ?? null,
        updated_to: parsed.updated_to ?? null,
        created_from: parsed.created_from ?? null,
        created_to: parsed.created_to ?? null,
        has_trace: parsed.has_trace ?? null,
        has_selected: parsed.has_selected ?? null,
        source: parsed.source ?? null
      },
      items: items.slice(0, parsed.limit)
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
