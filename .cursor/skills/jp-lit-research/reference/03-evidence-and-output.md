# jp-lit-research evidence and output

## 典拠評価

結果は次の 3 段階で報告する。

- 確認済み
- 有力候補
- 弱い候補

OCR ヒットのみで本文内容を断定しない。

## 候補提示時に添える情報

可能な限り次を付ける。

- 著者名
- 書名
- 掲載誌名または出版社
- 発行年
- source（DB名）
- 可能なら `source_id` または URL

## 選別過程の明示

必ず次を説明する。

- 各 source から何件取得したか
- どの基準で候補を絞ったか
- 除外したものがあればその理由

## annotation / export

- `selected_items.note`: 個別候補の短い理由
- `notes`: 検索全体の選別理由
  - 何件取得して何件を採用したか
  - どの基準で絞ったか
  - 外したものの代表的な理由
  - 次に何を確認すべきか

`jp_lit_export_session` の profile:

- `full_log`
- `selected`
- `unselected`

## 参照

- `01-core-workflow.md`
- `02-source-and-query.md`
- 旧詳細資料: `heuristics/evidence-grading.md`, `heuristics/db-characteristics.md`, `heuristics/clarifying-questions.md`
