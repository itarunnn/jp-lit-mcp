# デジコレ・ブラウザ観測結果の共通候補化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** デジコレ公式画面をエージェントが確認した結果を公開 MCP の cache / session に保存し、通常検索・次世代デジタルライブラリー全文検索と同じ候補型へ正規化して、統合・重複整理・注釈・export できるようにする。

**Architecture:** ブラウザ操作はエージェント側に残し、MCP は厳格に検証した観測値だけを受け取る local-write tool を公開する。candidate result の tool/ref 正本と source 固有 cache adapter を分離し、refine、cache index、session export、view export は同じ adapter を読む。論理 source は `ndl_digital`、取得経路と確認状態は `source_metadata` の provenance と browser observation に保持する。

**Tech Stack:** TypeScript 5.8、Zod 3、MCP SDK 1.30、Vitest 3、既存 file cache / session store

**Spec:** `docs/superpowers/specs/2026-09-05-ndl-browser-results-normalization-design.md`

## Global Constraints

- 公開 runtime はデジコレ画面内部 endpoint を利用しない。
- MCP server は Chrome、Browser、Playwright、Computer Use を起動しない。
- Cookie、session token、パスワード、利用者ID、氏名、画像、スクリーンショット、PDF本体・保存先 path を入力・cacheへ保存しない。
- browser item は最大100件、snippet は各 item 最大5件・各500文字、hit location は各 item 最大20件・各120文字とし、超過は切り捨てず validation error にする。
- viewer URL は HTTPS の `dl.ndl.go.jp` で、`/pid/<pid>` の PID と入力 `pid` が一致しなければならない。
- canonical ID は `source="ndl_digital"`、`source_id="R100000039-I<PID>"` とする。
- candidate-producing tool は `jp_lit_search`、`jp_lit_search_fulltext`、`jp_lit_record_ndl_browser_search` の3種類だけとする。
- 既存 tool 名、既存 search/fulltext output、`cache_key` / `cache_keys` selector、cache format version 1 は維持する。
- `source_record` が同じときだけ書誌 field と provenance を merge し、別 source の近似一致では field merge しない。
- package version は変更せず、push、Release、npm publish は行わない。

---

### Task 1: Candidate result の正本と source 固有 adapter

**Files:**
- Create: `src/lib/candidateResults.ts`
- Create: `src/lib/candidateResultAdapters.ts`
- Create: `tests/candidateResultAdapters.test.ts`
- Modify: `src/lib/persistence/cacheIdentity.ts`
- Modify: `docs/superpowers/specs/2026-09-05-ndl-browser-results-normalization-design.md`

**Interfaces:**
- Consumes: `FileCache.read<T>(tool, cacheKey)`、`searchOutputSchema`、`searchFulltextOutputSchema`、`searchItemSchema`、`normalizeIssuedAt()`、`ndlPidToDigitalSourceId()`。
- Produces: `CANDIDATE_RESULT_TOOLS`、`CandidateResultTool`、`candidateResultRefSchema`、`CandidateResultRef`、`CandidateResult`、`isCandidateResultTool()`、`normalizeCandidateResult()`、`readCandidateResult()`、`extractCandidateItems()`、`mergeSameSourceRecordItems()`。

- [x] **Step 1: source 固有 mapping と invalid payload の失敗テストを書く**

`tests/candidateResultAdapters.test.ts` に `jp_lit_search` と `jp_lit_search_fulltext` の cache payload を作り、次を固定する。

```ts
const normalized = normalizeCandidateResult(
  { tool: "jp_lit_search_fulltext", cache_key: fulltextKey },
  {
    keyword: "普通選挙法",
    searchfield: "contentonly",
    total: 1,
    from: 0,
    items: [{
      pid: "1907653",
      viewer_url: "https://dl.ndl.go.jp/pid/1907653",
      title: "帝国憲法大要",
      volume: null,
      responsibility: "斉藤隆夫 著",
      publisher: "憲政公論社",
      published: "大正15",
      publishyear: 1926,
      ndc: "323",
      bib_id: "000000000001",
      call_no: "特1-1",
      page_count: 123,
      is_classic: false,
      highlights: ["普通選挙法"]
    }],
    raw: {}
  }
);

expect(normalized).toMatchObject({
  ref: { tool: "jp_lit_search_fulltext", cache_key: fulltextKey },
  query: "普通選挙法",
  total: 1,
  source: "ndl_digital",
  items: [{
    source: "ndl_digital",
    source_id: "R100000039-I1907653",
    title: "帝国憲法大要",
    issued_at: "1926",
    source_metadata: {
      pid: "1907653",
      candidate_origins: ["next_digital_library_fulltext"]
    }
  }]
});
expect(() => normalizeCandidateResult(
  { tool: "jp_lit_search_fulltext", cache_key: fulltextKey },
  { keyword: "壊れたpayload", items: "not-an-array" }
)).toThrow(/invalid candidate cache payload/i);
```

