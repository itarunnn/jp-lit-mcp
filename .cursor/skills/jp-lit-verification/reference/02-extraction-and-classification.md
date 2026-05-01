# jp-lit-verification extraction and classification

## 候補抽出

拾うもの:

- 『』や「」で囲まれた文献名らしい表現
- 著者名 + 年 + タイトル断片
- 雑誌名 + 巻号 + ページ
- 「〜によれば」「〜という論文」型の記述

弱い候補として別枠に回すもの:

- 情報が少なすぎる
- 作品名か文献名か判別しにくい
- 文献候補としては弱いが抽出対象にはなった

## 判定カテゴリ

- 実在確認済み
  - `ndl_search` でタイトル・著者・年などが 2〜3 項目一致
  - 競合候補がない
- 部分一致
  - タイトルは近いが他要素が弱い
  - 著者または年が欠ける
  - 候補が複数あり絞り切れない
- 非実在の疑い
  - `ndl_search` で有力候補が見つからない
  - 軽い正規化や言い換えをしても一致候補がない
- 混線の疑い
  - タイトルと著者・年が別候補に割れる
  - 複数文献の書誌要素が混在している可能性がある

## source 再確認

- 図書: `ndl_catalog` / `cinii_books`
- 論文: `cinii_articles` / `jstage_articles` / `ndl_articles`
- 一次資料: `ndl_digital`

## 参照

- `01-core-workflow.md`
- `03-output-and-rationale.md`
- 旧詳細資料: `heuristics/extraction-rules.md`, `heuristics/classification-rules.md`, `heuristics/source-followup.md`
