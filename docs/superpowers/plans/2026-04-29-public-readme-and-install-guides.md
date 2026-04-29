# Public README And Install Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ndl-jp-lit-mcp` を、文系ユーザーでも導入しやすい公開向けリポジトリ構成に整え、`Codex App` / `Codex CLI` / `Cursor` / `Claude Code` ごとの導入手順を明確化する

**Architecture:** トップレベル `README.md` は「アプリ別に入口を選ぶ」導線へ再構成し、詳細な導入手順は `docs/install/` に分割する。Skill は公開用の正規配置 `skills/jp-lit-research/` を新設して同梱既定とし、既存の `.cursor/skills/` と install scripts はその公開用配置を参照するように寄せる。

**Tech Stack:** Markdown, Node.js, PowerShell, bash, TypeScript 既存構成

---

### Task 1: 公開用 skill 配置を作り、既存配置の参照元を一本化する

**Files:**
- Create: `skills/jp-lit-research/SKILL.md`
- Create: `skills/jp-lit-research/heuristics/clarifying-questions.md`
- Create: `skills/jp-lit-research/heuristics/db-characteristics.md`
- Create: `skills/jp-lit-research/heuristics/evidence-grading.md`
- Create: `skills/jp-lit-research/heuristics/failure-modes.md`
- Create: `skills/jp-lit-research/heuristics/query-expansion.md`
- Create: `skills/jp-lit-research/heuristics/source-selection.md`
- Create: `skills/jp-lit-research/workflows/bibliography-lookup.md`
- Create: `skills/jp-lit-research/workflows/fulltext-page-lookup.md`
- Create: `skills/jp-lit-research/workflows/historical-term-search.md`
- Create: `skills/jp-lit-research/workflows/image-illustration-search.md`
- Create: `skills/jp-lit-research/workflows/research-guide-lookup.md`
- Create: `skills/jp-lit-research/workflows/topic-literature-review.md`
- Modify: `scripts/install-skills.mjs`
- Modify: `scripts/install-skills.ps1`
- Modify: `scripts/install-skills.sh`
- Test: `tests/skillsInstall.test.ts`

- [ ] **Step 1: 公開用 skill 配置の存在を前提にする失敗テストを書く**

```ts
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";

describe("public skill layout", () => {
  it("ships jp-lit-research under skills/", () => {
    expect(existsSync("skills/jp-lit-research/SKILL.md")).toBe(true);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/skillsInstall.test.ts`
Expected: FAIL with `Expected true but received false`

- [ ] **Step 3: 公開用 skill ディレクトリを作り、既存 skill 内容を複製する**

```text
skills/
  jp-lit-research/
    SKILL.md
    heuristics/
    workflows/
```

```powershell
New-Item -ItemType Directory -Force skills\jp-lit-research\heuristics
New-Item -ItemType Directory -Force skills\jp-lit-research\workflows
Copy-Item .cursor\skills\jp-lit-research\SKILL.md skills\jp-lit-research\SKILL.md
Copy-Item .cursor\skills\jp-lit-research\heuristics\* skills\jp-lit-research\heuristics\
Copy-Item .cursor\skills\jp-lit-research\workflows\* skills\jp-lit-research\workflows\
```

- [ ] **Step 4: install scripts の参照元を `skills/jp-lit-research` に変更する最小実装を書く**

```js
const skillSrc = join(repoRoot, "skills", "jp-lit-research");
```

```powershell
$SkillSrc = Join-Path $RepoRoot 'skills\jp-lit-research'
```

```bash
SKILL_SRC="$REPO_ROOT/skills/jp-lit-research"
```

- [ ] **Step 5: テストを再実行して通過を確認する**

Run: `npm test -- tests/skillsInstall.test.ts`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add skills/jp-lit-research scripts/install-skills.mjs scripts/install-skills.ps1 scripts/install-skills.sh tests/skillsInstall.test.ts
git commit -m "feat: add public jp-lit skill layout"
```

### Task 2: README を公開向けの導入導線に再構成する

**Files:**
- Modify: `README.md`
- Modify: `docs/usage-guide.md`
- Test: `tests/readmeLinks.test.ts`

- [ ] **Step 1: アプリ別導線を要求する失敗テストを書く**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("README public onboarding", () => {
  it("links to Codex App and Codex CLI install guides", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("docs/install/codex-app.md");
    expect(readme).toContain("docs/install/codex-cli.md");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/readmeLinks.test.ts`
Expected: FAIL because install guide links do not exist in README

- [ ] **Step 3: README 冒頭を「アプリを選ぶ」導線へ組み替える**

```md
## まず使うアプリを選んでください

- [Codex App の導入手順](docs/install/codex-app.md)
- [Codex CLI の導入手順](docs/install/codex-cli.md)
- [Cursor の導入手順](docs/install/cursor.md)
- [Claude Code の導入手順](docs/install/claude-code.md)
```

```md
## Skills について

このリポジトリでは `jp-lit-research` Skill の併用を既定とします。
不要なら削除・改造できますが、まずはそのまま使うことを推奨します。
```

- [ ] **Step 4: `docs/usage-guide.md` の冒頭説明を README の方針に合わせて更新する**

```md
この文書はインストール後の使い方ガイドです。
インストール手順は次を参照してください。

- `docs/install/codex-app.md`
- `docs/install/codex-cli.md`
- `docs/install/cursor.md`
- `docs/install/claude-code.md`
```

- [ ] **Step 5: テストを再実行して通過を確認する**

