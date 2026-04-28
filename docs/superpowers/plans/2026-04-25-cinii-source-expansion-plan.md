# CiNii Source Expansion 計画

**Goal:** `cinii_articles` を起点に CiNii source を拡張し、書籍は `cinii_books` として分離する。

## 現状

- `cinii_articles` は `OpenSearch articles` に対応
- quality 優先で metadata 正規化は安定
- title / identifier / summary / publication 情報は初版より精度向上済み

## 次フェーズでやること

1. search type の切替方式を決める
- 外向き `source` は `cinii_articles` / `cinii_books` に分離
- 内部で `articles` / `books` / `all` などを切り替えられる余地を作る
- 外向き引数に増やすか、まず内部限定にするか決める

2. type ごとの item shape を調査する
- `articles`
- `books`
- `all`
- 必要なら `datasets` 系も確認

3. 共通スキーマへの正規化境界を決める
- title
- authors
- publisher
- issued_at
- identifiers
- subjects
- availability

4. detail 取得戦略を決める
- type ごとに `crid/{crid}.json` が安定するか確認
- type 差で detail shape がどれだけ崩れるか確認

## リスク

- `all` は shape の揺れが大きく、title fallback が弱くなる可能性が高い
- 書籍系は publisher / edition / extent の粒度が論文と違う
- `source` を 1 個に保ったまま type を増やすと、検索 UX と正規化責務が重くなる

## 推奨順

1. `books` を先に調査
2. `articles + books` の 2 系統で共通化
3. `all` は最後に評価