- [x] **Step 2: adapter test を実行し、module 未実装の RED を確認する**

Run: `npx vitest run tests/candidateResultAdapters.test.ts`

Expected: FAIL with `Cannot find module '../src/lib/candidateResultAdapters.js'`。

- [x] **Step 3: dependency-free な tool/ref 正本を実装する**

`src/lib/candidateResults.ts` は schema 側から import できるよう、source 固有 schema を import しない。

```ts
import { z } from "zod";
import { cacheKeySchema } from "./persistence/cacheIdentity.js";

export const CANDIDATE_RESULT_TOOLS = [
  "jp_lit_search",
  "jp_lit_search_fulltext",
  "jp_lit_record_ndl_browser_search"
] as const;

export const candidateResultToolSchema = z.enum(CANDIDATE_RESULT_TOOLS);
export const candidateResultRefSchema = z.object({
  tool: candidateResultToolSchema,
  cache_key: cacheKeySchema
}).strict();

export type CandidateResultTool = typeof CANDIDATE_RESULT_TOOLS[number];
export type CandidateResultRef = z.infer<typeof candidateResultRefSchema>;

export function isCandidateResultTool(value: string): value is CandidateResultTool {
  return candidateResultToolSchema.safeParse(value).success;
}
```

`jp_lit_record_ndl_browser_search` を `CACHED_TOOL_NAMES` に追加し、cache inventory の allowlist に入れる。

- [x] **Step 4: search/fulltext adapter と provenance 付加を実装する**

`src/lib/candidateResultAdapters.ts` の公開契約を次に固定する。

```ts
export interface CandidateResult {
  ref: CandidateResultRef;
  query: string;
  total: number;
  source: SourceName | null;
  items: SearchItem[];
}

export function normalizeCandidateResult(
  ref: CandidateResultRef,
  structuredContent: unknown
): CandidateResult;

export async function readCandidateResult(
  cache: FileCache,
  ref: CandidateResultRef
): Promise<CandidateResult>;

export function extractCandidateItems(
  envelope: CacheEnvelope<unknown>
): SearchItem[] | null;

export interface CandidateItemWithTool {
  tool: CandidateResultTool;
  item: SearchItem;
}

export function mergeSameSourceRecordItems(
  entries: CandidateItemWithTool[]
): SearchItem;
```

`jp_lit_search` item には既存 `source_metadata` を保ったまま `candidate_origins: ["jp_lit_search"]` を加える。fulltext item は `pid` を canonical ID にし、`responsibility` を role=null の author、`publishyear` を優先して日付、`highlights` 等を `source_metadata.next_digital_library_fulltext` に保持する。schema parse に失敗した場合は `InvalidRequestError("invalid candidate cache payload: <tool>/<cache_key>")`、cache miss は `NotFoundError("candidate result cache not found: <tool>/<cache_key>")` とする。

- [x] **Step 5: 同一 source record の merge 契約テストと実装を追加する**

優先度を固定し、同じ PID の API/browser/fulltext item を入力順に依存せず一件へ統合する。

```ts
const merged = mergeSameSourceRecordItems([
  { tool: "jp_lit_search_fulltext", item: fulltextItem },
  { tool: "jp_lit_record_ndl_browser_search", item: browserItem },
  { tool: "jp_lit_search", item: apiItem }
]);

expect(merged.title).toBe(apiItem.title);
expect(merged.publisher).toBe(apiItem.publisher);
expect(merged.source_metadata).toMatchObject({
  candidate_origins: [
    "jp_lit_search",
    "ndl_digital_browser",
    "next_digital_library_fulltext"
  ]
});
expect(
  (merged.source_metadata?.browser_observations as unknown[]).length
).toBe(2);
```

scalar は tool 優先度 `jp_lit_search` → browser → fulltext の最初の非空値、配列は NFKC 正規化キーで union、availability は boolean OR、browser observations は安定 JSON key で重複除去し `checked_at` 昇順で全件保持する。

- [x] **Step 6: focused test を通してコミットする**

Run: `npx vitest run tests/candidateResultAdapters.test.ts tests/persistence/cacheRootBoundary.test.ts`

Expected: PASS。

```powershell
git add src/lib/candidateResults.ts src/lib/candidateResultAdapters.ts src/lib/persistence/cacheIdentity.ts tests/candidateResultAdapters.test.ts docs/superpowers/specs/2026-09-05-ndl-browser-results-normalization-design.md
git commit -m "feat: candidate result adapterを追加"
```

---

### Task 2: ブラウザ観測記録 schema と local-write tool

**Files:**
- Create: `src/tools/jpLitRecordNdlBrowserSearch.ts`
- Create: `tests/jpLitRecordNdlBrowserSearch.test.ts`
- Modify: `src/lib/schemas.ts`
- Modify: `src/lib/candidateResultAdapters.ts`

