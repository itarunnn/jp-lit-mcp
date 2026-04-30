import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { getSessionsRoot } from "./paths.js";
import type {
  SessionAnnotationInput,
  SessionDocument,
  SessionEntry
} from "./types.js";

export interface SessionStore {
  appendEntry(entry: SessionEntry): Promise<SessionDocument>;
  annotateEntry(input: SessionAnnotationInput): Promise<SessionDocument>;
  listAll(): Promise<SessionDocument[]>;
  readById(sessionId: string): Promise<SessionDocument>;
  readCurrent(): Promise<SessionDocument>;
}

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

function currentSessionPath(baseDir: string) {
  return path.join(getSessionsRoot(baseDir), "current.json");
}

function archiveSessionPath(baseDir: string, sessionId: string) {
  return path.join(getSessionsRoot(baseDir), `${sessionId}.json`);
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
      return readSessionFile(archiveSessionPath(baseDir, sessionId));
    },

    async listAll() {
      await ensureDirectory();

      const filenames = await readdir(getSessionsRoot(baseDir));
      const sessions = await Promise.all(
        filenames
          .filter((filename) => filename.endsWith(".json") && filename !== "current.json")
          .map(async (filename) => {
            try {
              return await readSessionFile(path.join(getSessionsRoot(baseDir), filename));
            } catch {
              return null;
            }
          })
      );

      return sessions
        .filter((session): session is SessionDocument => session !== null)
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

    async annotateEntry(input) {
      const session = await this.readCurrent();
      let matched = false;
      const nextEntries = session.entries.map((entry) => {
        if (entry.tool !== input.tool || entry.cache_key !== input.cache_key) {
          return entry;
        }

        matched = true;
        return {
          ...entry,
          selected_items: input.selected_items,
          notes: input.notes ?? entry.notes
        };
      });

      if (!matched) {
        throw new Error(
          `Session entry not found for annotation: ${input.tool}/${input.cache_key}`
        );
      }

      const next: SessionDocument = {
        ...session,
        updated_at: nowIso(),
        entries: nextEntries
      };

      await persist(next);
      return next;
    }
  };
}
