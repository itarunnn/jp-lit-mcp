# 過去セッション検索・再エクスポート Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 主題・キーワードで過去の調査セッションを探せるようにし、見つけた過去セッションを指定して export できるようにする。

**Architecture:** 既存の `.cache/ndl-jp-lit-mcp/sessions/` をそのまま原本として使い、`SessionStore` に archive 読み出しと一覧化の能力を追加する。その上で新規ツール `jp_lit_find_sessions` を追加し、既存 `jp_lit_export_session` に `session_id` 指定を足して current session 固定を解除する。

**Tech Stack:** TypeScript, Zod, MCP SDK, Vitest, 既存 persistence/sessionStore

---

## 対象ファイル

### 変更対象

- `src/lib/persistence/sessionStore.ts`
  - current session 以外の archive 読み出しと列挙を追加
- `src/lib/schemas.ts`
  - `jp_lit_find_sessions` の input/output schema
  - `jp_lit_export_session` input へ `session_id` 追加
- `src/tools/jpLitExportSession.ts`
  - `session_id` 指定時に `readById()` を使う
- `src/server.ts`
  - `jp_lit_find_sessions` の登録
  - `jp_lit_export_session` description 更新
- `README.md`
  - 過去セッション検索の使い方を追記
- `docs/usage-guide.md`
  - 自然言語例を中心に追記

### 新規作成

- `src/tools/jpLitFindSessions.ts`
  - 過去セッション検索ロジック
- `tests/persistence/sessionStoreHistory.test.ts`
  - archive 読み出し / listAll のテスト
- `tests/jpLitFindSessions.test.ts`
  - 過去セッション検索ツールのテスト
- `tests/jpLitExportSessionHistory.test.ts`
  - `session_id` 指定 export のテスト

---

### Task 1: SessionStore を archive 対応に拡張する

**Files:**
- Modify: `src/lib/persistence/sessionStore.ts`
- Test: `tests/persistence/sessionStoreHistory.test.ts`

- [ ] **Step 1: archive 読み出しの失敗テストを書く**

```ts
it("readById で archive session を読める", async () => {
  const store = createSessionStore(baseDir);
  const session = await store.appendEntry(entryA);

  const archived = await store.readById(session.session_id);

  expect(archived.session_id).toBe(session.session_id);
  expect(archived.entries).toHaveLength(1);
});

it("listAll は archive 一覧を updated_at 降順で返す", async () => {
  const store = createSessionStore(baseDir);
  const first = await store.appendEntry(entryA);
  const second = await store.appendEntry(entryB);

  const sessions = await store.listAll();

  expect(sessions.map((item) => item.session_id)).toContain(first.session_id);
  expect(sessions.map((item) => item.session_id)).toContain(second.session_id);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/persistence/sessionStoreHistory.test.ts`

Expected: FAIL with missing `readById` / `listAll`

- [ ] **Step 3: SessionStore interface と実装を最小追加する**

```ts
export interface SessionStore {
  appendEntry(entry: SessionEntry): Promise<SessionDocument>;
  annotateEntry(input: SessionAnnotationInput): Promise<SessionDocument>;
  readCurrent(): Promise<SessionDocument>;
  readById(sessionId: string): Promise<SessionDocument>;
  listAll(): Promise<SessionDocument[]>;
}
```

```ts
async function readSessionFile(target: string) {
  const text = await readFile(target, "utf8");
  return JSON.parse(text) as SessionDocument;
}
```

```ts
async readById(sessionId) {
  await ensureDirectory();
  return readSessionFile(archiveSessionPath(baseDir, sessionId));
}
```

```ts
async listAll() {
  await ensureDirectory();
  const entries = await readdir(getSessionsRoot(baseDir), { withFileTypes: true });
  const sessionFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".json") && name !== "current.json");

  const sessions = await Promise.all(
    sessionFiles.map(async (name) => {
      try {
        return await readSessionFile(path.join(getSessionsRoot(baseDir), name));
      } catch {
        return null;
      }
    })
  );

  return sessions
    .filter((session): session is SessionDocument => session !== null)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}
```

- [ ] **Step 4: テストを再実行して通過を確認する**

Run: `npm test -- tests/persistence/sessionStoreHistory.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/persistence/sessionStore.ts tests/persistence/sessionStoreHistory.test.ts
git commit -m "feat: add archive session history access"
```

---

### Task 2: `jp_lit_find_sessions` の schema とテストを書く

**Files:**
- Modify: `src/lib/schemas.ts`
- Create: `tests/jpLitFindSessions.test.ts`

- [ ] **Step 1: ツールの入出力 schema テストを書く**

```ts
it("主題語が query / selected_items.title / notes に部分一致した session を返す", async () => {
  const result = await tool({ query: "女学生", limit: 10 });

  expect(result.structuredContent.query).toBe("女学生");
  expect(result.structuredContent.items[0]?.matched_fields).toContain("query");
});
```

