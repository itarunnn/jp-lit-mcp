# jp-lit-research source and query

## source 選択の要点

- 存在確認・初動調査（広域）: `ndl_search`
- 近代以降の図書・雑誌（詳細）: `ndl_catalog` → `ndl_digital` → `cinii_books`
- 論文・紀要: `cinii_articles` → `jstage_articles` → `ndl_articles` → `irdb`
- 本文中の語を探す: `jp_lit_search_fulltext` → `jp_lit_search_pages`
- 図版・挿絵: `jp_lit_search_illustrations` → `japan_search`
- 所蔵確認: `ndl_catalog` → `cinii_books`
- 人文専門 DB 横断: `nihu_bridge`
- 研究データ: `jdcat`
- 会議録: `kokkai_minutes` / `teikoku_minutes`
- 調べ方・類似事例: `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases`

## 検索語展開

最低限やること:

1. 表記ゆれを 2〜3 種追加
2. 旧字・異体字を確認
3. 関連する上位語・下位語を 1 つずつ加える

## 検索時の注意

- メタデータ検索が先。全文検索は後
- 並び替えや絞り込みの依頼は、まず `jp_lit_refine_results` で直近結果を再処理する
- `ndl_digital` で OCR 系へ進む前に `jp_lit_get_record` で `next_digital_library.available` を確認
- `jp_lit_search` は 1 回最大 100 件
- source 未指定の横断検索は `page=1` のみ対応
- 結果報告には、可能なら `全N件中M件取得` を明記する
- `total` / `limit` / `page` は各ツール呼び出し単位の値であり、1 回の返答全体の件数ではない
- 1 回の返答の中で query や source を変えて複数回検索した場合は、その回数と各検索の役割を示す

`jp_lit_refine_results` の代表マッピング:

- 年代順: `sort_by="issued_at"` + `sort_order="asc"`
- 新しい順: `sort_by="issued_at"` + `sort_order="desc"`
- タイトル順: `sort_by="title"`
- 期間絞り込み: `filters.issued_from` / `filters.issued_to`
- 公開有無: `filters.online`, `filters.digital_collection`
- 文字列絞り込み: `filters.title_contains`, `filters.author_contains`

キャッシュ起点のショートカット:

- 今日の保存キャッシュ一覧: `jp_lit_list_cache(tool="jp_lit_search", saved_on="today")`
- 差分抽出: `jp_lit_refine_results(cache_keys=[A,B], combine="minus")`
- 共通集合抽出: `jp_lit_refine_results(cache_keys=[A,B,...], combine="intersection")`

## 検索後の分岐

- 0 件: 表記ゆれ、旧字、上位語、下位語を追加。source を変える
- 多すぎる: 年代、資料種別、主題で絞る
- 有力 1 件: `jp_lit_get_record` で詳細確認し、次 query を作る
- `ndl_digital` で見つかった: OCR、ページ特定、図版検索へ進むか判断する

## 参照

- `01-core-workflow.md`
- `03-evidence-and-output.md`
- 旧詳細資料: `heuristics/source-selection.md`, `heuristics/query-expansion.md`, `heuristics/failure-modes.md`
