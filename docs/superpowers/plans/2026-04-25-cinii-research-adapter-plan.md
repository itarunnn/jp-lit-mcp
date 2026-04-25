# CiNii Research Adapter 実装計画

**Goal:** `jp_lit_search` / `jp_lit_get_record` に `cinii_research` source を追加し、NDL 系と同じ共通スキーマで日本語文献探索を広げる。

**Scope:**

- `cinii_research` source の追加
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

- 外向き API は増やさず、既存の `jp_lit_search` / `jp_lit_get_record` に `source: "cinii_research"` を足す。
- 内部は adapter を 1 つ追加し、既存 service / source registry を再利用する。
- `issued_at`, `issued_at_label`, `issued_at_precision` は現行ルールを維持する。
- source 固有情報は `source_metadata` と `raw` に残す。
- 初版は XML ではなく、CiNii 側の実レスポンス形式に合わせて最短実装する。

## Task 1: API 調査と fixture 方針の確定

- 公式仕様の確認
- search endpoint / detail endpoint の切り分け
- 必須フィールドの対応表作成
- fixture の採取方針決定

## Task 2: adapter の骨格と mapper テスト

- `src/sources/ciniiResearch/adapter.ts`
- `src/sources/ciniiResearch/mapSearch.ts`
- `src/sources/ciniiResearch/mapRecord.ts`
- `tests/ciniiResearch.adapter.test.ts`

RED:

- search の正規化テスト
- record の正規化テスト
- source registry / searchService / recordService から参照できること

## Task 3: MCP 公開面への統合

- `source` schema に `cinii_research` を追加
- `jp_lit_search` / `jp_lit_get_record` から利用可能にする
- 既存横断検索で `page=1` が維持されることを確認

## Task 4: 文書化と検証

- README の source 一覧更新
- `docs/api-notes/cinii-research.md` 追加
- `npm test`
- `npm run build`
- 必要なら live smoke を追加

## 想定リスク

- CiNii の detail 取得キーが NDL と違い、`source_id` の安定化ルールを別途決める必要がある
- 著者・掲載誌・巻号・ページの粒度が NDL とかなり違う可能性がある
- OpenURL / DOI / handle 系 identifier の正規化方針が必要になる

## 完了条件

- `source: "cinii_research"` で検索できる
- 返却が既存の共通スキーマに乗る
- detail 取得ができる
- テストとビルドが通る
- source 固有メタデータが `source_metadata` / `raw` に残る
