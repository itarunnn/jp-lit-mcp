# jp-lit-verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 他サービスや他セッションから貼り付けた文章に登場する日本語文献候補の実在性・書誌整合性を検証する `jp-lit-verification` Skill を追加する。

**Architecture:** `jp-lit-research` とは別 Skill として `skills/jp-lit-verification/` を新設し、同じ `ndl-jp-lit-mcp` を利用する。主入力は貼り付け文章とし、`ndl_search` を一次検証の第一関門に使う判定フロー、表形式の出力、`.cursor` 同期、インストーラー、README / usage guide 導線をまとめて整備する。

**Tech Stack:** Markdown Skills, Node.js install script (`scripts/install-skills.mjs`), Vitest, README / usage docs

---

## File Structure

- Create: `skills/jp-lit-verification/SKILL.md`
  - 新 Skill の frontmatter、trigger、基本原則、判定フロー、出力表
- Create: `skills/jp-lit-verification/heuristics/extraction-rules.md`
  - 文献候補の抽出ルール
- Create: `skills/jp-lit-verification/heuristics/classification-rules.md`
  - `実在確認済み / 部分一致 / 非実在の疑い / 混線の疑い` の判定基準
- Create: `skills/jp-lit-verification/heuristics/source-followup.md`
  - `ndl_search` 後に個別 source へ再確認する条件
- Create: `skills/jp-lit-verification/workflows/pasted-text-verification.md`
  - 貼り付け文章を検証する主 workflow
- Create: `.cursor/skills/jp-lit-verification/` 以下の mirror 一式
  - Cursor 自動検出用
- Modify: `scripts/install-skills.mjs`
  - `skills/` 配下の複数 Skill を Claude / Codex へコピーできるようにする
- Modify: `tests/skillsInstall.test.ts`
  - 新 Skill の public layout を検証
- Create: `tests/verificationSkillGuide.test.ts`
  - 新 Skill の主要文言を検証
- Modify: `README.md`
  - 新 Skill の存在、用途、起動語、`jp-lit-research` との違いを追記
- Modify: `docs/usage-guide.md`
  - `文献検証` モードの使い方を追記
- Modify: `docs/install/codex-app.md`
- Modify: `docs/install/codex-cli.md`
- Modify: `docs/install/cursor.md`
- Modify: `docs/install/claude-code.md`
  - 新 Skill も同梱されること、起動例を追加
- Modify: `tests/readmeLinks.test.ts`
  - 新しい導線の存在を必要なら検証

---

### Task 1: Skill 本体の骨組みを作る

**Files:**
- Create: `skills/jp-lit-verification/SKILL.md`
- Create: `skills/jp-lit-verification/heuristics/extraction-rules.md`
- Create: `skills/jp-lit-verification/heuristics/classification-rules.md`
- Create: `skills/jp-lit-verification/heuristics/source-followup.md`
- Create: `skills/jp-lit-verification/workflows/pasted-text-verification.md`
- Test: `tests/verificationSkillGuide.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("jp-lit-verification skill guide", () => {
  it("describes pasted-text bibliography verification", () => {
    const skill = readFileSync("skills/jp-lit-verification/SKILL.md", "utf8");
    expect(skill).toContain("文献検証");
    expect(skill).toContain("ndl_search");
    expect(skill).toContain("実在確認済み");
    expect(skill).toContain("混線の疑い");
    expect(skill).toContain("表");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/verificationSkillGuide.test.ts`
Expected: FAIL with `ENOENT` or missing-file assertion because `skills/jp-lit-verification/SKILL.md` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `skills/jp-lit-verification/SKILL.md`:

```md
---
name: jp-lit-verification
description: >-
  日本語文献の実在性調査スキル。貼り付けた文章に登場する日本語文献候補を抽出し、
  ndl_search を第一関門として、実在確認済み / 部分一致 / 非実在の疑い / 混線の疑い を根拠付きで判定する。
  「文献検証で」「文献実在性調査を始めます」「この文章に出てくる文献の実在性を確認して」などで使用する。
  一度発火したらセッション中は継続する。
---

# 日本語文献実在性調査スキル（jp-lit-verification）

## 原則

- 主入力は貼り付け文章
- 文献候補は広めに拾う
- 判定は厳しめに行う
- 主出力は表
- 各行に根拠付きの判定理由を必ず付ける

## フロー

1. 貼り付け文章を受け取る
2. 文献候補を抽出する
3. ndl_search で一次検証する
4. 必要なら個別 source で再確認する
5. 表で報告する

## 判定カテゴリ

- 実在確認済み
- 部分一致
- 非実在の疑い
- 混線の疑い

## 詳細リファレンス

- [workflows/pasted-text-verification.md](workflows/pasted-text-verification.md)
- [heuristics/extraction-rules.md](heuristics/extraction-rules.md)
- [heuristics/classification-rules.md](heuristics/classification-rules.md)
- [heuristics/source-followup.md](heuristics/source-followup.md)
```

