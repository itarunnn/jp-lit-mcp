# jp-lit-research evidence and output

## 典拠評価

結果は次の 3 段階で報告する。

- 確認済み
- 有力候補
- 弱い候補

OCR ヒットのみで本文内容を断定しない。

## researchmap 由来情報

researchmap 個人ページで見つけた講演・口頭発表・寄稿・分担執筆・MISC 等は、原則として「追加探索の手がかり」として扱う。

- 文献探索中に重要そうな著者が見つかり、その著者の researchmap 個人ページを確認した場合は、「著者から辿った補助確認」として報告する。
- researchmap は研究者本人・機関による更新状況に左右される。ページや業績一覧の更新日が古い場合、最新情報の欠落を明記する。
- CiNii / J-STAGE / IRDB / NDL / DOI / ISBN で確認できた場合だけ、文献候補として格上げする。
- 口頭発表や講演は、文献ではなく活動記録として分けて報告する。
- researchmap の記載だけを根拠に、確認済み書誌・引用可能文献として扱わない。
- 報告時は「researchmap 個人ページ由来」と明記し、個人ページ URL、確認できた更新状態、次に確認すべき DB や検索語を添える。

## 候補提示時に添える情報

可能な限り次を付ける。

- 著者名
- 書名
- 掲載誌名または出版社
- 発行年
- source（DB名）
- 可能なら `source_id` または URL

## 短い抜粋の添え方

書誌要素だけでなく、候補の関連箇所を短く示す。

- `jp_lit_search_fulltext` の `highlights` があれば、上位候補に 1〜2 件添える
- `jp_lit_search` / `jp_lit_get_record` の `summary` があれば短く添える
- `table_of_contents` が有用なら代表的な項目だけ添える

目的は「なぜその候補を出したか」をその場で分かるようにすること。毎件長く貼り付けず、上位候補だけに短く付ける。ページ番号が必要なら `jp_lit_search_pages` を追加で使う。

## 選別過程の明示

必ず次を説明する。

- 今回の返答が何回の検索を束ねたものか
- 各検索で何を確かめるために source / query を変えたか
- 各 source から何件取得したか
- どの基準で候補を絞ったか
- 除外したものがあればその理由
- `jp_lit_refine_results` を使った場合は、`total_before` / `total_after` と適用した条件（sort/filter）を明示する
- `jp_lit_refine_results` は既定で先頭 30 件だけ返す。`total_after > 30` の場合は、「全何件中、どの順の先頭 30 件か」を明示する
- 全件確認が必要な場合は、まず `jp_lit_export_view` で書き出す
- 重複確認は通常の再整理に毎回混ぜない。必要なときだけ `include_duplicate_clusters=true`、全件確認では `jp_lit_export_view(view="refined_results", export_all=true, duplicate_notes=true)` を使う
- `total_after > 100` や複数 cache 統合後の傾向要約が必要な場合は、`cache_key` / `session_id` で対象を固定したうえで、任意で要約専用サブエージェントを使ってよい。ただし標準の検索判断フローではない

## 重複クラスタ確認

- クラスタは自動削除ではなく、同一候補の確認材料として扱う
- `duplicate_key` と title/author/year の近似一致から候補を出す
- `search_result_readiness` は検索結果レベルのメタデータ充足度であり、引用確定には詳細レコードや現物確認が必要
- サブエージェントを使う場合も、対象 `cache_key` / `session_id` を固定し、最終採否は主エージェントが統合してユーザーに確認する
- CSL JSON へ渡す前は、重複候補を見たうえで採用項目だけを `jp_lit_annotate_session` に保存し、`jp_lit_export_session(format="csl-json", profile="selected")` で書き出す

## annotation / export

- `selected_items.note`: 個別候補の短い理由
- `notes`: 検索全体の選別理由
  - 何件取得して何件を採用したか
  - 何回検索し、各検索で何を確かめたか
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
