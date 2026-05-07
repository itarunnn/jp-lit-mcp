import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { getLegacySessionsRoot, getSessionsRoot } from "./paths.js";
import type {
  SessionAnnotationInput,
  SessionDocument,
  SessionEntry,
  SessionEntryTrace,
  SessionTrace,
  SessionTraceUpdateInput
} from "./types.js";

export interface SessionStore {
  appendEntry(entry: SessionEntry): Promise<SessionDocument>;
  annotateEntry(input: SessionAnnotationInput): Promise<SessionDocument>;
  updateTrace(input: SessionTraceUpdateInput): Promise<SessionDocument>;
  listAll(): Promise<SessionDocument[]>;
  readById(sessionId: string): Promise<SessionDocument>;
  readCurrent(): Promise<SessionDocument>;
}

const SESSION_ID_PATTERN = /^\d{4}-\d{2}-\d{2}-\d{6}$/;

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

  return `${date}-${time}`;
}

function createEmptySession(): SessionDocument {
  const timestamp = nowIso();

  return {
    session_id: createSessionId(),
    created_at: timestamp,
    updated_at: timestamp,
    entries: []
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
  const temp = `${target}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  const backup = `${target}.${process.pid}.${Date.now()}.bak`;

  try {
    await writeFile(temp, JSON.stringify(value, null, 2), "utf8");

    try {
      await rename(temp, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST" && code !== "EPERM") {
        throw error;
      }
    }

    await rename(target, backup);

    try {
      await rename(temp, target);
    } catch (error) {
      try {
        await rename(backup, target);
      } catch {
        // ignore restore failure and rethrow original write failure
      }

      throw error;
    }
  } finally {
    try {
      await rm(backup, { force: true, recursive: true });
    } catch {
      // ignore cleanup failure when backup is already gone or never created
    }
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
  async function ensureDirectory() {
    await mkdir(getSessionsRoot(baseDir), { recursive: true });
  }

  async function persist(session: SessionDocument) {
    await ensureDirectory();
    await writeSessionFile(currentSessionPath(baseDir), session);
    await writeSessionFile(archiveSessionPath(baseDir, session.session_id), session);
  }

  return {
    async readCurrent() {
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
    },

    async readById(sessionId) {
      await ensureDirectory();
      assertValidSessionId(sessionId);
      return readSessionFileWithFallback(
        archiveSessionPath(baseDir, sessionId),
        legacyArchiveSessionPath(baseDir, sessionId)
      );
    },

    async listAll() {
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

      return Array.from(sessionMap.values())
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    },

    async appendEntry(entry) {
      const session = await this.readCurrent();
      const next: SessionDocument = {
        ...session,
        updated_at: nowIso(),
        entries: [
          ...session.entries.filter(
            (candidate) =>
              !(
                candidate.tool === entry.tool &&
                candidate.cache_key === entry.cache_key
              )
          ),
          entry
        ]
      };

      await persist(next);
      return next;
    },

    async updateTrace(input) {
      const session = await this.readCurrent();
      const timestamp = nowIso();
      const currentTrace = normalizeSessionTrace(session.trace);
      const nextTrace: SessionTrace = {
        ...currentTrace,
        ...(input.research_goal !== undefined
          ? { research_goal: input.research_goal }
          : {}),
        ...(input.scope_note !== undefined ? { scope_note: input.scope_note } : {}),
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

      await persist(next);
      return next;
    },

    async annotateEntry(input) {
      const session = await this.readCurrent();
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
          ...(inputTrace?.intent !== undefined ? { intent: inputTrace.intent } : {}),
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

      await persist(next);
      return next;
    }
  };
}
