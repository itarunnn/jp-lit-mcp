# Explicit Research Session Handles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `jp_lit_start_session` が発行した `session_id` を全 stateful tool call で明示的に渡し、並列調査間で session entry・注釈・trace・export が混線しないようにする。

**Architecture:** `SessionStore` は明示 ID の archive を mutation target として扱い、非 current session の更新で `current.json` を切り替えない。cached tool は `session_id` を cache input とは別の routing argument として `runCachedTool` へ渡し、cache identity を調査案件から独立させる。公開 schema と Skill は `session_id` を必須化し、current fallback は store 内部互換だけに限定する。

**Tech Stack:** TypeScript 5.8、Node.js 24（package floor は 22）、Zod 3、Vitest 3、MCP TypeScript SDK 1.30、PowerShell。

## Global Constraints

- 正本設計は `docs/superpowers/specs/2026-08-08-explicit-research-session-handles-design.md`。
- `session_id` は cache key、cache envelope input、upstream request に含めない。
- 既存 session / cache JSON の保存 schema と ID 形式は変更しない。
- `current.json` は互換エイリアスとして保持するが、公開 stateful tool は依存しない。
- HTTP replica 間の lock、認証、version bump、publish は対象外。
- コードと Skill の変更は failing test を確認してから行う。

---

### Task 1: SessionStore に明示 mutation target を追加する

**Files:**
- Modify: `tests/persistence/sessionStore.test.ts`
- Modify: `src/lib/persistence/sessionStore.ts`

**Interfaces:**
- Consumes: `SessionDocument`、`SessionEntry`、archive/current paths。
- Produces: `appendEntry(entry, sessionId?)`、`annotateEntry(input, sessionId?)`、`updateTrace(input, sessionId?)`。明示 ID の場合は archive を更新し、同じ ID が current のときだけ `current.json` も同期する。

- [x] **Step 1: routing の failing test を追加する**

```ts
const first = await store.startSession({ research_goal: "first" });
const second = await store.startSession({ research_goal: "second" });
await store.appendEntry(entryA, first.session_id);
await store.updateTrace({ scope_note: "first-only" }, first.session_id);
expect((await store.readById(first.session_id)).entries).toEqual([entryA]);
expect((await store.readCurrent()).session_id).toBe(second.session_id);
expect((await store.readCurrent()).entries).toEqual([]);
```

- [x] **Step 2: RED を確認する**

Run: `npm test -- tests/persistence/sessionStore.test.ts`

Expected: first session ではなく current が更新されるため FAIL。

- [x] **Step 3: target loader と persist policy を実装する**

```ts
async function loadMutationTarget(sessionId?: string) {
  if (!sessionId) return { session: await readCurrentUnlocked(), mirrorCurrent: true };
  const session = await readById(sessionId);
  const current = await readCurrentForStartUnlocked();
  return { session, mirrorCurrent: current?.session_id === session.session_id };
}
```

`persist(session, mirrorCurrent)` は archive を常に書き、`mirrorCurrent` の場合だけ current も書く。

- [x] **Step 4: GREEN を確認する**

Run: `npm test -- tests/persistence/sessionStore.test.ts tests/persistence/sessionStoreHistory.test.ts`

Expected: PASS。

- [x] **Step 5: commit**

Run: `git commit -am "feat: route session mutations by explicit id"`

### Task 2: cached runner と全 public input schema を明示化する

**Files:**
- Create: `tests/explicitSessionSchemas.test.ts`
- Modify: `tests/persistence/runCachedTool.test.ts`
- Modify: `src/lib/persistence/runCachedTool.ts`
- Modify: `src/lib/schemas.ts`

**Interfaces:**
- Produces: required `RunCachedToolOptions.sessionId: string` と、全 session-recording tool schema の required `session_id: string`。

- [x] **Step 1: cache 共有と session 分離の failing test を追加する**

```ts
const a = await sessions.startSession({ research_goal: "A" });
const b = await sessions.startSession({ research_goal: "B" });
const first = await runCachedTool({ tool: "jp_lit_search", input, sessionId: a.session_id, live, cache, sessions });
const second = await runCachedTool({ tool: "jp_lit_search", input, sessionId: b.session_id, live, cache, sessions });
expect(second.cacheKey).toBe(first.cacheKey);
expect(live).toHaveBeenCalledTimes(1);
expect((await sessions.readById(a.session_id)).entries).toHaveLength(1);
expect((await sessions.readById(b.session_id)).entries).toHaveLength(1);
```

- [x] **Step 2: schema table の failing test を追加する**

`searchInputSchema`、`recordInputSchema`、`recordsInputSchema`、`enrichRecordInputSchema`、NDL fulltext/page/image schemas、国書/CRD/典拠/KAKEN schemas、`annotateSessionInputSchema`、`updateSessionTraceInputSchema`、`exportSessionInputSchema` を table 化し、missing ID は FAIL、`2026-08-08-120000-a1b2c3d4` 付きは PASS とする。

- [x] **Step 3: RED を確認する**

Run: `npm test -- tests/persistence/runCachedTool.test.ts tests/explicitSessionSchemas.test.ts`