**Interfaces:**
- Consumes: Task 1 の `candidateResultRefSchema`、既存 `runCachedTool()`、`normalizeIssuedAt()`、`ndlPidToDigitalSourceId()`。
- Produces: `recordNdlBrowserSearchInputSchema`、`recordNdlBrowserSearchOutputSchema`、`RecordNdlBrowserSearchInput/Output`、`createJpLitRecordNdlBrowserSearchTool(cache, sessions)`、browser output adapter。

- [x] **Step 1: strict schema の正常系・negative matrix を書く**

`tests/jpLitRecordNdlBrowserSearch.test.ts` で、既存ログイン済み browser smoke を表す fixture を作る。

```ts
const OBSERVATION = {
  query: "普通選挙法",
  checked_at: "2026-09-05T12:00:00+09:00",
  login_state: "logged_in_existing_session",
  page: 1,
  reported_total: 1,
  total_relation: "reported_exact",
  filters: {
    access_scopes: ["transmission"],
    material_types: ["図書"],
    raw_labels: ["送信サービスで閲覧可能"]
  },
  items: [{
    pid: "1907653",
    title: "帝国憲法大要",
    volume: null,
    authors: ["斉藤隆夫"],
    publisher: "憲政公論社",
    published: "1926",
    viewer_url: "https://dl.ndl.go.jp/pid/1907653",
    access_scope: "individual_transmission",
    access_label: "個人送信で閲覧可能",
    snippets: [{ text: "普通選挙法", locator_type: "koma", locator: "67" }],
    item_fulltext_state: "searched",
    hit_locations: ["67–73コマ"],
    content_state: "page_image_checked",
    print_file_state: "dialog_available"
  }]
};
```

`http:`、別 host、PID 不一致、101 items、6 snippets、501文字 snippet、21 hit locations、121文字 location、未知 field `cookie`、`reported_total < items.length`、`reported_total=null` と exact の組合せをそれぞれ `safeParse(...).success === false` で固定する。

- [x] **Step 2: schema test を実行し RED を確認する**

Run: `npx vitest run tests/jpLitRecordNdlBrowserSearch.test.ts`

Expected: FAIL because schema/tool exports do not exist。

- [x] **Step 3: Zod schema と PID/URL cross-field validation を実装する**

全 object を `.strict()` にし、URL 検証は `new URL(viewer_url)` から protocol、hostname、pathname の PID を比較する。`checked_at` は offset 付き ISO 8601 を許可し、`Date.parse()` が有限であることも検証する。`reported_total` と `total_relation` は top-level `.superRefine()` で関係制約を検証する。

```ts
const viewer = new URL(item.viewer_url);
const pathPid = viewer.pathname.match(/^\/pid\/(\d+)(?:\/|$)/)?.[1];
if (viewer.protocol !== "https:" || viewer.hostname !== "dl.ndl.go.jp") {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["viewer_url"], message: "viewer_url must use https://dl.ndl.go.jp" });
}
if (pathPid !== item.pid) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["viewer_url"], message: "viewer_url PID must match pid" });
}
```

- [x] **Step 4: cache/session 保存と SearchItem mapping を実装する**

tool は `session_id` だけを cache key から除外し、`checked_at` を含む観測全体を `runCachedTool()` に渡す。output は `source="ndl_digital"`、`limit=100`、canonical source ID、`candidate_origins=["ndl_digital_browser"]` と次の observation を保持する。

```ts
source_metadata: {
  pid: item.pid,
  candidate_origins: ["ndl_digital_browser"],
  browser_observations: [{
    checked_at: parsed.checked_at,
    login_state: parsed.login_state,
    query: parsed.query,
    access_scope: item.access_scope,
    access_label: item.access_label,
    snippets: item.snippets,
    item_fulltext_state: item.item_fulltext_state,
    hit_locations: item.hit_locations,
    content_state: item.content_state,
    print_file_state: item.print_file_state
  }]
}
```

cache hit 時の `refresh_hint` は「同一観測の保存済み結果。再確認した場合は新しい `checked_at` で記録する」とし、upstream API や `force_refresh` に言及しない。

- [x] **Step 5: cache miss/hit、session entry、adapter round-trip test を通す**

```ts
const first = await tool({ session_id: session.session_id, ...OBSERVATION });
const second = await tool({ session_id: session.session_id, ...OBSERVATION });
expect(first.structuredContent.cache.hit).toBe(false);
expect(second.structuredContent.cache.hit).toBe(true);
expect(second.structuredContent.cache.cache_key).toBe(first.structuredContent.cache.cache_key);
expect((await sessions.readById(session.session_id)).entries).toHaveLength(2);
expect(first.structuredContent.items[0]).toMatchObject({
  source: "ndl_digital",
  source_id: "R100000039-I1907653"
});
```

Run: `npx vitest run tests/jpLitRecordNdlBrowserSearch.test.ts tests/candidateResultAdapters.test.ts`

Expected: PASS。

- [x] **Step 6: コミットする**

