import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";

import { getLegacySessionsRoot, getSessionsRoot } from "./paths.js";
import { replaceFileAtomically } from "./atomicFile.js";
import type {
  SessionAnnotationInput,
  SessionDocument,
  SessionEntry,
  SessionEntryTrace,
  SessionTrace,
  SessionTraceUpdateInput,
  StartSessionInput
} from "./types.js";

export interface SessionStore {
  startSession(input: StartSessionInput): Promise<SessionDocument>;
  appendEntry(entry: SessionEntry, sessionId?: string): Promise<SessionDocument>;
  annotateEntry(
    input: SessionAnnotationInput,
    sessionId?: string
  ): Promise<SessionDocument>;
  updateTrace(
    input: SessionTraceUpdateInput,
    sessionId?: string
  ): Promise<SessionDocument>;
  listAll(): Promise<SessionDocument[]>;
  readById(sessionId: string): Promise<SessionDocument>;
  readCurrent(): Promise<SessionDocument>;
}

const SESSION_ID_PATTERN =
  /^\d{4}-\d{2}-\d{2}-\d{6}(?:-[0-9a-f]{8})?$/;

function nowIso() {
  return new Date().toISOString();
}

function createSessionId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now
    .toISOString()
    .slice(11, 19)
    .replace(/:/g, "");

  return `${date}-${time}-${randomBytes(4).toString("hex")}`;
}

function createEmptySession(input: StartSessionInput = {}): SessionDocument {
  const timestamp = nowIso();
  const trace = normalizeSessionTrace({
    ...(input.research_goal ? { research_goal: input.research_goal } : {}),
    ...(input.scope_note ? { scope_note: input.scope_note } : {}),
    source_plans: [],
    open_questions: [],
    next_actions: []
  });

  return {
    session_id: createSessionId(),
    created_at: timestamp,
    updated_at: timestamp,
    entries: [],
    ...(hasSessionTraceContent(trace) ? { trace } : {})
  };
}

function normalizeSessionTrace(trace: SessionDocument["trace"]): SessionTrace {
  return {
    ...(trace?.research_goal ? { research_goal: trace.research_goal } : {}),
    ...(trace?.scope_note ? { scope_note: trace.scope_note } : {}),
    source_plans: trace?.source_plans ?? [],
    open_questions: trace?.open_questions ?? [],
    next_actions: trace?.next_actions ?? []
  };
}

function normalizeEntryTrace(trace: SessionEntry["trace"]): SessionEntryTrace {
  return {
    ...(trace?.agent_label ? { agent_label: trace.agent_label } : {}),
    ...(trace?.task_scope ? { task_scope: trace.task_scope } : {}),
    ...(trace?.intent ? { intent: trace.intent } : {}),
    ...(trace?.search_attempt ? { search_attempt: trace.search_attempt } : {}),
    decisions: trace?.decisions ?? [],
    evidence_scope: trace?.evidence_scope ?? []
  };
}

function hasSessionTraceContent(trace: SessionTrace) {
  return Boolean(
    trace.research_goal ||
      trace.scope_note ||
      trace.source_plans.length > 0 ||
      trace.open_questions.length > 0 ||
      trace.next_actions.length > 0
  );
}

function hasEntryTraceContent(trace: SessionEntryTrace) {
  return Boolean(
    trace.agent_label ||
      trace.task_scope ||
      trace.intent ||
      trace.search_attempt ||
      trace.decisions.length > 0 ||
      trace.evidence_scope.length > 0
  );
}

function currentSessionPath(baseDir: string) {
  return path.join(getSessionsRoot(baseDir), "current.json");
}

function legacyCurrentSessionPath(baseDir: string) {
  return path.join(getLegacySessionsRoot(baseDir), "current.json");
}

function archiveSessionPath(baseDir: string, sessionId: string) {
  return path.join(getSessionsRoot(baseDir), `${sessionId}.json`);
}

function legacyArchiveSessionPath(baseDir: string, sessionId: string) {
  return path.join(getLegacySessionsRoot(baseDir), `${sessionId}.json`);
}

function assertValidSessionId(sessionId: string) {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error(`Invalid session id: ${sessionId}`);
  }
}

async function writeSessionFile(target: string, value: SessionDocument) {
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await writeFile(temp, JSON.stringify(value, null, 2), "utf8");
    await replaceFileAtomically(temp, target);
  } finally {
    try {
      await rm(temp, { force: true });
    } catch {
      // ignore cleanup failure when temp is already gone or never created
    }
  }
}