Expected: routing と missing-ID rejection が未実装なので FAIL。

- [x] **Step 4: runner と schemas を実装する**

```ts
interface RunCachedToolOptions<T> {
  tool: string;
  input: Record<string, unknown>;
  sessionId: string;
  live: () => Promise<T>;
  cache: FileCache;
  sessions: SessionStore;
}
```

cache hit / miss の両 branch で `sessions.appendEntry(entry, sessionId)` を呼ぶ。schema field の説明は transport ID ではなく調査案件 handle と明記する。

- [x] **Step 5: GREEN と commit**

Run: `npm test -- tests/persistence/runCachedTool.test.ts tests/explicitSessionSchemas.test.ts`

Run: `git add -- src/lib/persistence/runCachedTool.ts src/lib/schemas.ts tests/persistence/runCachedTool.test.ts tests/explicitSessionSchemas.test.ts; git commit -m "feat: require research session handles"`

### Task 3: cached tool へ `session_id` を引き回す

**Files:**
- Modify: `src/tools/jpLitSearch.ts`
- Modify: `src/tools/jpLitGetRecord.ts`
- Modify: `src/tools/jpLitGetRecords.ts`
- Modify: `src/tools/jpLitEnrichRecord.ts`
- Modify: `src/tools/jpLitGetTextCoordinates.ts`
- Modify: `src/tools/jpLitGetFulltext.ts`
- Modify: `src/tools/jpLitSearchPages.ts`
- Modify: `src/tools/jpLitSearchFulltext.ts`
- Modify: `src/tools/jpLitSearchIllustrations.ts`
- Modify: `src/tools/jpLitSearchKokushoFulltext.ts`
- Modify: `src/tools/jpLitSearchKokushoImageTags.ts`
- Modify: `src/tools/jpLitSearchGuidesManuals.ts`
- Modify: `src/tools/jpLitSearchGuidesCases.ts`
- Modify: `src/tools/jpLitResolveAuthority.ts`
- Modify: `src/tools/jpLitFindAuthorityTermsByClassification.ts`
- Modify: `src/tools/jpLitSuggestClassificationCodes.ts`
- Modify: `src/tools/jpLitSearchKakenProjects.ts`
- Modify: corresponding cached tool tests。

**Interfaces:**
- Consumes: parsed `{ session_id, force_refresh, ...cacheableInput }`。
- Produces: every `runCachedTool` call has `sessionId: session_id`; batch lookup forwards the same ID to every inner record lookup。

- [x] **Step 1: TypeScript RED を確認する**

Run: `npm run build`

Expected: `runCachedTool` caller に required `sessionId` error。

- [x] **Step 2: 最小 plumbing を実装する**

```ts
const { session_id, force_refresh, ...cacheableInput } = parsed;
await runCachedTool({
  tool: "jp_lit_search",
  input: cacheableInput,
  sessionId: session_id,
  cache,
  sessions,
  bypassCache: force_refresh,
  live
});
```

normalization 前に ID を分離し、upstream input と cache input に入れない。`jp_lit_get_records` は inner lookup に `session_id: parsed.session_id` を追加する。

- [x] **Step 3: GREEN と commit**

Run: `npm run build`

Run: `npm test -- tests/jpLitSearch.test.ts tests/jpLitGetRecord.test.ts tests/jpLitGetRecords.test.ts tests/jpLitEnrichRecord.test.ts tests/jpLitSearchFulltext.test.ts tests/sessionAnnotationPersistence.test.ts`

Run: `git add -- src/tools tests; git commit -m "feat: thread session handles through cached tools"`

### Task 4: mutation、export、refine から current fallback を除く

**Files:**
- Modify: `src/tools/jpLitAnnotateSession.ts`
- Modify: `src/tools/jpLitUpdateSessionTrace.ts`
- Modify: `src/tools/jpLitExportSession.ts`
- Modify: `src/tools/jpLitRefineResults.ts`
- Modify: `src/lib/schemas.ts`
- Modify: `tests/jpLitAnnotateSession.test.ts`
- Modify: `tests/jpLitUpdateSessionTrace.test.ts`
- Modify: `tests/jpLitExportSessionHistory.test.ts`
- Modify: `tests/jpLitRefineResults.test.ts`
- Modify: `tests/jpLitExportView.test.ts`

**Interfaces:**
- Produces: annotation/trace/export target requested archive; refine requires exactly one of `session_id` / `cache_key` / `cache_keys` and has no `readCurrent()` branch。

- [x] **Step 1: explicit target と selector の failing tests を追加する**

非 current session を annotate/update/export して current が変わらないこと、refine `{}` と複数 selector が validation error になることを検証する。

- [x] **Step 2: RED を確認する**

Run: `npm test -- tests/jpLitAnnotateSession.test.ts tests/jpLitUpdateSessionTrace.test.ts tests/jpLitExportSessionHistory.test.ts tests/jpLitRefineResults.test.ts tests/jpLitExportView.test.ts`

- [x] **Step 3: routing と selector validation を実装する**

