# NDL Provider Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ndl_search` を広い横断 source として残しつつ、`ndl_catalog` と `ndl_articles` を provider 固定 source として追加する。

**Architecture:** 既存の `createNdlSearchAdapter` を provider 指定可能な汎用 NDL Search adapter に広げ、`iss-ndl-opac` と `zassaku` をそれぞれ `ndl_catalog` と `ndl_articles` として公開する。横断検索の既定 source は `ndl_search` を外し、provider 固定 source を主役にする。

**Tech Stack:** TypeScript, Vitest, MCP SDK, NDL Search OpenSearch/XML

---

### Task 1: 型・スキーマ・README の source 定義を広げる

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/schemas.ts`
- Modify: `README.md`
- Test: `tests/jpLitSearch.test.ts`
- Test: `tests/jpLitGetRecord.test.ts`

- [ ] `SourceName` に `ndl_catalog` と `ndl_articles` を追加する。
- [ ] `sourceSchema` に同じ source を追加する。
- [ ] `jp_lit_search` / `jp_lit_get_record` のスキーマテストに新 source を追加する。
- [ ] README の source 一覧、利用例、横断検索説明を更新する。

### Task 2: provider 指定可能な NDL Search adapter を実装する

**Files:**
- Modify: `src/sources/ndlSearch/adapter.ts`
- Modify: `src/sources/ndlSearch/mapSearch.ts`
- Modify: `tests/ndlSearch.adapter.test.ts`

- [ ] `createNdlSearchAdapter` に `source` と `providerId` を受ける option を追加する。
- [ ] search 時に `providerId` が指定されていれば `dpid` を付与する。
- [ ] provider 固定 source でも既存 mapper をそのまま再利用できるように、search item の `source` を adapter 側で上書きする。
- [ ] `ndl_catalog(iss-ndl-opac)` と `ndl_articles(zassaku)` の adapter テストを追加する。

### Task 3: server と横断検索既定 source を更新する

**Files:**
- Modify: `src/server.ts`
- Modify: `src/services/searchService.ts`
- Modify: `tests/jpLitSearch.test.ts`
- Modify: `scripts/smoke-mcp.ts`

- [ ] server に `createNdlCatalogAdapter` / `createNdlArticlesAdapter` 相当の生成を追加する。
- [ ] source 未指定の横断検索順を `ndl_catalog` / `ndl_digital` / `ndl_articles` / `cinii_articles` / `cinii_books` に変更する。
- [ ] `ndl_search` は後方互換 source として残すが、横断既定には含めない。
- [ ] smoke script の live 既定値を新しい推奨 source に合わせる。

### Task 4: 文書・確認コマンド・回帰を閉じる

**Files:**
- Modify: `README.md`
- Modify: `mcp-config.example.json`
- Modify: `docs/api-notes/ndl-search.md`

- [ ] `ndl_search` が「NDL all」に近い互換 source であることを README に明記する。
- [ ] `ndl_catalog = iss-ndl-opac`、`ndl_articles = zassaku` を README と API note に明記する。
- [ ] `npm test`, `npm run build`, `npm run smoke:mcp` を実行し、必要なら live smoke も確認する。
- [ ] 変更をコミットする。