```powershell
git add src/lib/schemas.ts src/lib/candidateResultAdapters.ts src/tools/jpLitRecordNdlBrowserSearch.ts tests/jpLitRecordNdlBrowserSearch.test.ts tests/candidateResultAdapters.test.ts
git commit -m "feat: デジコレブラウザ観測を保存"
```

---

### Task 3: refine の result ref、三経路統合、同一 PID merge

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/tools/jpLitRefineResults.ts`
- Modify: `tests/explicitSessionSchemas.test.ts`
- Modify: `tests/jpLitRefineResults.test.ts`

**Interfaces:**
- Consumes: Task 1 の `CandidateResultRef`、`isCandidateResultTool()`、`readCandidateResult()`、`mergeSameSourceRecordItems()`。
- Produces: `result_ref` / `result_refs` selector、`base_result_ref` / `base_result_refs`、tool 付き `totals_by_base`、session 内三種類の candidate result 統合。

- [x] **Step 1: selector と additive output schema の失敗テストを書く**

```ts
expect(refineResultsInputSchema.safeParse({
  result_ref: { tool: "jp_lit_search_fulltext", cache_key: fulltextKey }
}).success).toBe(true);
expect(refineResultsInputSchema.safeParse({
  cache_key: searchKey,
  result_ref: { tool: "jp_lit_search", cache_key: searchKey }
}).success).toBe(false);
expect(refineResultsInputSchema.safeParse({
  result_ref: { tool: "jp_lit_get_record", cache_key: searchKey }
}).success).toBe(false);
```

既存 `cache_key` / `cache_keys` / `session_id` テストは変更せず通す。

- [x] **Step 2: schema focused test を実行し RED を確認する**

Run: `npx vitest run tests/explicitSessionSchemas.test.ts tests/jpLitRefineResults.test.ts`

Expected: new result-ref assertions FAIL。

- [x] **Step 3: selector 解決を cache key から result ref へ置き換える**

```ts
async function resolveBaseResultRefs(
  input: RefineInput,
  sessions: SessionStore
): Promise<CandidateResultRef[]> {
  if (input.result_refs) return uniqueRefs(input.result_refs);
  if (input.result_ref) return [input.result_ref];
  if (input.cache_keys) return uniqueRefs(input.cache_keys.map((cache_key) => ({ tool: "jp_lit_search", cache_key })));
  if (input.cache_key) return [{ tool: "jp_lit_search", cache_key: input.cache_key }];
  const session = await sessions.readById(input.session_id!);
  const refs = session.entries
    .filter((entry) => isCandidateResultTool(entry.tool))
    .map((entry) => ({ tool: entry.tool, cache_key: entry.cache_key }));
  if (refs.length === 0) throw new Error(`session_id=${input.session_id} に candidate result がありません`);
  return uniqueRefs(refs);
}
```

schema の selector 数は `cache_key`、`cache_keys`、`result_ref`、`result_refs`、`session_id` のちょうど一種類とする。

- [x] **Step 4: 三 tool の session fixture と canonical merge test を追加する**

同じ PID について API は正式タイトル・出版社、browser は access/snippet/state、fulltext は highlight を持つ fixture を書き、session selector の union が1件を返すことを固定する。

```ts
expect(result.structuredContent.base_result_refs).toEqual([
  { tool: "jp_lit_search", cache_key: searchKey },
  { tool: "jp_lit_search_fulltext", cache_key: fulltextKey },
  { tool: "jp_lit_record_ndl_browser_search", cache_key: browserKey }
]);
expect(result.structuredContent.totals_by_base).toEqual([
  { tool: "jp_lit_search", cache_key: searchKey, total: 1 },
  { tool: "jp_lit_search_fulltext", cache_key: fulltextKey, total: 1 },
  { tool: "jp_lit_record_ndl_browser_search", cache_key: browserKey, total: 1 }
]);
expect(result.structuredContent.items).toHaveLength(1);
expect(result.structuredContent.items[0].source_metadata).toMatchObject({
  candidate_origins: [
    "jp_lit_search",
    "ndl_digital_browser",
    "next_digital_library_fulltext"
  ]
});
```

- [x] **Step 5: combine を tool-aware item group へ変更する**

`source_record` の union/intersection では一致 group を `mergeSameSourceRecordItems()` へ渡す。`minus` は先頭 group の key から後続 group の key を除外する。`duplicate_key` / `title_author_year` は既存の集合判定と先頭 representative を維持し、別 source の field/provenance merge はしない。duplicate cluster 候補はこれまでどおり union 前の全 item から作る。

- [x] **Step 6: legacy と三経路 test を通してコミットする**

Run: `npx vitest run tests/explicitSessionSchemas.test.ts tests/jpLitRefineResults.test.ts`

Expected: PASS、既存テストを含む。

```powershell
git add src/lib/schemas.ts src/tools/jpLitRefineResults.ts tests/explicitSessionSchemas.test.ts tests/jpLitRefineResults.test.ts
git commit -m "feat: candidate resultsを統合整理"
```

---

### Task 4: tool-aware cache index

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/tools/jpLitSearchCacheIndex.ts`
- Modify: `tests/jpLitSearchCacheIndex.test.ts`

