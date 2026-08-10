# 速報Web発見証拠 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存のWeb補助確認で見つけた速報性の高い投稿を、典拠ではなく調査の発端として同じ `session_id` の evidence traceへ構造化保存できるようにする。

**Architecture:** 既存 `EvidenceRef` を従来形式と `agent_web` 形式のunionへ拡張し、保存は既存 `jp_lit_update_session_trace` / `jp_lit_annotate_session` を使う。Markdown exportは追加metadataを表示し、Skillは既存Web補助確認の条件付き分岐として専用runbookへ誘導する。新しいMCP tool、Yahoo adapter、Web取得コードは追加しない。

**Tech Stack:** TypeScript 5.8、Zod 3、Vitest 3、Markdown Skill/docs

## Global Constraints

- `evidence_type` は `agent_web`、`stability` は `ephemeral` の固定値とする。
- `agent_web` recordでは検索サービス、検索語、投稿URL、投稿日時、投稿者、確認日時、1件以上のリンク先URLを必須にする。
- Web投稿だけで書誌的事実、真偽、学術的評価を確定しない。
- 既存 `EvidenceRef` と保存済みsession JSONはmigrationなしで読み続ける。
- `session_id`、`cache_key`、MCP transport stateの責務を混同しない。
- 新しいMCP tool、Yahoo adapter、スクレイパー、継続監視、package version bumpは対象外とする。

---

## File Structure

- Modify `src/lib/persistence/types.ts`: persisted `AgentWebEvidenceRef` と後方互換unionを定義する。
- Modify `src/lib/schemas.ts`: 従来形式または完全な `agent_web` recordだけを受理する。
- Modify `src/lib/persistence/exportSession.ts`: `agent_web` metadataをMarkdownへ表示する。
- Modify `tests/jpLitUpdateSessionTrace.test.ts`: schema、tool、session保存の統合契約を検証する。
- Modify `tests/jpLitExportSession.test.ts`: Markdown exportの利用者向け出力を検証する。
- Modify `tests/skillGuide.test.ts`: Skillからrunbookへのroutingと証拠境界を固定する。
- Modify `skills/jp-lit-research/SKILL.md`: 既存Web補助確認の条件付き分岐を短く追加する。
- Create `skills/jp-lit-research/reference/04-ephemeral-web-discovery.md`: 速報Web発見runbookと入力例を提供する。
- Modify `skills/jp-lit-research/reference/03-evidence-and-output.md`: evidence layerとtrace配置を説明する。
- Modify `docs/reference.md`: 公開tool schemaの追加fieldを説明する。
- Modify `docs/usage-guide.md`: 発見から正式確認までの利用例を示す。
- Modify `docs/project-status.md`: 未リリース機能として実装範囲と境界を記録する。

### Task 1: `agent_web` evidenceのschemaとsession保存

**Files:**
- Modify: `tests/jpLitUpdateSessionTrace.test.ts`
- Modify: `src/lib/persistence/types.ts`
- Modify: `src/lib/schemas.ts`

**Interfaces:**
- Consumes: 既存 `EvidenceRef`、`updateSessionTraceInputSchema`、`SessionStore.updateTrace(input, session_id)`。
- Produces: `AgentWebEvidenceRef` と `EvidenceRef = LegacyEvidenceRef | AgentWebEvidenceRef`。`agent_web` は `evidence_type`, `stability`, `discovery_source`, `query`, `url`, `author`, `published_at`, `checked_at`, `linked_urls` を必須にする。

- [ ] **Step 1: 完全な速報Web recordがsessionへ保存される失敗testを書く**

`tests/jpLitUpdateSessionTrace.test.ts` に、既存toolへ次の `next_actions` を渡し、保存済みsessionのliteral値を検証するtestを追加する。

