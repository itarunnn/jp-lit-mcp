# Cache And Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ndl-jp-lit-mcp` にローカル永続キャッシュ、調査セッション保存、注釈保存、明示エクスポートを追加する

**Architecture:** `.cache/ndl-jp-lit-mcp/` に正規化済み `structuredContent` を tool 単位で保存し、別の session store が現在セッションの entry と候補注釈を持つ。既存ツールは cache-hit 時に保存済み `structuredContent` を返し、新規 `jp_lit_annotate_session` と `jp_lit_export_session` が session の注釈保存とエクスポートを担当する。

**Tech Stack:** TypeScript, Node.js `fs/promises`, Zod, MCP SDK, Vitest

---

### Task 1: 永続化の型とファイルストアを作る

**Files:**
- Create: `src/lib/persistence/types.ts`
- Create: `src/lib/persistence/cacheKeys.ts`
- Create: `src/lib/persistence/fileCache.ts`
- Create: `src/lib/persistence/paths.ts`
- Test: `tests/persistence/fileCache.test.ts`

- [ ] **Step 1: 永続化の失敗テストを書く**

```ts
import { describe, expect, it } from "vitest";
import { createCacheKey } from "../../src/lib/persistence/cacheKeys.js";

describe("createCacheKey", () => {
  it("normalizes object key order", () => {
    const a = createCacheKey("jp_lit_search", { query: "foo", page: 1 });
    const b = createCacheKey("jp_lit_search", { page: 1, query: "foo" });
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/persistence/fileCache.test.ts`
Expected: FAIL with missing module or missing export under `src/lib/persistence`

- [ ] **Step 3: 永続化基盤を最小実装する**

```ts
export interface CacheEnvelope<T> {
  version: number;
  tool: string;
  cache_key: string;
  saved_at: string;
  input: Record<string, unknown>;
  structured_content: T;
}
```

```ts
export function createCacheKey(tool: string, input: Record<string, unknown>) {
  return `${tool}-${stableHash(stableStringify(input))}`;
}
```

```ts
export function createFileCache(baseDir?: string) {
  return {
    async read<T>(tool: string, key: string): Promise<CacheEnvelope<T> | null> {},
    async write<T>(tool: string, envelope: CacheEnvelope<T>): Promise<void> {}
  };
}
```

- [ ] **Step 4: テストを再実行して通過を確認する**

Run: `npm test -- tests/persistence/fileCache.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/persistence tests/persistence/fileCache.test.ts
git commit -m "feat: add persistence cache primitives"
```

### Task 2: セッション保存と注釈更新を作る

**Files:**
- Create: `src/lib/persistence/sessionTypes.ts`
- Create: `src/lib/persistence/sessionStore.ts`
- Create: `src/lib/persistence/annotateSession.ts`
- Test: `tests/persistence/sessionStore.test.ts`

- [ ] **Step 1: セッション更新の失敗テストを書く**

```ts
import { describe, expect, it } from "vitest";

describe("session store", () => {
  it("creates current session and updates selected items", async () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/persistence/sessionStore.test.ts`
Expected: FAIL with placeholder assertion

- [ ] **Step 3: session store と annotate 処理を実装する**

```ts
export type SessionItemLabel = "confirmed" | "strong_candidate" | "weak_candidate";

export interface SessionEntry {
  tool: string;
  input: Record<string, unknown>;
  cache_key: string;
  result_ref: { tool: string; cache_key: string };
  selected_items: SessionSelectedItem[];
  notes: string[];
}
```

```ts
export function createSessionStore(baseDir?: string) {
  return {
    async appendEntry(entry: SessionEntry): Promise<SessionDocument> {},
    async annotateEntry(target: EntryRef, patch: AnnotationPatch): Promise<SessionDocument> {},
    async readCurrent(): Promise<SessionDocument> {}
  };
}
```

- [ ] **Step 4: テストを再実行して通過を確認する**

Run: `npm test -- tests/persistence/sessionStore.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/persistence tests/persistence/sessionStore.test.ts
git commit -m "feat: add session store and annotation support"
```

### Task 3: キャッシュ付きツール実行ラッパを作る

**Files:**
- Create: `src/lib/persistence/runCachedTool.ts`
- Test: `tests/persistence/runCachedTool.test.ts`

- [ ] **Step 1: cache-hit / cache-miss の失敗テストを書く**

```ts
it("returns cached structuredContent on cache hit", async () => {
  expect(true).toBe(false);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/persistence/runCachedTool.test.ts`
Expected: FAIL

- [ ] **Step 3: ラッパを最小実装する**

