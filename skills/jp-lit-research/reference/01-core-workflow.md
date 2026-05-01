# jp-lit-research core workflow

## 役割

- `MCP` は検索・取得に徹する
- この Skill は調査戦略、source 選択、検索語展開、典拠評価、結果整理を担う
- 1 回の検索で終わらず、結果を見て次の query や次の source を決める

## 基本フロー

1. 依頼を intent に分類する
2. 必要なら調査前情報収集を行う
3. source と検索語の案を作る
4. 検索方針をユーザーに提示して確認を取る
5. 最小限の source / query で検索する
6. 結果を読み、次の一手を決める
7. 必要なら query / source を変えて再検索する
8. 選別過程を明示して報告する

## 複数クエリ前提の運用

- 1 回の返答の裏で複数回 `jp_lit_search` などを呼ぶことがある
- 返答時には、それが単発検索の結果ではなく探索ループの要約であることを明示する
- 可能なら各検索について次を示す
  - 何を確かめるための検索か
  - どの source / query を使ったか
  - `total` のうち何件取得したか

## intent

- `bibliography_lookup`
- `topic_literature_review`
- `historical_term_search`
- `fulltext_page_lookup`
- `image_illustration_search`
- `research_guide`

## 調査前情報収集

次の条件で、検索前にレファ協と NDL リサーチ・ナビを参照する。

- `research_guide`: 常に実行
- `topic_literature_review`: 原則実行
- `historical_term_search`: 用語・時代・異体字が複雑な場合
- `bibliography_lookup`: 初出調査のみ
- `image_illustration_search`: 美術・文化財・地域資料のみ
- `fulltext_page_lookup`: 省略

## 会話運用

- 生の検索結果や OCR payload を会話へ大量に貼り付けない
- 内部保存した cache / session を原本とし、会話には要点と判断だけを残す
- 断定、引用、candidate の格上げ、競合解消、export 作成時だけ原本へ戻る
- サブエージェントは任意。単独エージェントで成立することを前提にする

## 参照

- `02-source-and-query.md`
- `03-evidence-and-output.md`
- 旧詳細資料: `workflows/` / `heuristics/`