**Interfaces:**
- Consumes: `CANDIDATE_RESULT_TOOLS`、`isCandidateResultTool()`、`readCandidateResult()`。
- Produces: candidate cache 三種類の横断検索、top-level `result_refs`、各 item の `tool` / `result_ref`、互換 `cache_keys`。

- [x] **Step 1: browser/fulltext cache index の失敗テストを書く**

session に tool の異なる二つの result ref を保存し、browser query、fulltext title、canonical source ID が検索可能であることを固定する。

```ts
expect(result.structuredContent.result_refs).toEqual([
  { tool: "jp_lit_record_ndl_browser_search", cache_key: browserKey },
  { tool: "jp_lit_search_fulltext", cache_key: fulltextKey }
]);
expect(result.structuredContent.items[0]).toMatchObject({
  tool: "jp_lit_record_ndl_browser_search",
  result_ref: { tool: "jp_lit_record_ndl_browser_search", cache_key: browserKey },
  source: "ndl_digital"
});
```

- [x] **Step 2: focused test を実行し RED を確認する**

Run: `npx vitest run tests/jpLitSearchCacheIndex.test.ts`

Expected: browser/fulltext cache が結果に含まれず FAIL。

- [x] **Step 3: session/inventory/read の identity を tool+cache_key に変更する**

`Map<string, Set<string>>` の key は `${tool}:${cache_key}` とし、session entry は candidate-producing tool のみ登録する。inventory は次で集約する。

```ts
const inventories = await Promise.all(
  CANDIDATE_RESULT_TOOLS.map((tool) => listCacheInventory(baseDir, tool))
);
const inventoryItems = inventories.flatMap((inventory) => inventory.items);
```

各 envelope は `readCandidateResult()` で共通化してから query/source/issued filter と item match を適用する。current/legacy の同一 identity は current を優先する。

- [x] **Step 4: additive schema と互換 field を実装する**

```ts
result_refs: limited.map(({ tool, cache_key }) => ({ tool, cache_key })),
cache_keys: limited.map(({ cache_key }) => cache_key),
items: limited.map((item) => ({
  tool: item.tool,
  result_ref: { tool: item.tool, cache_key: item.cache_key },
  cache_key: item.cache_key,
  session_ids: item.session_ids,
  saved_at: item.saved_at,
  source: item.source,
  query_preview: item.query_preview,
  total: item.total,
  item_count: item.item_count,
  matched_fields: item.matched_fields
}))
```

- [x] **Step 5: index test を通してコミットする**

Run: `npx vitest run tests/jpLitSearchCacheIndex.test.ts tests/jpLitListCache.test.ts`

Expected: PASS。

```powershell
git add src/lib/schemas.ts src/tools/jpLitSearchCacheIndex.ts tests/jpLitSearchCacheIndex.test.ts
git commit -m "feat: candidate cacheを横断検索"
```

---

### Task 5: provenance を保つ view/session/CSL export

**Files:**
- Modify: `src/tools/jpLitExportView.ts`
- Modify: `src/lib/persistence/cslJson.ts`
- Modify: `src/lib/persistence/exportSession.ts`
- Modify: `tests/jpLitExportView.test.ts`
- Modify: `tests/jpLitExportSession.test.ts`

**Interfaces:**
- Consumes: Task 1 の `extractCandidateItems()`、Task 3 の `base_result_refs` と browser `source_metadata`。
- Produces: result refs を受ける refined export、browser acquisition/access/content/fulltext/print 表示、候補化済み fulltext/browser の session JSON/Markdown/CSL JSON export。

- [x] **Step 1: refined Markdown の browser provenance 失敗テストを書く**

browser observation を含む refined output を stub し、次の表示を固定する。

```ts
expect(written).toContain("Base result refs: jp_lit_record_ndl_browser_search/");
expect(written).toContain("Acquisition: デジコレ全文検索（ブラウザ）");
expect(written).toContain("Access: 個人送信で閲覧可能");
expect(written).toContain("Item fulltext: searched");
expect(written).toContain("Content: page_image_checked");
expect(written).toContain("Print PDF: dialog_available");
expect(written).toContain("Hit locations: 67–73コマ");
```

- [x] **Step 2: session fulltext normalization と CSL note の失敗テストを書く**

`jp_lit_search_fulltext` raw cache に canonical source ID の selected item を annotation した session を作り、selected/unselected export の item が `ndl_digital` book になることを確認する。browser cache の CSL note は selection note に加えて acquisition、checked_at、access scope、content/fulltext/print state を含める。

- [x] **Step 3: export focused test を実行し RED を確認する**

Run: `npx vitest run tests/jpLitExportView.test.ts tests/jpLitExportSession.test.ts`

Expected: provenance 行と fulltext canonical item が欠けて FAIL。