```ts
const session = await sessionStore.annotateEntry(annotation, parsed.session_id);
const session = await sessionStore.updateTrace(traceUpdate, parsed.session_id);
const session = await sessionStore.readById(parsed.session_id);
```

refine の implicit latest cache / implicit enrichment current を削除する。`exportView(view="refined_results")` の `params` default `{}` も削除する。

- [x] **Step 4: GREEN と commit**

Run: `npm test -- tests/jpLitAnnotateSession.test.ts tests/jpLitUpdateSessionTrace.test.ts tests/jpLitExportSessionHistory.test.ts tests/jpLitRefineResults.test.ts tests/jpLitExportView.test.ts`

Run: `git add -- src/tools src/lib/schemas.ts tests; git commit -m "feat: remove public current-session fallbacks"`

### Task 5: smoke、Skill、docs を新 contract へ移行する

**Files:**
- Modify: `scripts/smoke-mcp.ts`
- Modify: `tests/smokeMcp.test.ts`
- Modify: `skills/jp-lit-research/SKILL.md`
- Modify: `skills/jp-lit-research/reference/01-core-workflow.md`
- Modify: `skills/jp-lit-research/reference/03-evidence-and-output.md`
- Modify: `tests/skillGuide.test.ts`
- Modify: `README.md`
- Modify: `docs/reference.md`
- Modify: `docs/usage-guide.md`
- Modify: `docs/project-status.md`
- Modify: `plans/research_trace_ledger_plan.md`（ローカル handoff note）。

**Interfaces:**
- Produces: workflow は start で得た ID を検索・注釈・trace・export に引き回し、ID を失った場合は list/find sessions で回復する。

- [x] **Step 1: workflow contract の failing tests を追加する**

Skill が「調査開始時に start」「返却 ID を全 stateful call に渡す」「session ID と cache key を分離」を指示し、deterministic smoke が実際に同じ ID を使うことを検証する。

- [x] **Step 2: RED を確認する**

Run: `npm test -- tests/skillGuide.test.ts tests/smokeMcp.test.ts`

- [x] **Step 3: smoke / Skill / docs を更新する**

```ts
const started = await callTool("jp_lit_start_session", { research_goal: "offline smoke" });
const sessionId = started.structuredContent.session_id;
await callTool("jp_lit_search", { session_id: sessionId, query: "fixture" });
```

reference の全 cached tool 共通入力に `session_id` 必須を記載し、保存済み JSON migration は不要、cache は session 間共有と説明する。status は未公開実装であることを明記する。

- [x] **Step 4: GREEN と commit**

Run: `npm test -- tests/skillGuide.test.ts tests/smokeMcp.test.ts tests/readmeLinks.test.ts tests/toolDescriptionQuality.test.ts`

Run: `npm run smoke:mcp:offline`

Run: `git add -- scripts/smoke-mcp.ts tests/smokeMcp.test.ts skills/jp-lit-research README.md docs/reference.md docs/usage-guide.md docs/project-status.md tests/skillGuide.test.ts; git commit -m "docs: migrate research workflow to session handles"`

### Task 6: 全体検証と handoff を確定する

**Files:**
- Modify: `docs/superpowers/plans/2026-08-08-explicit-research-session-handles.md`
- Modify: `docs/project-status.md`（実績差分がある場合）。

**Interfaces:**
- Produces: checkbox と実測結果を反映した完了 plan、fresh build/test evidence、未公開状態と既知制約の明示。

- [x] **Step 1: fresh verification を実行する**

```powershell
npm run build
npm run typecheck:scripts
npm run smoke:mcp:offline
npm test
git diff --check
git status --short --branch
```

- [x] **Step 2: 設計 coverage を照合する**

cached 17 tool、annotate/trace/export、refine、cache-sharing test、non-current mutation test、Skill/smoke、対象外の誤記なしを確認する。

- [x] **Step 3: plan checkbox と検証実績を更新して commit する**

Run: `git add -f -- docs/superpowers/plans/2026-08-08-explicit-research-session-handles.md; git add -- docs/project-status.md; git commit -m "chore: complete explicit session handle migration"`

- [x] **Step 4: final commit 上で再検証する**

Run: `npm run build; npm run typecheck:scripts; npm run smoke:mcp:offline; npm test; git diff --check`

Expected: 全 command exit 0。push、version bump、npm publish は行わない。

## Execution Record

- 2026-08-08: Task 1〜5 を TDD で実装。schema missing-ID、cache 共有/session 分離、非 current mutation、refine selector、deterministic offline smoke、Skill contract をテストで固定した。
- 2026-08-08: cached direct tool 16種と batch tool 1種を照合し、`session_id` を cache input / upstream input から分離した。annotation / trace / export / refine の公開 current fallback を削除した。
- 2026-08-08: `npm run build`、`npm run typecheck:scripts`、`npm run smoke:mcp:offline`、`npm test`（80 files / 733 tests）、`git diff --check` を実行して exit 0 を確認した。
- 対象外のまま残す制約: process 間 lock、共有 storage、HTTP authentication / authorization、version bump、push、npm publish。
