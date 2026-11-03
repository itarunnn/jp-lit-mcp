# jp-lit-verification core workflow

## 役割

- 貼り付け文章に含まれる日本語文献候補の実在性と書誌整合性を検証する
- 主入力は、他サービスや他セッションから持ち込まれた回答文・会話ログ・参考文献一覧

## 基本フロー

1. 貼り付け文章を受け取る
2. 文献候補を抽出する
3. `SID = jp_lit_start_session(research_goal="貼り付け文章の文献検証").session_id` を保持する
4. `jp_lit_search(session_id=SID, source=ndl_search, query=...)` で一次検証する
5. 必要なら同じ `session_id` を渡して個別 source で再確認する
6. 判定表で報告する

`SID` は開始時に返された実際のIDに置き換える。検索・取得・照合・注釈・exportには同じIDを毎回明示する。継続依頼は既存IDを引き継ぎ、独立した検証案件では新しいIDを開始する。

## 原則

- 文献候補は広めに拾う
- 判定は厳しめに行う
- 生の検索結果を会話へ大量に貼り付けない
- 重い record / OCR payload は必要時だけ再読込する
- 長い検証では、要点・怪しい候補・次の手だけを持ち回る
- 候補抽出、一次検証、判定理由の確定は主エージェントが文脈を持って進める
- サブエージェントは任意。単独エージェントで成立することを前提にし、保存済み結果や固定済み候補表の大量再点検・要約に限って使う

## 参照

- `02-extraction-and-classification.md`
- `03-output-and-rationale.md`
- 旧詳細資料: `workflows/` / `heuristics/`
