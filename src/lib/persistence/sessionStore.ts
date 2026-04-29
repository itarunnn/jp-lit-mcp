import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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

  await writeFile(temp, JSON.stringify(value, null, 2), "utf8");
  await rm(target, { force: true });
  await rename(temp, target);
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
        const text = await readFile(currentSessionPath(baseDir), "utf8");
        return JSON.parse(text) as SessionDocument;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          try {
            const brokenPath = `${currentSessionPath(baseDir)}.invalid`;
            await rename(currentSessionPath(baseDir), brokenPath);
          } catch {
            // ignore follow-up failure
          }
        }

        const session = createEmptySession();
        await persist(session);
        return session;
      }
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