Run: `npm test -- tests/readmeLinks.test.ts`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add README.md docs/usage-guide.md tests/readmeLinks.test.ts
git commit -m "docs: reorganize onboarding around app-specific setup"
```

### Task 3: Codex App / Codex CLI / Cursor / Claude Code の個別導入ガイドを作る

**Files:**
- Create: `docs/install/codex-app.md`
- Create: `docs/install/codex-cli.md`
- Create: `docs/install/cursor.md`
- Create: `docs/install/claude-code.md`
- Test: `tests/installDocs.test.ts`

- [ ] **Step 1: 必須ガイド4本の失敗テストを書く**

```ts
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";

describe("install docs", () => {
  it("ships install guides for supported apps", () => {
    expect(existsSync("docs/install/codex-app.md")).toBe(true);
    expect(existsSync("docs/install/codex-cli.md")).toBe(true);
    expect(existsSync("docs/install/cursor.md")).toBe(true);
    expect(existsSync("docs/install/claude-code.md")).toBe(true);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/installDocs.test.ts`
Expected: FAIL because `docs/install/` files do not exist

- [ ] **Step 3: `Codex App` ガイドを作る**

```md
# Codex App で使う

1. Codex App をインストールしてログインする
2. このリポジトリを開く
3. Skill は `skills/jp-lit-research/` を使う
4. MCP は Codex CLI 側で追加すると確実
5. 追加後、App からこのリポジトリで対話を始める
```

- [ ] **Step 4: `Codex CLI` ガイドを作る**

```md
# Codex CLI で使う

1. `npm install -g @openai/codex`
2. `codex login`
3. `codex mcp add ndlJpLit --command node --args dist/src/index.js`
4. `npm run build`
5. `codex` でこのリポジトリを開く
```

- [ ] **Step 5: `Cursor` と `Claude Code` ガイドを作る**

```md
# Cursor で使う

1. リポジトリを clone する
2. `npm install`
3. `npm run build`
4. MCP 設定ファイルへ `dist/src/index.js` を登録する
5. `.cursor/skills/jp-lit-research/` はそのまま自動検出される
```

```md
# Claude Code で使う

1. リポジトリを clone する
2. `npm install`
3. `npm run build`
4. Claude Code の MCP 設定へ server を追加する
5. `powershell -ExecutionPolicy Bypass -File scripts/install-skills.ps1 -Platform claude`
```

- [ ] **Step 6: テストを再実行して通過を確認する**

Run: `npm test -- tests/installDocs.test.ts`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add docs/install/codex-app.md docs/install/codex-cli.md docs/install/cursor.md docs/install/claude-code.md tests/installDocs.test.ts
git commit -m "docs: add app-specific install guides"
```

### Task 4: 導入ガイドと install scripts の整合性を詰める

**Files:**
- Modify: `scripts/install-skills.mjs`
- Modify: `scripts/install-skills.ps1`
- Modify: `scripts/install-skills.sh`
- Modify: `README.md`
- Modify: `docs/install/codex-app.md`
- Modify: `docs/install/codex-cli.md`
- Modify: `docs/install/cursor.md`
- Modify: `docs/install/claude-code.md`
- Test: `tests/installScriptsOutput.test.ts`

- [ ] **Step 1: install scripts の説明文が新導線に合うことを求める失敗テストを書く**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("install script messaging", () => {
  it("mentions Codex and Claude targets explicitly", () => {
    const script = readFileSync("scripts/install-skills.mjs", "utf8");
    expect(script).toContain('codex');
    expect(script).toContain('claude');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/installScriptsOutput.test.ts`
Expected: FAIL on missing messaging assertions or missing test file

- [ ] **Step 3: scripts のヘルプ文と README の記述を一致させる**

```js
console.log("Codex / Claude Code 向け jp-lit-research Skill インストーラー");
console.log("Cursor はリポジトリ内 .cursor/skills/ を自動検出します。");
```

```md
- Codex App: Skill は同梱既定、MCP は Codex CLI 側で追加するのが確実
- Codex CLI: MCP 設定後、そのまま Skill も利用可能
```

- [ ] **Step 4: docs/install/*.md に「つまずきやすい点」節を追加する**

```md
## つまずきやすい点

- `npm run build` を先に実行していない
- MCP 設定先のファイルを間違えている
- Skill を別フォルダへ置いてしまっている
```

- [ ] **Step 5: テストとビルドを再実行して通過を確認する**

Run: `npm test -- tests/installScriptsOutput.test.ts tests/readmeLinks.test.ts tests/installDocs.test.ts tests/skillsInstall.test.ts`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add scripts/install-skills.mjs scripts/install-skills.ps1 scripts/install-skills.sh README.md docs/install tests/installScriptsOutput.test.ts
git commit -m "docs: align install scripts with public onboarding"
```

### Task 5: 最終検証と公開前チェックをまとめる

**Files:**
- Modify: `README.md`
- Modify: `docs/install/codex-app.md`
- Modify: `docs/install/codex-cli.md`
- Modify: `docs/install/cursor.md`
- Modify: `docs/install/claude-code.md`
- Modify: `docs/usage-guide.md`

- [ ] **Step 1: 公開前チェックリストを README に追記する**

```md
## 公開前チェック

- `npm test`
- `npm run build`
- `npm run smoke:mcp`
- install guide のリンク切れ確認
- Skills 配置の確認
```

- [ ] **Step 2: 全体テストを実行する**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: ビルドを実行する**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: ローカル smoke を実行する**

Run: `npm run smoke:mcp`
Expected: PASS

- [ ] **Step 5: 必要なら live matrix も実行する**

Run: `npm run smoke:mcp:live-matrix`
Expected: PASS with `jdcat` only skippable on upstream `503`

- [ ] **Step 6: コミット**

```bash
git add README.md docs/install/codex-app.md docs/install/codex-cli.md docs/install/cursor.md docs/install/claude-code.md docs/usage-guide.md
git commit -m "chore: finalize public onboarding docs"
```