```ts
const evidence = {
  evidence_type: "agent_web" as const,
  stability: "ephemeral" as const,
  discovery_source: "Yahoo!リアルタイム検索",
  query: "河野有理 McMullen Nakai",
  url: "https://search.yahoo.co.jp/realtime/example-post",
  author: "河野有理",
  published_at: "2026-08-10T09:00:00+09:00",
  checked_at: "2026-08-10T10:00:00+09:00",
  linked_urls: ["https://example.org/review"],
  quote_or_summary: "書評と掲載誌情報へ進む発見経路"
};
```

期待値は `session.trace?.next_actions[0]?.evidence_refs?.[0]` が上記literalと一致すること。

- [ ] **Step 2: testを実行してREDを確認する**

Run: `npm exec -- vitest run tests/jpLitUpdateSessionTrace.test.ts`

Expected: Zodのstrict schemaが `evidence_type` など未定義fieldを拒否してFAILする。

- [ ] **Step 3: 不完全recordの拒否とlegacy互換の失敗testを追加する**

同じtest fileで以下を表形式に検証する。

```ts
it.each([
  ["missing author", { author: undefined }],
  ["wrong stability", { stability: "stable" }],
  ["invalid published_at", { published_at: "yesterday" }],
  ["invalid post url", { url: "not-a-url" }],
  ["empty linked_urls", { linked_urls: [] }]
])("rejects incomplete agent_web evidence: %s", async (_name, patch) => {
  // complete evidenceへpatchを重ね、tool callがrejectすることを確認する
});
```

既存形式 `{ url: "https://example.org/official", quote_or_summary: "公式確認先" }` は引き続き受理・保存されることも検証する。

- [ ] **Step 4: persisted typeとZod unionを最小実装する**

`src/lib/persistence/types.ts` で共通fieldを分け、`AgentWebEvidenceRef` を追加する。

```ts
export interface AgentWebEvidenceRef {
  evidence_type: "agent_web";
  stability: "ephemeral";
  discovery_source: string;
  query: string;
  url: string;
  author: string;
  published_at: string;
  checked_at: string;
  linked_urls: string[];
  quote_or_summary?: string;
}
```

`src/lib/schemas.ts` では従来schemaと次のstrict schemaを `z.union` で結ぶ。

```ts
const agentWebEvidenceRefSchema = z.object({
  evidence_type: z.literal("agent_web"),
  stability: z.literal("ephemeral"),
  discovery_source: z.string().trim().min(1),
  query: z.string().trim().min(1),
  url: z.string().url(),
  author: z.string().trim().min(1),
  published_at: z.string().datetime({ offset: true }),
  checked_at: z.string().datetime({ offset: true }),
  linked_urls: z.array(z.string().url()).min(1),
  quote_or_summary: z.string().trim().min(1).optional()
}).strict();
```

Legacy branchは速報Web専用fieldを受け付けない既存strict schemaのままにする。

- [ ] **Step 5: Task 1 testをGREENにする**

Run: `npm exec -- vitest run tests/jpLitUpdateSessionTrace.test.ts`

Expected: PASS。完全recordを保存し、不完全recordを拒否し、legacy recordを保存する。

- [ ] **Step 6: Task 1をコミットする**

```powershell
git add src/lib/persistence/types.ts src/lib/schemas.ts tests/jpLitUpdateSessionTrace.test.ts
git commit -m "feat: record ephemeral web discovery evidence"
```

### Task 2: Markdown exportへ速報Webの由来を表示

**Files:**
- Modify: `tests/jpLitExportSession.test.ts`
- Modify: `src/lib/persistence/exportSession.ts`

**Interfaces:**
- Consumes: Task 1の `EvidenceRef` unionと、既存 `renderEvidenceRefs()`。
- Produces: `agent_web` recordの全必須metadataとリンク先を含むMarkdown行。既存evidence表示は変えない。

- [ ] **Step 1: exportの失敗testを書く**

`tests/jpLitExportSession.test.ts` で `next_actions[].evidence_refs` にTask 1と同じliteralを保存してfull-log Markdownをexportし、次を確認する。