- [x] **Step 4: refined Markdown の latest observation rendering を実装する**

`browser_observations` は offset 表記の文字列順ではなく `checked_at` が表す実時刻の最大値を表示状態に使い、履歴自体は JSON output に残す。表示 helper は未知/欠落 metadata で例外を出さず、従来 item の表示を変えない。

```ts
const latest = latestBrowserObservation(browserObservations(item));
```

origin label は `jp_lit_search` → `NDL Search API`、`next_digital_library_fulltext` → `次世代デジタルライブラリー全文検索`、`ndl_digital_browser` → `デジコレ全文検索（ブラウザ）` とする。

- [x] **Step 5: session item extraction を candidate adapter に統一する**

`extractCslSourceItems()` と `extractUnselectedItems()` は envelope.tool が candidate-producing tool の場合に `extractCandidateItems(envelope)` を使う。それ以外の record/tool payload は既存 generic extraction を維持する。これにより fulltext raw item へ `source/source_id` を後付けせず、adapter だけで canonical 化する。

- [x] **Step 6: browser provenance を短い CSL note に追加する**

```text
source: ndl_digital
source_id: R100000039-I1907653
selection: strong_candidate
acquisition: ndl_digital_browser
browser checked_at: 2026-09-05T12:00:00+09:00
browser access: individual_transmission
browser evidence: item_fulltext=searched, content=page_image_checked, print=dialog_available
```

browser observation は CSL の title/author/publisher/issued へ混ぜず、note のみへ出す。

- [x] **Step 7: export test を通してコミットする**

Run: `npx vitest run tests/jpLitExportView.test.ts tests/jpLitExportSession.test.ts tests/jpLitExportSessionHistory.test.ts`

Expected: PASS。

```powershell
git add src/tools/jpLitExportView.ts src/lib/persistence/cslJson.ts src/lib/persistence/exportSession.ts tests/jpLitExportView.test.ts tests/jpLitExportSession.test.ts
git commit -m "feat: browser候補の来歴をexport"
```

---

### Task 6: MCP 登録、annotations、公開 package 契約

**Files:**
- Modify: `src/server.ts`
- Modify: `tests/smokeMcp.test.ts`
- Modify: `tests/toolDescriptionQuality.test.ts`
- Modify: `tests/packageDistribution.test.ts`

**Interfaces:**
- Consumes: Task 2 の schema/tool factory、既存 `LOCAL_WRITE_ANNOTATIONS`。
- Produces: 公開 tool `jp_lit_record_ndl_browser_search` と MCP manifest/schema/annotations。

- [x] **Step 1: manifest と annotation の失敗テストを書く**

```ts
const tool = tools.find((entry) => entry.name === "jp_lit_record_ndl_browser_search");
expect(tool).toBeDefined();
expect(tool?.annotations).toMatchObject({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false
});
expect(tool?.inputSchema.required).toEqual(expect.arrayContaining([
  "session_id", "query", "checked_at", "login_state", "page",
  "reported_total", "total_relation", "filters", "items"
]));
```

- [x] **Step 2: manifest test を実行し RED を確認する**

Run: `npx vitest run tests/smokeMcp.test.ts tests/toolDescriptionQuality.test.ts tests/packageDistribution.test.ts`

Expected: tool が manifest に無く FAIL。

- [x] **Step 3: factory 作成と registerTool を追加する**

tool description は次の意味を一文内に含める。

```text
local write。エージェントがデジコレ公式画面で観測した全文検索候補と閲覧・資料内検索・印刷用PDFの状態を検証してcache/sessionへ保存する。MCP自身はブラウザ操作・ログイン・外部通信を行わず、cookie、認証情報、画像、PDF本体・pathを受け取らない。保存後はjp_lit_refine_results、jp_lit_search_cache_index、jp_lit_annotate_session、jp_lit_export_view / jp_lit_export_sessionで通常候補と同様に扱う。
```

`createJpLitRecordNdlBrowserSearchTool(cache, sessions)` を search/fulltext tool と同じ shared cache/session で生成し、`LOCAL_WRITE_ANNOTATIONS` で登録する。既存 refine/cache index descriptions も三 candidate tool と result ref を説明する文面へ更新する。

- [x] **Step 4: package 境界 test を強化する**

既存内部 endpoint deny test を維持し、新 tool runtime が `playwright`、`chrome-launcher`、`puppeteer` へ依存しないこと、input schema の property 名に `cookie`、`password`、`session_token`、`user_id`、`user_name`、`pdf_path`、`screenshot`、`image` がないことを検査する。

- [x] **Step 5: MCP/package test を通してコミットする**

Run: `npx vitest run tests/smokeMcp.test.ts tests/toolDescriptionQuality.test.ts tests/packageDistribution.test.ts`

Expected: PASS。

```powershell
git add src/server.ts tests/smokeMcp.test.ts tests/toolDescriptionQuality.test.ts tests/packageDistribution.test.ts
git commit -m "feat: browser観測記録toolを公開"
```