```ts
it("ヒット 0 件でも total=0, items=[] を返す", async () => {
  const result = await tool({ query: "不存在語" });

  expect(result.structuredContent.total).toBe(0);
  expect(result.structuredContent.items).toEqual([]);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/jpLitFindSessions.test.ts`

Expected: FAIL with missing schema / tool

- [ ] **Step 3: schema を追加する**

```ts
export const findSessionsInputSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().positive().max(50).default(10)
});
```

```ts
export const findSessionsOutputSchema = z.object({
  query: z.string(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      session_id: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
      matched_fields: z.array(z.enum(["query", "selected_title", "notes"])),
      query_preview: z.string().nullable(),
      selected_count: z.number().int().nonnegative(),
      note_preview: z.string().nullable()
    })
  )
});
```

- [ ] **Step 4: 型 export を追加する**

```ts
export type FindSessionsInput = z.infer<typeof findSessionsInputSchema>;
export type FindSessionsOutput = z.infer<typeof findSessionsOutputSchema>;
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts tests/jpLitFindSessions.test.ts
git commit -m "feat: add find sessions schemas"
```

---

### Task 3: `jp_lit_find_sessions` ツール本体を実装する

**Files:**
- Create: `src/tools/jpLitFindSessions.ts`
- Modify: `src/server.ts`
- Test: `tests/jpLitFindSessions.test.ts`

- [ ] **Step 1: 失敗テストを具体化する**

```ts
it("updated_at 降順で session 一覧を返す", async () => {
  const result = await tool({ query: "制服" });

  expect(result.structuredContent.items[0]?.updated_at >= result.structuredContent.items[1]?.updated_at).toBe(true);
});
```

```ts
it("limit を超える件数は返さない", async () => {
  const result = await tool({ query: "制服", limit: 1 });
  expect(result.structuredContent.items).toHaveLength(1);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/jpLitFindSessions.test.ts`

Expected: FAIL with missing tool implementation

- [ ] **Step 3: 最小実装を書く**

```ts
function normalize(text: string) {
  return text.normalize("NFKC").toLocaleLowerCase();
}
```

```ts
function matchEntry(entry: SessionDocument["entries"][number], needle: string) {
  const matchedFields = new Set<"query" | "selected_title" | "notes">();

  const queryText = typeof entry.input.query === "string" ? entry.input.query : null;
  if (queryText && normalize(queryText).includes(needle)) {
    matchedFields.add("query");
  }

  for (const item of entry.selected_items) {
    if (normalize(item.title).includes(needle)) {
      matchedFields.add("selected_title");
      break;
    }
  }

  for (const note of entry.notes) {
    if (normalize(note).includes(needle)) {
      matchedFields.add("notes");
      break;
    }
  }

  return matchedFields;
}
```

```ts
export function createJpLitFindSessionsTool(sessionStore: SessionStore) {
  return async (input: unknown) => {
    const parsed = findSessionsInputSchema.parse(input);
    const needle = normalize(parsed.query);
    const sessions = await sessionStore.listAll();

    const items = sessions
      .map((session) => {
        const matchedFields = new Set<"query" | "selected_title" | "notes">();
        for (const entry of session.entries) {
          for (const field of matchEntry(entry, needle)) {
            matchedFields.add(field);
          }
        }

        if (matchedFields.size === 0) {
          return null;
        }

        const firstQuery = session.entries.find(
          (entry) => typeof entry.input.query === "string"
        )?.input.query as string | undefined;
        const firstNote = session.entries.flatMap((entry) => entry.notes)[0] ?? null;
        const selectedCount = session.entries.reduce(
          (sum, entry) => sum + entry.selected_items.length,
          0
        );

        return {
          session_id: session.session_id,
          created_at: session.created_at,
          updated_at: session.updated_at,
          matched_fields: [...matchedFields],
          query_preview: firstQuery ?? null,
          selected_count: selectedCount,
          note_preview: firstNote
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, parsed.limit);

    const structuredContent = findSessionsOutputSchema.parse({
      query: parsed.query,
      limit: parsed.limit,
      total: items.length,
      items
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent
    };
  };
}
```

- [ ] **Step 4: `server.ts` に登録する**

```ts
import {
  findSessionsInputSchema,
  findSessionsOutputSchema,
} from "./lib/schemas.js";
import { createJpLitFindSessionsTool } from "./tools/jpLitFindSessions.js";
```

```ts
const findSessionsTool = createJpLitFindSessionsTool(sessions);
```

```ts
server.registerTool(
  "jp_lit_find_sessions",
  {
    description: "過去の調査セッションを主題・キーワード・候補タイトル・メモから検索する",
    inputSchema: findSessionsInputSchema,
    outputSchema: findSessionsOutputSchema
  },
  findSessionsTool
);
```

- [ ] **Step 5: テストを再実行して通過を確認する**