```ts
export async function runCachedTool<T>(options: {
  tool: string;
  input: Record<string, unknown>;
  live: () => Promise<T>;
  cache: FileCache;
  sessions: SessionStore;
}) {
  // read -> live -> write -> append session
}
```

- [ ] **Step 4: テストを再実行して通過を確認する**

Run: `npm test -- tests/persistence/runCachedTool.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/persistence/runCachedTool.ts tests/persistence/runCachedTool.test.ts
git commit -m "feat: add cached tool execution helper"
```

### Task 4: `jp_lit_search` と `jp_lit_get_record` に統合する

**Files:**
- Modify: `src/tools/jpLitSearch.ts`
- Modify: `src/tools/jpLitGetRecord.ts`
- Modify: `src/server.ts`
- Test: `tests/jpLitSearch.test.ts`
- Test: `tests/jpLitGetRecord.test.ts`

- [ ] **Step 1: search/record の cache 利用テストを追加する**

```ts
it("reuses cached search structuredContent on second call", async () => {
  expect(true).toBe(false);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/jpLitSearch.test.ts tests/jpLitGetRecord.test.ts`
Expected: FAIL on new cache/session expectations

- [ ] **Step 3: search/record ツールを runCachedTool 経由へ切り替える**

```ts
const structuredContent = await runCachedTool({
  tool: "jp_lit_search",
  input: parsed,
  live: async () => ({ ... }),
  cache,
  sessions
});
```

- [ ] **Step 4: テストを再実行して通過を確認する**

Run: `npm test -- tests/jpLitSearch.test.ts tests/jpLitGetRecord.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/tools/jpLitSearch.ts src/tools/jpLitGetRecord.ts src/server.ts tests/jpLitSearch.test.ts tests/jpLitGetRecord.test.ts
git commit -m "feat: cache search and record tool responses"
```

### Task 5: `jp_lit_annotate_session` と `jp_lit_export_session` を追加する

**Files:**
- Modify: `src/lib/schemas.ts`
- Create: `src/tools/jpLitAnnotateSession.ts`
- Create: `src/tools/jpLitExportSession.ts`
- Create: `src/lib/persistence/exportSession.ts`
- Modify: `src/server.ts`
- Test: `tests/jpLitAnnotateSession.test.ts`
- Test: `tests/jpLitExportSession.test.ts`

- [ ] **Step 1: 新規ツールの失敗テストを書く**

```ts
it("stores selected items in current session", async () => {
  expect(true).toBe(false);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/jpLitAnnotateSession.test.ts tests/jpLitExportSession.test.ts`
Expected: FAIL with missing tool modules or missing schemas

- [ ] **Step 3: schema、tool、exporter を実装する**

```ts
export const annotateSessionInputSchema = z.object({
  tool: z.string(),
  cache_key: z.string(),
  selected_items: z.array(...),
  notes: z.array(z.string()).optional()
});
```

```ts
export function createJpLitExportSessionTool(sessionStore: SessionStore, exporter: SessionExporter) {}
```

- [ ] **Step 4: テストを再実行して通過を確認する**

Run: `npm test -- tests/jpLitAnnotateSession.test.ts tests/jpLitExportSession.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/schemas.ts src/tools/jpLitAnnotateSession.ts src/tools/jpLitExportSession.ts src/lib/persistence/exportSession.ts src/server.ts tests/jpLitAnnotateSession.test.ts tests/jpLitExportSession.test.ts
git commit -m "feat: add session annotation and export tools"
```

### Task 6: Next Digital Library 系ツールと文書を更新する

**Files:**
- Modify: `src/tools/jpLitGetTextCoordinates.ts`
- Modify: `src/tools/jpLitGetFulltext.ts`
- Modify: `src/tools/jpLitSearchPages.ts`
- Modify: `src/tools/jpLitSearchFulltext.ts`
- Modify: `src/tools/jpLitSearchIllustrations.ts`
- Modify: `.gitignore`
- Modify: `README.md`
- Test: `tests/nextDigitalLibraryPersistence.test.ts`

- [ ] **Step 1: 重い結果の session 参照保存テストを書く**

```ts
it("stores heavy next-dl payloads in cache and only references them from session", async () => {
  expect(true).toBe(false);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/nextDigitalLibraryPersistence.test.ts`
Expected: FAIL

- [ ] **Step 3: 残りのツールと文書を更新する**

```ts
const structuredContent = await runCachedTool({
  tool: "jp_lit_get_fulltext",
  input: parsed,
  live: async () => fulltextOutputSchema.parse(result),
  cache,
  sessions,
  sessionMode: "reference-heavy"
});
```

- [ ] **Step 4: テストとビルドを再実行して通過を確認する**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/tools .gitignore README.md tests
git commit -m "feat: persist next-dl tool outputs and document workflow"
```