```ts
expect(written).toContain("agent_web / ephemeral");
expect(written).toContain("Yahoo!リアルタイム検索");
expect(written).toContain("河野有理 McMullen Nakai");
expect(written).toContain("河野有理");
expect(written).toContain("2026-08-10T09:00:00+09:00");
expect(written).toContain("2026-08-10T10:00:00+09:00");
expect(written).toContain("https://search.yahoo.co.jp/realtime/example-post");
expect(written).toContain("https://example.org/review");
```

- [ ] **Step 2: export testを実行してREDを確認する**

Run: `npm exec -- vitest run tests/jpLitExportSession.test.ts`

Expected: 保存自体は通るが、既存rendererが新metadataを出さないためFAILする。

- [ ] **Step 3: union-aware rendererを最小実装する**

`renderEvidenceRefs` の引数型を `EvidenceRef[]` にし、`ref.evidence_type === "agent_web"` の場合は次の順序で表示する。

```text
agent_web / ephemeral | Yahoo!リアルタイム検索 | query: ... | author: ... | published_at: ... | checked_at: ... | post: ... | linked: ... | summary
```

legacy branchの表示順と文字列は変更しない。

- [ ] **Step 4: Task 2 testをGREENにする**

Run: `npm exec -- vitest run tests/jpLitExportSession.test.ts`

Expected: PASS。

- [ ] **Step 5: Task 2をコミットする**

```powershell
git add src/lib/persistence/exportSession.ts tests/jpLitExportSession.test.ts
git commit -m "feat: export web discovery provenance"
```

### Task 3: Skillの速報Web分岐とrunbook

**Files:**
- Modify: `tests/skillGuide.test.ts`
- Modify: `skills/jp-lit-research/SKILL.md`
- Create: `skills/jp-lit-research/reference/04-ephemeral-web-discovery.md`
- Modify: `skills/jp-lit-research/reference/03-evidence-and-output.md`

**Interfaces:**
- Consumes: Task 1の `agent_web` evidence contractと既存Web補助確認方針。
- Produces: 刊行直後の反応等でだけ発火する条件付きrouting、保存例、正式sourceへの裏取り、停止境界。

- [ ] **Step 1: Skill contractの失敗testを書く**

`tests/skillGuide.test.ts` でSkillと新runbookを読み、次の契約を確認する。

- Skillが `reference/04-ephemeral-web-discovery.md` へ直接routingする。
- 速報Web検索を「既存のWeb補助確認」と明記する。
- runbookが `agent_web` / `ephemeral`、投稿URL、投稿日時、投稿者、検索語、確認日時、リンク先を要求する。
- runbookが出版社、雑誌、NDL、CiNii等での正式確認を要求する。
- runbookが投稿を書誌的事実・真偽・学術的評価の確証にしない。
- runbookが新規MCP tool、Yahoo adapter、スクレイピング、継続監視を対象外にする。

- [ ] **Step 2: Skill testを実行してREDを確認する**

Run: `npm exec -- vitest run tests/skillGuide.test.ts`

Expected: runbookが存在せず、routing契約もないためFAILする。

- [ ] **Step 3: Skillとrunbookを最小実装する**

`SKILL.md` の既存Web補助確認規則に、次の条件付き分岐を1段落だけ追加する。

```md
刊行直後の反応、論争、イベント、未発表資料への言及が調査の発端として有効な場合は、既存Web補助確認の速報Web分岐として `reference/04-ephemeral-web-discovery.md` を読む。
```

新runbookには「使用条件」「保存contractとJSON例」「正式確認」「失敗・停止」の4節を置く。JSON例はTask 1のliteral field名と一致させる。

`reference/03-evidence-and-output.md` には、`agent_web` が調査経路の証拠であり、bibliographic/fulltext evidenceではないことと、通常は `next_actions` または `open_questions` に置くことを追記する。

- [ ] **Step 4: Skill validationとtestをGREENにする**

Run:

```powershell
npm exec -- vitest run tests/skillGuide.test.ts
uv run --with pyyaml python C:\Users\itarun\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills/jp-lit-research
```