async function readSessionFile(target: string) {
  const text = await readFile(target, "utf8");
  return JSON.parse(text) as SessionDocument;
}

async function readSessionFileWithFallback(primary: string, legacy: string) {
  try {
    return await readSessionFile(primary);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    return readSessionFile(legacy);
  }
}

export function createSessionStore(baseDir = process.cwd()): SessionStore {
  let mutation: Promise<void> = Promise.resolve();

  function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutation.then(operation, operation);
    mutation = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  async function ensureDirectory() {
    await mkdir(getSessionsRoot(baseDir), { recursive: true });
  }

  async function persist(session: SessionDocument, mirrorCurrent = true) {
    await ensureDirectory();
    await writeSessionFile(archiveSessionPath(baseDir, session.session_id), session);
    if (mirrorCurrent) {
      await writeSessionFile(currentSessionPath(baseDir), session);
    }
  }

  async function readCurrentUnlocked() {
    await ensureDirectory();

    try {
      return await readSessionFile(currentSessionPath(baseDir));
    } catch (error) {
      const currentPath = currentSessionPath(baseDir);
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        try {
          const legacySession = await readSessionFile(legacyCurrentSessionPath(baseDir));
          await persist(legacySession);
          return legacySession;
        } catch (legacyError) {
          if ((legacyError as NodeJS.ErrnoException).code !== "ENOENT") {
            throw legacyError;
          }
        }

        const session = createEmptySession();
        await persist(session);
        return session;
      }

      if (error instanceof SyntaxError) {
        try {
          const brokenPath = `${currentPath}.invalid`;
          await rename(currentPath, brokenPath);
        } catch {
          // ignore follow-up failure
        }

        const session = createEmptySession();
        await persist(session);
        return session;
      }

      throw error;
    }
  }

  async function readCurrentForStartUnlocked() {
    await ensureDirectory();
    const currentPath = currentSessionPath(baseDir);

    try {
      return await readSessionFile(currentPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        try {
          return await readSessionFile(legacyCurrentSessionPath(baseDir));
        } catch (legacyError) {
          if ((legacyError as NodeJS.ErrnoException).code === "ENOENT") {
            return null;
          }
          throw legacyError;
        }
      }

      if (error instanceof SyntaxError) {
        try {
          await rename(currentPath, `${currentPath}.invalid`);
        } catch {
          // ignore follow-up failure; the new session write still reports its own result
        }
        return null;
      }

      throw error;
    }
  }

  async function readById(sessionId: string) {
    await ensureDirectory();
    assertValidSessionId(sessionId);
    return readSessionFileWithFallback(
      archiveSessionPath(baseDir, sessionId),
      legacyArchiveSessionPath(baseDir, sessionId)
    );
  }

  async function loadMutationTarget(sessionId?: string) {
    if (!sessionId) {
      return {
        session: await readCurrentUnlocked(),
        mirrorCurrent: true
      };
    }

    const session = await readById(sessionId);
    const current = await readCurrentForStartUnlocked();
    return {
      session,
      mirrorCurrent: current?.session_id === session.session_id
    };
  }

  async function listAll() {
    await ensureDirectory();
    const roots = [getSessionsRoot(baseDir), getLegacySessionsRoot(baseDir)];
    const sessionMap = new Map<string, SessionDocument>();

    for (const root of roots) {
      let filenames: string[];
      try {
        filenames = await readdir(root);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }
        throw error;
      }

      const sessions = await Promise.all(
        filenames
          .filter((filename) => filename.endsWith(".json") && filename !== "current.json")
          .map(async (filename) => {
            try {
              return await readSessionFile(path.join(root, filename));
            } catch {
              return null;
            }
          })
      );

      for (const session of sessions) {
        if (session && !sessionMap.has(session.session_id)) {
          sessionMap.set(session.session_id, session);
        }
      }
    }

    return Array.from(sessionMap.values()).sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at)
    );
  }

  return {
    readCurrent() {
      return serializeMutation(readCurrentUnlocked);
    },

    readById,

    listAll,

    startSession(input) {
      return serializeMutation(async () => {
        const previous = await readCurrentForStartUnlocked();
        if (previous) {
          await writeSessionFile(
            archiveSessionPath(baseDir, previous.session_id),
            previous
          );
        }
        const session = createEmptySession(input);
        await persist(session);
        return session;
      });
    },

    appendEntry(entry, sessionId) {
      return serializeMutation(async () => {
        const { session, mirrorCurrent } = await loadMutationTarget(sessionId);
        const existingIndex = entry.tool === "jp_lit_record_ndl_browser_search"
          ? -1
          : session.entries.findIndex(
              (candidate) =>
                candidate.tool === entry.tool &&
                candidate.cache_key === entry.cache_key
            );
        const entries =
          existingIndex === -1
            ? [...session.entries, entry]
            : session.entries.map((candidate, index) =>
                index === existingIndex
                  ? {
                      ...candidate,
                      ...entry,
                      selected_items: candidate.selected_items,
                      notes: candidate.notes,
                      ...(candidate.trace
                        ? { trace: candidate.trace }
                        : entry.trace
                          ? { trace: entry.trace }
                          : {})
                    }
                  : candidate
              );
        const next: SessionDocument = {
          ...session,
          updated_at: nowIso(),
          entries
        };

        await persist(next, mirrorCurrent);
        return next;
      });
    },

    updateTrace(input, sessionId) {
      return serializeMutation(async () => {
        const { session, mirrorCurrent } = await loadMutationTarget(sessionId);
        const timestamp = nowIso();
        const currentTrace = normalizeSessionTrace(session.trace);
        const nextTrace: SessionTrace = {
          ...currentTrace,
          ...(input.research_goal !== undefined
            ? { research_goal: input.research_goal }
            : {}),
          ...(input.scope_note !== undefined
            ? { scope_note: input.scope_note }
            : {}),
          source_plans: [
            ...currentTrace.source_plans,
            ...(input.source_plans ?? []).map((entry) => ({
              ...entry,
              created_at: timestamp
            }))
          ],
          open_questions: [
            ...currentTrace.open_questions,
            ...(input.open_questions ?? []).map((entry) => ({
              ...entry,
              created_at: timestamp
            }))
          ],
          next_actions: [
            ...currentTrace.next_actions,
            ...(input.next_actions ?? []).map((entry) => ({
              ...entry,
              created_at: timestamp
            }))
          ]
        };

        const next: SessionDocument = {
          ...session,
          updated_at: timestamp,
          ...(hasSessionTraceContent(nextTrace) ? { trace: nextTrace } : {})
        };

        await persist(next, mirrorCurrent);
        return next;
      });
    },

    annotateEntry(input, sessionId) {
      return serializeMutation(async () => {
        const { session, mirrorCurrent } = await loadMutationTarget(sessionId);
        const timestamp = nowIso();
        let matched = false;
        const nextEntries = session.entries.map((entry) => {
          if (entry.tool !== input.tool || entry.cache_key !== input.cache_key) {
            return entry;
          }

          matched = true;
          const currentTrace = normalizeEntryTrace(entry.trace);
          const inputTrace = input.trace;
          const nextTrace: SessionEntryTrace = {
            ...currentTrace,
            ...(inputTrace?.agent_label !== undefined
              ? { agent_label: inputTrace.agent_label }
              : {}),
            ...(inputTrace?.task_scope !== undefined
              ? { task_scope: inputTrace.task_scope }
              : {}),
            ...(inputTrace?.intent !== undefined
              ? { intent: inputTrace.intent }
              : {}),
            ...(inputTrace?.search_attempt !== undefined
              ? { search_attempt: inputTrace.search_attempt }
              : {}),
            decisions: [
              ...currentTrace.decisions,
              ...(inputTrace?.decisions ?? []).map((decision) => ({
                ...decision,
                created_at: timestamp
              }))
            ],
            evidence_scope: [
              ...currentTrace.evidence_scope,
              ...(inputTrace?.evidence_scope ?? [])
            ]
          };

          return {
            ...entry,
            selected_items: input.selected_items,
            notes: input.notes ?? entry.notes,
            ...(hasEntryTraceContent(nextTrace) ? { trace: nextTrace } : {})
          };
        });

        if (!matched) {
          throw new Error(
            `Session entry not found for annotation: ${input.tool}/${input.cache_key}`
          );
        }

        const next: SessionDocument = {
          ...session,
          updated_at: timestamp,
          entries: nextEntries
        };

        await persist(next, mirrorCurrent);
        return next;
      });
    }
  };
}