---

### Task 7: 公開ドキュメントと jp-lit-research Skill

**Files:**
- Modify: `README.md`
- Modify: `docs/usage-guide.md`
- Modify: `docs/reference.md`
- Modify: `docs/project-status.md`
- Modify: `skills/jp-lit-research/SKILL.md`
- Modify: `skills/jp-lit-research/workflows/fulltext-page-lookup.md`
- Modify: `skills/jp-lit-research/reference/01-core-workflow.md`
- Modify: `skills/jp-lit-research/reference/03-evidence-and-output.md`
- Modify: `tests/skillGuide.test.ts`
- Modify: `tests/readmeLinks.test.ts`

**Interfaces:**
- Consumes: 完成した public tool/schema、設計の browser/login/access/PDF 状態境界。
- Produces: エージェント向け実行手順、ユーザー向け能力表、統合候補の表示契約、公開 reference。

- [x] **Step 1: `superpowers:writing-skills` を読み、Skill 編集 gate を適用する**

Run: `Get-Content C:\Users\itarun\.codex\plugins\cache\openai-curated-remote\superpowers\6.3.0\skills\writing-skills\SKILL.md`

Expected: Skill の test-first、router/reference 分離、検証要件を作業チェックリストへ反映する。

- [x] **Step 2: browser/API 境界と共通候補 UX の文書契約 test を先に書く**

`tests/skillGuide.test.ts` で次の必須語と禁止断定を検査する。

```ts
expect(skillAndReferences).toContain("jp_lit_record_ndl_browser_search");
expect(skillAndReferences).toContain("result_refs");
expect(skillAndReferences).toContain("logged_in_existing_session");
expect(skillAndReferences).toContain("page_image_checked");
expect(skillAndReferences).toContain("print_file_state");
expect(skillAndReferences).toContain("デジコレ本体の全文検索");
expect(skillAndReferences).toContain("次世代デジタルライブラリー");
expect(skillAndReferences).toContain("館内限定");
expect(skillAndReferences).not.toMatch(/jp_lit_search_fulltext[^\n]{0,80}デジコレ全資料/);
```

- [x] **Step 3: docs/Skill test を実行し RED を確認する**

Run: `npx vitest run tests/skillGuide.test.ts tests/readmeLinks.test.ts`

Expected: new tool/result ref/browser state の説明が足りず FAIL。

- [x] **Step 4: Skill router と fulltext workflow を更新する**

Skill は次の順序を明記する。

```text
1. 同じ session_id で公開 API 検索を行う。
2. デジコレ本体の全文検索範囲が必要なら、ユーザーが許可したブラウザで公式画面を検索する。
3. ログインは既存ログイン済み session だけを使い、認証情報入力・CAPTCHA回避をしない。
4. 観測値を jp_lit_record_ndl_browser_search で同じ session_id に保存する。
5. jp_lit_refine_results(session_id=...) で API/browser/fulltext 候補を統合する。
6. 候補一覧は分断せず、item ごとに発見経路、access、本文画像、資料内全文検索、印刷用PDF状態を示す。
```

「検索ヒット」「資料詳細」「本文画像確認」「PDF生成可能」「PDF生成済み」「保存済み」を別状態として扱い、ログインしても `ndl_onsite_only` を遠隔閲覧できないことを明記する。

- [x] **Step 5: README/usage/reference/project-status に能力表と呼び出し例を追加する**

能力表は次を含める。

| 経路 | 全文候補検索 | 送信資料ヒット | 本文画像確認 | PDF状態 | cache/session統合 |
|---|---|---|---|---|---|
| `jp_lit_search_fulltext` | 次世代収録範囲 | 網羅しない | 公開範囲のみ | 対象外 | 対応 |
| デジコレ公式画面 + record tool | 公式画面の範囲 | 検索は未ログインでも可 | 個人送信は既存ログインが必要 | 状態のみ記録 | 対応 |

公開例には browser 操作そのものではなく、観測後の record/refine/annotate/export の JSON 入力を掲載する。

- [x] **Step 6: docs/Skill test を通してコミットする**

Run: `npx vitest run tests/skillGuide.test.ts tests/readmeLinks.test.ts tests/installDocs.test.ts`

Expected: PASS。

```powershell
git add README.md docs/usage-guide.md docs/reference.md docs/project-status.md skills/jp-lit-research/SKILL.md skills/jp-lit-research/workflows/fulltext-page-lookup.md skills/jp-lit-research/reference/01-core-workflow.md skills/jp-lit-research/reference/03-evidence-and-output.md tests/skillGuide.test.ts tests/readmeLinks.test.ts
git commit -m "docs: デジコレブラウザ候補の運用を追加"
```

---

### Task 8: インストール済み Skill 同期と end-to-end 完了検証

