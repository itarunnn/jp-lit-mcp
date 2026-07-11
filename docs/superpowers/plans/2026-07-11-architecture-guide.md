# jp-lit-mcp Architecture Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TypeScript 基礎読者が jp-lit-mcp の実装経路と拡張方法を理解できる自己完結型 HTML 教材を作る。

**Architecture:** `docs/architecture-guide/` の静的4ファイルに分け、HTMLが内容とSVG、CSSが編集的レイアウト、JSがprogressive enhancementを担当する。現行 repo の構造契約を Vitest で固定し、実ブラウザでも確認する。

**Tech Stack:** HTML5, CSS, vanilla JavaScript, inline SVG, Vitest

## Global Constraints

- 日本語を主言語にする。
- 外部 CDN、frontend framework、画像、web font を使わない。
- JavaScript 無効時も本文を読める。
- MCP SDK と repo 固有コードの責務を明確に分ける。
- 現行の実ファイルと関数名に基づいて説明する。

---

### Task 1: 成果物 contract test と意味構造

**Files:**
- Create: `tests/architectureGuide.test.ts`
- Create: `docs/architecture-guide/index.html`
- Create: `docs/architecture-guide/README.md`

**Interfaces:**
- Consumes: Node `fs`, Vitest
- Produces: `index.html` の section id、data 属性、アクセシブル SVG hook

- [ ] **Step 1: failing test を書く**

必須4ファイル、章 ID、主要 source path、`aria-labelledby`、`data-layer`、CSS/JS参照を検証する。

- [ ] **Step 2: RED を確認する**

Run: `npm test -- tests/architectureGuide.test.ts`
Expected: FAIL because `docs/architecture-guide/index.html` does not exist.

- [ ] **Step 3: semantic HTML と README を実装する**

Hero、framework、flow、layers、decisions、persistence、extensions、testing、reading-route を、実コード断片と inline SVG 付きで記述する。

- [ ] **Step 4: GREEN を確認する**

Run: `npm test -- tests/architectureGuide.test.ts`
Expected: PASS.

### Task 2: 編集的デザインとレスポンシブ

**Files:**
- Create: `docs/architecture-guide/styles.css`
- Modify: `tests/architectureGuide.test.ts`

**Interfaces:**
- Consumes: HTML class と data 属性
- Produces: desktop/mobile/print/reduced-motion 対応

- [ ] **Step 1: CSS contract の failing test を追加する**

CSS variables、focus-visible、mobile media query、print media query、reduced-motion を検証する。

- [ ] **Step 2: RED を確認する**

Run: `npm test -- tests/architectureGuide.test.ts`
Expected: FAIL because `styles.css` does not exist.

- [ ] **Step 3: CSS を実装する**

生成り・濃紺・朱色・青緑の token、sticky rail、本文 grid、code panel、SVG states、mobile reflow、print を実装する。

- [ ] **Step 4: GREEN を確認する**

Run: `npm test -- tests/architectureGuide.test.ts`
Expected: PASS.

### Task 3: progressive enhancement

**Files:**
- Create: `docs/architecture-guide/app.js`
- Modify: `tests/architectureGuide.test.ts`

**Interfaces:**
- Consumes: `[data-layer]`, `[data-view]`, `[data-code-note]`, section ids
- Produces: active navigation、SVG view、layer detail、code annotation

- [ ] **Step 1: JS behavior contract の failing test を追加する**

IntersectionObserver fallback、click/keyboard layer selection、view switching、code note switching を検証する。

- [ ] **Step 2: RED を確認する**

Run: `npm test -- tests/architectureGuide.test.ts`
Expected: FAIL because `app.js` does not exist.

- [ ] **Step 3: dependency-free JS を実装する**

DOM が欠けても例外にしない初期化関数とイベント処理を実装する。

- [ ] **Step 4: GREEN を確認する**

Run: `npm test -- tests/architectureGuide.test.ts`
Expected: PASS.

### Task 4: repo / browser 検証と仕上げ

**Files:**
- Modify: `docs/architecture-guide/index.html`
- Modify: `docs/architecture-guide/styles.css`
- Modify: `docs/architecture-guide/app.js`
- Modify: `docs/architecture-guide/README.md`

**Interfaces:**
- Consumes: 完成した静的ページ
- Produces: build/test/browser で検証済みの教材

- [ ] **Step 1: 全自動検証を実行する**

Run: `npm test && npm run build`
Expected: all tests pass and TypeScript build exits 0.

- [ ] **Step 2: browser で確認する**

ローカル server で表示し、desktop/mobile、console、overflow、keyboard focus、SVG interaction を確認する。

- [ ] **Step 3: 内容を現行コードに照合する**

`src/index.ts`, `src/server.ts`, `src/tools/jpLitSearch.ts`, `src/services/searchService.ts`, `src/sources/types.ts`, `src/lib/persistence/runCachedTool.ts` と記述を照合する。

- [ ] **Step 4: 最終差分を確認する**

Run: `git diff --check && git status --short`
Expected: whitespace errorsなし、意図したファイルだけが表示される。
