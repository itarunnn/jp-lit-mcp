# jp-lit-verification core workflow

## 役割

- 貼り付け文章に含まれる日本語文献候補の実在性と書誌整合性を検証する
- 主入力は、他サービスや他セッションから持ち込まれた回答文・会話ログ・参考文献一覧

## 基本フロー

1. 貼り付け文章を受け取る
2. 文献候補を抽出する
3. `jp_lit_search(source=ndl_search, query=...)` で一次検証する
4. 必要なら個別 source で再確認する
5. 判定表で報告する

## 原則

- 文献候補は広めに拾う
- 判定は厳しめに行う
- 生の検索結果を会話へ大量に貼り付けない
- 重い record / OCR payload は必要時だけ再読込する
- 長い検証では、要点・怪しい候補・次の手だけを持ち回る
- サブエージェントは任意。単独エージェントで成立することを前提にする

## 参照

- `02-extraction-and-classification.md`
- `03-output-and-rationale.md`
- 旧詳細資料: `workflows/` / `heuristics/`
