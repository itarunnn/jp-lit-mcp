# CiNii Research Adapter 実装計画

**Goal:** `jp_lit_search` / `jp_lit_get_record` に CiNii 論文 source を追加し、NDL 系と同じ共通スキーマで日本語文献探索を広げる。

**Scope:**

- `cinii_articles` source の追加
- search adapter
- record/detail adapter
- 共通スキーマへの正規化
- fixture / adapter test / API notes / README 更新

**Out of Scope:**

- 全文取得
- PDF / DOI 解決
- NDL と CiNii の自動同一資料統合
- 高度な横断ランキング再設計

## 方針

- 外向き API は増やさず、既存の `jp_lit_search` / `jp_lit_get_record` に `source: "cinii_articles"` を足す。
- 内部は adapter を 1 つ追加し、既存 service / source registry を再利用する。
- `issued_at`, `issued_at_label`, `issued_at_precision` は現行ルールを維持する。
- source 固有情報は `source_metadata` と `raw` に残す。
- 初版は XML ではなく、CiNii 側の実レスポンス形式に合わせて最短実装する。

## Task 1: API 調査と fixture 方針の確定

- [x] 公式仕様の確認
- [x] search endpoint / detail endpoint の切り分け
- [x] 必須フィールドの対応表作成
- [x] fixture の採取方針決定

## Task 2: adapter の骨格と mapper テスト

- `src/sources/ciniiResearch/adapter.ts`
- `src/sources/ciniiResearch/mapSearch.ts`
- `src/sources/ciniiResearch/mapRecord.ts`
- `tests/ciniiResearch.adapter.test.ts`

RED:

- [x] search の正規化テスト
- [x] record の正規化テスト
- [x] source registry / searchService / recordService から参照できること

## Task 3: MCP 公開面への統合

- [x] `source` schema に `cinii_articles` を追加
- [x] `jp_lit_search` / `jp_lit_get_record` から利用可能にする
- [x] 既存横断検索で `page=1` が維持されることを確認

## Task 4: 文書化と検証

- [x] README の source 一覧更新
- [x] `docs/api-notes/cinii-research.md` 追加
- [x] `npm test`
- [x] `npm run build`
- [x] live smoke を追加せず既存 `SMOKE_LIVE` で `cinii_articles` を検証

## 想定リスク

- CiNii の detail 取得キーが NDL と違い、`source_id` の安定化ルールを別途決める必要がある
- 著者・掲載誌・巻号・ページの粒度が NDL とかなり違う可能性がある
- OpenURL / DOI / handle 系 identifier の正規化方針が必要になる

## 完了条件

- [x] `source: "cinii_articles"` で検索できる
- [x] 返却が既存の共通スキーマに乗る
- [x] detail 取得ができる
- [x] テストとビルドが通る
- [x] source 固有メタデータが `source_metadata` / `raw` に残る

## 実績メモ

- CiNii articles adapter を追加
- search は `OpenSearch articles + format=json` を使用
- detail は `crid/{crid}.json` を使用
- `CINII_RESEARCH_APP_ID` を optional env として追加
- fixture / adapter test / schema test を追加
- 2026-04-25 に live smoke 確認
  - `cinii_articles / 夏目漱石 -> 1573387450265380480`
  - detail 取得成功

## 次の改善候補

- `articles` 固定ではなく source/type 指定を広げる
- detail title の fallback を `publicationName` より精密にする
- DOI / handle / OpenURL 系 identifier 正規化を強化する
