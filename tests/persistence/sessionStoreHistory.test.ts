import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { getSessionsRoot } from "../../src/lib/persistence/paths.js";
import { createSessionStore } from "../../src/lib/persistence/sessionStore.js";
import type { SessionDocument } from "../../src/lib/persistence/types.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ndl-jp-lit-session-history-"));
  tempDirs.push(dir);
  return dir;
}

async function writeArchiveSession(baseDir: string, session: SessionDocument) {
  const sessionsDir = getSessionsRoot(baseDir);
  await mkdir(sessionsDir, { recursive: true });
  await writeFile(
    path.join(sessionsDir, `${session.session_id}.json`),
    JSON.stringify(session, null, 2),
    "utf8"
  );
}

function currentSessionFile(baseDir: string) {
  return path.join(getSessionsRoot(baseDir), "current.json");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("session store history", () => {
  it("reads archived session by id", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);
    const archived: SessionDocument = {
      session_id: "2026-05-01-120000",
      created_at: "2026-05-01T12:00:00.000Z",
      updated_at: "2026-05-01T12:30:00.000Z",
      entries: []
    };

    await writeArchiveSession(baseDir, archived);

    await expect(store.readById(archived.session_id)).resolves.toEqual(archived);
  });

  it("lists archived sessions ordered by updated_at descending and skips current and broken json", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);
    const sessionsDir = getSessionsRoot(baseDir);
    const oldest: SessionDocument = {
      session_id: "2026-04-29-090000",
      created_at: "2026-04-29T09:00:00.000Z",
      updated_at: "2026-04-29T09:10:00.000Z",
      entries: []
    };
    const newest: SessionDocument = {
      session_id: "2026-05-01-120000",
      created_at: "2026-05-01T12:00:00.000Z",
      updated_at: "2026-05-01T12:30:00.000Z",
      entries: []
    };

    await writeArchiveSession(baseDir, oldest);
    await writeArchiveSession(baseDir, newest);
    await mkdir(sessionsDir, { recursive: true });
    await writeFile(path.join(sessionsDir, "broken.json"), "{", "utf8");
    await writeFile(
      path.join(sessionsDir, "current.json"),
      JSON.stringify({
        session_id: "current",
        created_at: "2026-05-01T12:40:00.000Z",
        updated_at: "2026-05-01T12:50:00.000Z",
        entries: []
      } satisfies SessionDocument),
      "utf8"
    );

    await expect(store.listAll()).resolves.toEqual([newest, oldest]);
  });

  it("moves broken current session to .invalid and creates a new session", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);
    const currentPath = currentSessionFile(baseDir);

    await mkdir(getSessionsRoot(baseDir), { recursive: true });
    await writeFile(currentPath, "{", "utf8");

    const session = await store.readCurrent();

    await expect(access(`${currentPath}.invalid`)).resolves.toBeUndefined();
    await expect(readFile(`${currentPath}.invalid`, "utf8")).resolves.toBe("{");
    expect(session.entries).toEqual([]);
    expect(session.session_id).not.toBe("");
  });

  it("rethrows current session read failures that are not json parse errors", async () => {
    const baseDir = await createTempDir();
    const store = createSessionStore(baseDir);
    const currentPath = currentSessionFile(baseDir);

    await mkdir(currentPath, { recursive: true });

    await expect(store.readCurrent()).rejects.toMatchObject({
      code: "EISDIR"
    });
    await expect(access(`${currentPath}.invalid`)).rejects.toMatchObject({
      code: "ENOENT"
    });
  });
});