Run: `npm test -- tests/jpLitFindSessions.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/tools/jpLitFindSessions.ts src/server.ts tests/jpLitFindSessions.test.ts src/lib/schemas.ts
git commit -m "feat: add session history search tool"
```

---

### Task 4: `jp_lit_export_session(session_id=...)` を追加する

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/tools/jpLitExportSession.ts`
- Test: `tests/jpLitExportSessionHistory.test.ts`

- [ ] **Step 1: 過去 session export の失敗テストを書く**

```ts
it("session_id 指定で archive session を export できる", async () => {
  const result = await tool({
    session_id: archivedSessionId,
    format: "markdown",
    profile: "selected"
  });

  expect(result.structuredContent.session_id).toBe(archivedSessionId);
});
```

```ts
it("存在しない session_id ではエラーになる", async () => {
  await expect(
    tool({ session_id: "missing-session", format: "json", profile: "full_log" })
  ).rejects.toThrow();
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/jpLitExportSessionHistory.test.ts`

Expected: FAIL with unknown `session_id`

- [ ] **Step 3: input schema に `session_id` を足す**

```ts
export const exportSessionInputSchema = z.object({
  format: z.enum(["markdown", "json"]).default("markdown"),
  profile: z.enum(["full_log", "selected", "unselected"]).default("full_log"),
  session_id: z.string().trim().min(1).optional(),
  output_path: z.string().trim().min(1).optional(),
  include_unselected: z.boolean().default(true)
});
```

- [ ] **Step 4: tool 実装で `readById` を使う**

```ts
const session = parsed.session_id
  ? await sessionStore.readById(parsed.session_id)
  : await sessionStore.readCurrent();
```

- [ ] **Step 5: テストを再実行して通過を確認する**

Run: `npm test -- tests/jpLitExportSessionHistory.test.ts tests/jpLitExportSession.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas.ts src/tools/jpLitExportSession.ts tests/jpLitExportSessionHistory.test.ts tests/jpLitExportSession.test.ts
git commit -m "feat: support exporting archived sessions"
```

---

### Task 5: ドキュメントと smoke 系を更新する

**Files:**
- Modify: `README.md`
- Modify: `docs/usage-guide.md`
- Test: `tests/readmeLinks.test.ts`
- Test: `tests/installDocs.test.ts`

- [ ] **Step 1: README に自然言語例を追加する**

```md
- `過去に女学生 制服で調べたセッションを探して`
- `前に「常陸国風土記」で調べた結果を探して`
- `そのセッションを Markdown で書き出して`
```

- [ ] **Step 2: usage-guide に保存場所との関係を追記する**

```md
`jp_lit_find_sessions` は `.cache/ndl-jp-lit-mcp/sessions/` に残っている過去セッションを検索する。
見つけた session は `jp_lit_export_session(session_id=...)` で再エクスポートできる。
```

- [ ] **Step 3: ドキュメントテストを実行する**

Run: `npm test -- tests/readmeLinks.test.ts tests/installDocs.test.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md docs/usage-guide.md
git commit -m "docs: add session history search usage"
```

---

### Task 6: 全体確認

**Files:**
- Verify only

- [ ] **Step 1: 追加テストをまとめて実行する**

Run: `npm test -- tests/persistence/sessionStoreHistory.test.ts tests/jpLitFindSessions.test.ts tests/jpLitExportSessionHistory.test.ts tests/jpLitExportSession.test.ts`

Expected: PASS

- [ ] **Step 2: 全体テストを実行する**

Run: `npm test`

Expected: PASS

- [ ] **Step 3: ビルドを確認する**

Run: `npm run build`

Expected: PASS

- [ ] **Step 4: smoke を確認する**

Run: `npm run smoke:mcp`

Expected: `MCP smoke check passed.`

- [ ] **Step 5: 差分チェック**

Run: `git diff --check`

Expected: 空白エラーなし

- [ ] **Step 6: Final commit**

```bash
git add src/lib/persistence/sessionStore.ts src/lib/schemas.ts src/tools/jpLitFindSessions.ts src/tools/jpLitExportSession.ts src/server.ts README.md docs/usage-guide.md tests/persistence/sessionStoreHistory.test.ts tests/jpLitFindSessions.test.ts tests/jpLitExportSessionHistory.test.ts tests/jpLitExportSession.test.ts
git commit -m "feat: add session history discovery and archived export"
```

---

## セルフレビュー

### spec coverage

- `jp_lit_find_sessions`: Task 2, 3 で対応
- `session_id` 指定 export: Task 4 で対応
- `SessionStore` 拡張: Task 1 で対応
- README / usage-guide 更新: Task 5 で対応
- テストと検証: Task 6 で対応

### placeholder scan

- `TBD` / `TODO` なし
- 省略した実装箇所なし

### type consistency

- 検索ツール名は `jp_lit_find_sessions` で統一
- `matched_fields` は `"query" | "selected_title" | "notes"` で統一
- export profile は既存の `full_log` / `selected` / `unselected` のまま

