# jp-lit-research core workflow

## 役割

- `MCP` は検索・取得に徹する
- この Skill は調査戦略、source 選択、検索語展開、典拠評価、結果整理を担う
- 1 回の検索で終わらず、結果を見て次の query や次の source を決める対話的な探索ループを担う

## 基本フロー

1. 依頼を intent に分類する
2. 必要なら調査前情報収集を行う
3. source と検索語の案を作る
4. 検索方針をユーザーに提示して確認を取り、`jp_lit_update_session_trace` に調査目的と source plan を残す
5. 最小限の source / query で検索する
6. 結果を読み、検索試行・採否理由・本文確認範囲を `jp_lit_annotate_session.trace` に残す
7. 必要なら query / source を変えて再検索する
8. 選別過程を明示して報告する

## 検索前確認と継続調査

- 新規テーマでは、検索 MCP を呼ぶ前に短い調査方針を提示し、ユーザー確認を取る
- `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases` など、調査計画を立てるための情報収集は確認前に使ってよい
- すでに同一セッションで文献DB調査が発火しており、ユーザーが「同様に」「次は近代で」などの継続指示を出した場合は、既定方針を 1〜2 文で宣言して検索を続けてよい
- 継続調査でも、最終回答の `検索概要`、`今回の確認範囲`、`調査ログ` は省略しない

## 複数クエリ前提の運用

- 1 回の返答の裏で複数回 `jp_lit_search` などを呼ぶことがある
- 返答時には、それが単発検索の結果ではなく探索ループの要約であることを明示する
- 可能なら各検索について次を示す
  - 何を確かめるための検索か
  - どの source / query を使ったか
  - `total` のうち何件取得したか

## 検索後の二次操作

- 「今の検索を並び替えて」「この条件で絞って」系の依頼は、まず `jp_lit_refine_results` を使う
- `jp_lit_refine_results` はローカルキャッシュ済みの `jp_lit_search` 結果を再処理するため、upstream 再検索より速く、追加ノイズも増やしにくい
- `jp_lit_refine_results` で足りない場合のみ、query/source を変えた再検索へ進む
- cached tool の `cache.hit=true` は保存済み結果の再利用を意味する。返答では `cache.saved_at` と、上流 API へ再検索していないことを明示する
- 最新データが必要な場合だけ `force_refresh=true` を使う。通常の継続調査・再整理では明示リフレッシュしない
- 既存結果の再整理では `total_before` / `total_after`、適用条件、表示件数を示す
- export や annotation を求められた場合は、`selected_items.note` に個別候補の理由、`notes` に検索全体の選別理由を残す
- 調査経過の保存は `jp_lit_update_session_trace` を使う。`source_plan_count` などの count は追加件数ではなく更新後の合計件数として扱う

## Web 補助確認

- 文献DB調査では Web は主経路にしない。NDL / CiNii / J-STAGE / IRDB などで候補集合を作る
- Web は、出版社・団体の性格、著者属性、本文入口、公開PDFの所在、DB外の専門的反応を補う場合に限る
- ユーザーが Web 調査を明示した場合、またはDB上で専門的書評・批判・応答の存在が示唆された場合だけ、Webで書評や批判を広げて探す
- Web由来情報は `根拠: Web補助確認` とし、文献DB由来の書誌・要旨・目次・本文確認と混同しない

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
- session trace は主エージェントの文脈維持にも使う。検索計画、source 選択ログ、検索試行ログ、採用/保留/除外理由、未確認事項、次に見る source を残す
- 断定、引用、candidate の格上げ、競合解消、export 作成時だけ原本へ戻る
- 通常の探索ループ（source 選択、検索語展開、候補判断、次 query の決定）は主エージェントが文脈を持って進める
- サブエージェントは任意。まず sequential な担当分担として使い、速度目的の parallel 実行を標準にしない
- サブエージェントに任せる場合は担当範囲と対象 `cache_key` / `session_id` を固定する。主エージェントが single writer として session trace と最終判断を統合する
- 自然文要求は「最新化 > 削除 > 一覧 > 再抽出 > 通常検索」の順でツールへルーティングする
- `saved_on` の `today` / `yesterday` / `last_7_days` はサーバー側で `Asia/Tokyo` 基準に解決されるため、エージェント側で日付文字列へ展開しない

## 参照

- `02-source-and-query.md`
- `03-evidence-and-output.md`
- 旧詳細資料: `workflows/` / `heuristics/`