**Files:**
- Modify mechanically: `C:\Users\itarun\.agents\skills\jp-lit-research\**`
- Modify mechanically: `C:\Users\itarun\.codex\skills\jp-lit-research\**`
- Modify: `docs/superpowers/plans/2026-09-05-ndl-browser-results-normalization.md`

**Interfaces:**
- Consumes: repo 内の完成済み Skill、全 runtime/tests/docs。
- Produces: `.agents` / `.codex` の同一内容、全 gate の fresh evidence、clean worktree、最終ローカルコミット。

- [x] **Step 1: repo 全体の fresh test/build gate を実行する**

Run:

```powershell
npm test
npm run build
npm run typecheck:scripts
npm run smoke:mcp:offline
git diff --check
```

Expected: 全 command exit 0。

- [x] **Step 2: package に禁止 runtime/secret field がないことを実 package 対象で確認する**

Run: `npx vitest run tests/packageDistribution.test.ts`

Expected: internal endpoint、browser runtime、credential/path input の境界 test が PASS。

- [x] **Step 3: `.agents` の Codex Skill を installer で更新する**

Run: `node scripts/install-skills.mjs codex`

Expected: `C:\Users\itarun\.agents\skills\jp-lit-research` と `jp-lit-verification` の更新先が表示され、exit 0。

- [x] **Step 4: adapter 済み Skill tree を `.codex` duplicate へ機械同期する**

`C:\Users\itarun\.agents\skills\jp-lit-research` の全ファイルを `C:\Users\itarun\.codex\skills\jp-lit-research` へ `Copy-Item -Recurse -Force` し、削除は行わない。

```powershell
Copy-Item -LiteralPath 'C:\Users\itarun\.agents\skills\jp-lit-research\*' -Destination 'C:\Users\itarun\.codex\skills\jp-lit-research' -Recurse -Force
```

PowerShell の `-LiteralPath` は wildcard を展開しないため、実行時は source directory の children を `Get-ChildItem -LiteralPath ...` で列挙し、各 child を `Copy-Item -LiteralPath $_.FullName` で destination へコピーする。

- [x] **Step 5: repo/installed Skill の意味内容 hash と必須文言を比較する**

Codex adapter が `.agents` / `.codex` の `SKILL.md` 先頭へ追加されるため、`SKILL.md` は adapter block と metadata を除いた body hash、reference/workflow は file hash を比較する。

```powershell
Get-FileHash skills\jp-lit-research\workflows\fulltext-page-lookup.md
Get-FileHash C:\Users\itarun\.agents\skills\jp-lit-research\workflows\fulltext-page-lookup.md
Get-FileHash C:\Users\itarun\.codex\skills\jp-lit-research\workflows\fulltext-page-lookup.md
rg -n 'jp_lit_record_ndl_browser_search|result_refs|logged_in_existing_session|print_file_state' skills\jp-lit-research C:\Users\itarun\.agents\skills\jp-lit-research C:\Users\itarun\.codex\skills\jp-lit-research
```

Expected: workflow/reference hash が3箇所で一致し、必須文言が3 tree 全てに存在する。repo `SKILL.md` body と installed `SKILL.md` body も adapter 除去後に一致する。

- [x] **Step 6: `superpowers:requesting-code-review` で仕様適合 review を行う**

review scope は設計 commit `9efab0e` から現在 HEAD までとし、内部API混入、認証情報 field、三経路 mapping、同一 PID merge、legacy selector、session/export、Skill同期を重点確認する。指摘があれば `superpowers:receiving-code-review` の検証手順で修正する。

実績: 全体 review の Important 2件（offset 付き観測日時の比較、三経路の NDL URL / identity 境界）と Minor 1件（snippet locator 契約）を `1301e12` で修正した。scoped re-review で見つかった WHATWG URL の制御文字正規化による迂回を `5976f4c` で閉じ、最終 scoped review は Critical / Important / Minor すべてなし、merge 可と判定した。

- [x] **Step 7: `superpowers:verification-before-completion` を読み、完了主張前に全 gate を再実行する**

Run:

```powershell
npm test
npm run build
npm run typecheck:scripts
npm run smoke:mcp:offline
git diff --check
git status --short --branch
```

Expected: 全 command exit 0、意図した plan checkbox 更新以外に未コミット変更なし。

実績: 2026-09-06 に最終 HEAD `5976f4c` と文書更新を含む状態で `npm test`（83 files / 903 tests）、build、script typecheck、offline MCP smoke、`git diff --check` を fresh 実行し、すべて exit 0。未コミット変更は本 plan と `docs/project-status.md` の完了記録だけだった。

- [x] **Step 8: plan を実績で更新し、最終コミットを作る**

全 checkbox を実行結果に合わせて `[x]` にし、未実行を成功扱いにしない。

```powershell
git add -f docs/superpowers/plans/2026-09-05-ndl-browser-results-normalization.md
git commit -m "chore: デジコレ候補統合を検証"
git status --short --branch
```

Expected: `main...origin/main [ahead N]` だけが表示され、working tree は clean。push、tag、publish は行わない。