Expected: 両方PASS。

- [ ] **Step 5: Task 3をコミットする**

```powershell
git add skills/jp-lit-research/SKILL.md skills/jp-lit-research/reference/03-evidence-and-output.md skills/jp-lit-research/reference/04-ephemeral-web-discovery.md tests/skillGuide.test.ts
git commit -m "docs: add ephemeral web discovery runbook"
```

### Task 4: 公開docsとproject handoff

**Files:**
- Modify: `docs/reference.md`
- Modify: `docs/usage-guide.md`
- Modify: `docs/project-status.md`

**Interfaces:**
- Consumes: Tasks 1-3のfield名、保存先、証拠境界。
- Produces: MCP利用者向けschema表、発見から正式確認までの例、未リリース状態のhandoff。

- [ ] **Step 1: `docs/reference.md` を更新する**

`jp_lit_update_session_trace` / evidence refsの説明に、従来形式と `agent_web` 形式の違い、必須field、`checked_at` と親 `created_at` の違いを追記する。

- [ ] **Step 2: `docs/usage-guide.md` を更新する**

Yahoo!リアルタイム検索で投稿を発見し、リンク先の書評・掲載情報を出版社、雑誌、NDL、CiNii等で確認する短い例を追加する。投稿由来の発見と正式確認済みの主張を別段落にする。

- [ ] **Step 3: `docs/project-status.md` を更新する**

未リリース変更として、既存Web補助確認への `agent_web` / `ephemeral` evidence追加、新規tool/adapterなし、正式sourceでの裏取り必須を記録する。公開ツール数は変更しない。

- [ ] **Step 4: docs整合性を検証する**

Run:

```powershell
npm exec -- vitest run tests/skillGuide.test.ts tests/readmeLinks.test.ts
npm run build
```

Expected: PASS。

- [ ] **Step 5: Task 4をコミットする**

```powershell
git add docs/reference.md docs/usage-guide.md docs/project-status.md
git commit -m "docs: document ephemeral web evidence"
```

### Task 5: 全体検証と完了レビュー

**Files:**
- Verify all modified files

**Interfaces:**
- Consumes: Tasks 1-4の実装とdocs。
- Produces: build済み配布物、全test成功、offline MCP互換性、clean diff。

- [ ] **Step 1: targeted testsを再実行する**

Run:

```powershell
npm exec -- vitest run tests/jpLitUpdateSessionTrace.test.ts tests/jpLitExportSession.test.ts tests/skillGuide.test.ts tests/readmeLinks.test.ts
```

Expected: PASS、0 failures。

- [ ] **Step 2: buildとscript typecheckを実行する**

Run:

```powershell
npm run build
npm run typecheck:scripts
```

Expected: 両方exit 0。

- [ ] **Step 3: offline smokeとfull suiteを実行する**

Run:

```powershell
npm run smoke:mcp:offline
npm test
```

Expected: 両方exit 0、full suiteは0 failures。

- [ ] **Step 4: package/差分境界を確認する**

Run:

```powershell
npm pack --dry-run
git diff --check HEAD~4..HEAD
git status --short
```

Expected: Skill runbookがpackageへ含まれ、`plans/`、内部spec、exports、`CONCERNS.md`はpackageへ含まれない。意図しない差分がない。

- [ ] **Step 5: 設計要件を1項目ずつ照合する**

確認項目:

- 既存Web補助確認の拡張であり、新しいWeb検索レーンとして独立させていない。
- 投稿は調査の発端で、正式sourceが各主張の根拠になる。
- 既存sessionとlegacy evidenceが互換。
- 新しいMCP tool / adapter / scraperがない。
- `session_id` / `cache_key` / transport stateの境界がdocsに残る。

- [ ] **Step 6: 完了状態をコミットする**

未コミットの検証由来変更がある場合だけ対象fileをstageし、`chore: complete ephemeral web evidence integration` でコミットする。変更がなければ空commitは作らない。