Create `skills/jp-lit-verification/heuristics/extraction-rules.md`:

```md
# extraction-rules

- 『』や「」で囲まれた文献名らしい表現を拾う
- 著者名 + 年 + タイトル断片を拾う
- 雑誌名 + 巻号 + ページを拾う
- 作品名か文献名か曖昧なものも一旦候補として保持する
```

Create `skills/jp-lit-verification/heuristics/classification-rules.md`:

```md
# classification-rules

- 実在確認済み: ndl_search で強い一致
- 部分一致: いくつか一致するが確定できない
- 非実在の疑い: 有力候補なし
- 混線の疑い: 複数文献の要素が混ざっている
```

Create `skills/jp-lit-verification/heuristics/source-followup.md`:

```md
# source-followup

- 図書: ndl_catalog / cinii_books
- 論文: cinii_articles / jstage_articles / ndl_articles
- 一次資料: ndl_digital
```

Create `skills/jp-lit-verification/workflows/pasted-text-verification.md`:

```md
# pasted-text-verification

1. 文章を受け取る
2. 候補を抽出する
3. ndl_search で一次検証する
4. 判定表を作る
```
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/verificationSkillGuide.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/verificationSkillGuide.test.ts skills/jp-lit-verification
git commit -m "feat: scaffold jp-lit verification skill"
```

### Task 2: 判定理由と表出力ルールを詳細化する

**Files:**
- Modify: `skills/jp-lit-verification/SKILL.md`
- Modify: `skills/jp-lit-verification/heuristics/classification-rules.md`
- Modify: `skills/jp-lit-verification/workflows/pasted-text-verification.md`
- Test: `tests/verificationSkillGuide.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/verificationSkillGuide.test.ts`:

```ts
it("requires detailed reasons and a main table plus weak-candidate section", () => {
  const skill = readFileSync("skills/jp-lit-verification/SKILL.md", "utf8");
  expect(skill).toContain("判定理由");
  expect(skill).toContain("文献候補として弱い抽出");
  expect(skill).toContain("一致した根拠");
  expect(skill).toContain("不一致点");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/verificationSkillGuide.test.ts`
Expected: FAIL because the new strings are not present yet.

- [ ] **Step 3: Write minimal implementation**

Update `skills/jp-lit-verification/SKILL.md` with:

```md
## 出力

主出力は表にする。

| 抽出文献 | 推定タイプ | 検証結果 | 判定理由 | 一致した根拠 | 不一致点 | 確認候補 | 次の手 |
|----------|------------|----------|----------|--------------|----------|----------|--------|

別枠:

## 文献候補として弱い抽出

- 情報が少なすぎる
- 作品名か文献名か判別しにくい
```

Update `skills/jp-lit-verification/heuristics/classification-rules.md` with:

```md
# classification-rules

## 実在確認済み

- ndl_search でタイトル・著者・年などが 2〜3 項目一致
- 競合候補がない

## 部分一致

- タイトルは近いが他要素が弱い

## 非実在の疑い

- 一致候補が見つからない

## 混線の疑い

- タイトルと著者・年が別候補に割れる

## 判定理由

各行では必ず:
- 何が一致したか
- 何が一致しなかったか
- なぜその判定にしたか
- 次に何を確認すべきか
を文章で説明する
```

Update `skills/jp-lit-verification/workflows/pasted-text-verification.md` with:

```md
## 出力手順

1. 主表を作る
2. 判定理由を各行に丁寧に書く
3. 弱い候補は別枠へ回す
```
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/verificationSkillGuide.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/verificationSkillGuide.test.ts skills/jp-lit-verification
git commit -m "feat: define verification classification output"
```

### Task 3: `ndl_search` 一次検証と個別 source 再確認のルールを明確化する

**Files:**
- Modify: `skills/jp-lit-verification/SKILL.md`
- Modify: `skills/jp-lit-verification/heuristics/source-followup.md`
- Modify: `skills/jp-lit-verification/workflows/pasted-text-verification.md`
- Test: `tests/verificationSkillGuide.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/verificationSkillGuide.test.ts`:

```ts
it("uses ndl_search as the first verification gate and source-specific follow-up only when needed", () => {
  const skill = readFileSync("skills/jp-lit-verification/SKILL.md", "utf8");
  expect(skill).toContain("jp_lit_search(source=ndl_search");
  expect(skill).toContain("必要なら個別 source で再確認");
  expect(skill).toContain("cinii_articles");
  expect(skill).toContain("ndl_catalog");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/verificationSkillGuide.test.ts`
Expected: FAIL because these exact verification-flow strings are not fully present yet.

- [ ] **Step 3: Write minimal implementation**

Update `skills/jp-lit-verification/SKILL.md` with:

```md
## 利用ツール

- 一次検証:
  - `jp_lit_search(source=ndl_search, query=...)`
- 必要なら個別 source で再確認:
  - 図書: `ndl_catalog` / `cinii_books`
  - 論文: `cinii_articles` / `jstage_articles` / `ndl_articles`
  - 一次資料: `ndl_digital`
```

Update `skills/jp-lit-verification/heuristics/source-followup.md` with:

```md
# source-followup

## 基本原則

- まず ndl_search を使う
- `部分一致` / `混線の疑い` / 再検索価値の高い `非実在の疑い` だけ個別 source に進む

## 個別 source

- 図書: ndl_catalog / cinii_books
- 論文: cinii_articles / jstage_articles / ndl_articles
- 一次資料: ndl_digital
```

Update `skills/jp-lit-verification/workflows/pasted-text-verification.md` with:

```md
## 検証フロー

1. 文献候補を抽出
2. `jp_lit_search(source=ndl_search, query=...)` で一次検証
3. 必要候補だけ個別 source で再確認
4. 判定表を作る
```
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/verificationSkillGuide.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/verificationSkillGuide.test.ts skills/jp-lit-verification
git commit -m "feat: document verification search flow"
```

### Task 4: `.cursor` mirror を追加する

**Files:**
- Create: `.cursor/skills/jp-lit-verification/SKILL.md`
- Create: `.cursor/skills/jp-lit-verification/heuristics/extraction-rules.md`
- Create: `.cursor/skills/jp-lit-verification/heuristics/classification-rules.md`
- Create: `.cursor/skills/jp-lit-verification/heuristics/source-followup.md`
- Create: `.cursor/skills/jp-lit-verification/workflows/pasted-text-verification.md`
- Test: `tests/skillsInstall.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/skillsInstall.test.ts`:

```ts
it("ships jp-lit-verification under skills/", () => {
  expect(existsSync("skills/jp-lit-verification/SKILL.md")).toBe(true);
  expect(
    existsSync("skills/jp-lit-verification/workflows/pasted-text-verification.md")
  ).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/skillsInstall.test.ts`
Expected: FAIL until the new public skill directory exists and is complete.

- [ ] **Step 3: Write minimal implementation**

Mirror the public files into `.cursor/skills/jp-lit-verification/`.

Expected directory shape:

```text
.cursor/skills/jp-lit-verification/
  SKILL.md
  heuristics/
    extraction-rules.md
    classification-rules.md
    source-followup.md
  workflows/
    pasted-text-verification.md
```
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/skillsInstall.test.ts tests/verificationSkillGuide.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .cursor/skills/jp-lit-verification tests/skillsInstall.test.ts
git commit -m "feat: add cursor mirror for verification skill"
```

### Task 5: インストーラーを複数 Skill 対応にする

**Files:**
- Modify: `scripts/install-skills.mjs`
- Modify: `tests/skillsInstall.test.ts`
- Modify: `tests/installScriptsOutput.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/skillsInstall.test.ts`:

```ts
it("copies from the public skills directory rather than a single hardcoded skill", () => {
  const script = readFileSync("scripts/install-skills.mjs", "utf8");
  expect(script).toContain('join(repoRoot, "skills")');
  expect(script).toContain("jp-lit-verification");
});
```

Append to `tests/installScriptsOutput.test.ts`:

```ts
expect(js).toContain("jp-lit-verification");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/skillsInstall.test.ts tests/installScriptsOutput.test.ts`
Expected: FAIL because `install-skills.mjs` is still hardcoded to `jp-lit-research`.

- [ ] **Step 3: Write minimal implementation**

Refactor `scripts/install-skills.mjs` to enumerate skills under `skills/`:

```js
const skillsRoot = join(repoRoot, "skills");
const skillNames = ["jp-lit-research", "jp-lit-verification"];
```

Replace single-skill copy with:

```js
function copySkillTree(skillName, destinationRoot) {
  const skillSrc = join(skillsRoot, skillName);
  const destination = join(destinationRoot, skillName);
  mkdirSync(dirname(destination), { recursive: true });
  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true });
  }
  cpSync(skillSrc, destination, { recursive: true });
  return destination;
}
```

Update destination install loops:

```js
for (const skillName of skillNames) {
  const destination = copySkillTree(skillName, join(home, ".claude", "skills"));
  console.log(`[claude] ${destination}`);
}
```

Do the same for Codex and patch the adapter only for `jp-lit-research` if needed, or add a generic adapter block to any copied skill that lacks one.

Update banner text:

```js
console.log("Codex / Claude Code 向け jp-lit Skills インストーラー");
console.log(`source: ${skillsRoot}`);
console.log(`skills: ${skillNames.join(", ")}`);
```
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/skillsInstall.test.ts tests/installScriptsOutput.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/install-skills.mjs tests/skillsInstall.test.ts tests/installScriptsOutput.test.ts
git commit -m "feat: install multiple jp-lit skills"
```

### Task 6: README に新 Skill の導線を追加する

**Files:**
- Modify: `README.md`
- Modify: `tests/readmeLinks.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/readmeLinks.test.ts`:

```ts
it("mentions the jp-lit verification skill and its role", () => {
  const readme = readFileSync("README.md", "utf8");
  expect(readme).toContain("jp-lit-verification");
  expect(readme).toContain("文献検証");
  expect(readme).toContain("実在性");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/readmeLinks.test.ts`
Expected: FAIL because README does not mention the new Skill yet.

- [ ] **Step 3: Write minimal implementation**

Add a short subsection under the Skill area in `README.md`:

```md
### 追加 Skill: jp-lit-verification

`jp-lit-verification` は、貼り付けた文章に出てくる日本語文献候補の実在性を検証するための Skill です。

- 主入力: 他サービスや他セッションの回答文
- 一次検証: `jp_lit_search(source=ndl_search, ...)`
- 主出力: 判定表
- 判定カテゴリ: `実在確認済み` / `部分一致` / `非実在の疑い` / `混線の疑い`
```
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/readmeLinks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md tests/readmeLinks.test.ts
git commit -m "docs: add verification skill to readme"
```

### Task 7: usage guide と install docs に起動例を追加する

**Files:**
- Modify: `docs/usage-guide.md`
- Modify: `docs/install/codex-app.md`
- Modify: `docs/install/codex-cli.md`
- Modify: `docs/install/cursor.md`
- Modify: `docs/install/claude-code.md`
- Modify: `tests/installDocs.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/installDocs.test.ts`:

```ts
it("mentions verification-mode examples in install and usage docs", () => {
  const usage = readFileSync("docs/usage-guide.md", "utf8");
  expect(usage).toContain("文献検証");
  expect(usage).toContain("この文章に出てくる文献の実在性");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/installDocs.test.ts`
Expected: FAIL because usage guide does not yet contain verification-mode guidance.

- [ ] **Step 3: Write minimal implementation**

Add to `docs/usage-guide.md`:

```md
## 文献検証モード

他サービスの返答や他セッションの出力を貼り付けて、そこに出てくる日本語文献の実在性を検証できます。

```text
文献検証で、この文章に出てくる文献の実在性を確認してください。
```
```

Add to each install doc a second starter phrase:

```text
文献検証で、この文章に出てくる文献の実在性を確認してください。
```
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/installDocs.test.ts tests/readmeLinks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/usage-guide.md docs/install/codex-app.md docs/install/codex-cli.md docs/install/cursor.md docs/install/claude-code.md tests/installDocs.test.ts
git commit -m "docs: add verification mode usage examples"
```

### Task 8: フル回帰を確認する

**Files:**
- Modify: none
- Test: `tests/verificationSkillGuide.test.ts`
- Test: `tests/skillsInstall.test.ts`
- Test: `tests/installScriptsOutput.test.ts`
- Test: `tests/readmeLinks.test.ts`
- Test: `tests/installDocs.test.ts`

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm test -- tests/verificationSkillGuide.test.ts tests/skillsInstall.test.ts tests/installScriptsOutput.test.ts tests/readmeLinks.test.ts tests/installDocs.test.ts
```

Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS with no new failures

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: successful TypeScript build

- [ ] **Step 4: Commit verification note**

```bash
git status --short
```

Expected: clean working tree

---

## Self-Review

### Spec coverage

- Separate Skill from `jp-lit-research`: covered by Tasks 1, 4
- Pasted-text primary input: covered by Tasks 1, 2, 3
- `ndl_search` first-pass verification: covered by Task 3
- Four classification buckets: covered by Task 2
- Detailed reasons in table output: covered by Task 2
- Weak-candidate side section: covered by Task 2
- Installer and docs integration: covered by Tasks 5, 6, 7

### Placeholder scan

- No `TBD` / `TODO`
- Every task has file paths, commands, and concrete content

### Type consistency

- Skill name is consistently `jp-lit-verification`
- Public and `.cursor` directories use the same paths
- Output categories consistently use:
  - `実在確認済み`
  - `部分一致`
  - `非実在の疑い`
  - `混線の疑い`

---

Plan complete and saved to `docs/superpowers/plans/2026-04-30-jp-lit-verification-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

