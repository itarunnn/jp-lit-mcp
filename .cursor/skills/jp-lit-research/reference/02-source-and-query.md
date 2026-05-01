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

## NDL サーチの用途分解

`ndl_search` は、同じ検索でも目的によって読み方を変える。

1. 総合目録として使う: レア資料・地域資料・同人誌など、どこかの図書館に所蔵があるかを探す
2. NDL 蔵書目録として使う: NDL で閲覧できるか、デジタル公開や欠本・紛失相当の状態を確認する
3. 全国書誌として使う: 既知タイトルではなく、件名・分類・目次語から未知の本を探す

報告時には、`ndl_search` をどの目的で使ったかを明示する。所蔵確認では「見つかった=読める」とは限らないため、所蔵館・公開範囲・閲覧条件の追加確認を次の手にする。

## 件名・NDC/NDLC による未知文献探索

キーワード検索で主題文献が拾えない場合は、詳細書誌から `subjects` / `facets.ndc` / `source_metadata` に出る件名・分類を手掛かりに再検索する。

1. まず代表的な既知資料を1件見つけ、件名・分類・目次語を読む
2. 件名標目をそのまま query に戻す
3. 地名・時代・対象をフリーキーワードとして足す
4. NDC は桁を減らして上位主題へ広げ、必要なら前方一致相当の query（例: `024.1` / `024`）を試す
5. 古い資料では NDC の版差で分類の意味が変わるため、年代を区切って別番号も疑う

MCP では `filters.ndl.subject` / `filters.ndl.ndc` / `filters.ndl.ndlc` を使って件名・NDC・NDLC を指定できる。まず代表資料の件名・分類を読み、次の検索で専用フィルターに回す。

## 語誌・用例検索

語の来歴・意味変化・用法を調べる場合は、次の順に進む。

1. 語誌文献を探す: `対象語 + 語誌 / 語源 / 語彙史 / 意味変化 / 用法 / 翻訳語`
2. 専門書誌・目次・内容細目を疑う: タイトルに出ない章・論文集収録を `table_of_contents` / `summary` で確認
3. 記事・論文DBで補う: `cinii_articles` / `ndl_articles` / `jstage_articles`
4. 全文用例に進む: `jp_lit_search_fulltext` → `jp_lit_search_pages`

用例検索では、1例だけで初出や意味変化を断定しない。複数年代・複数ジャンルで確認し、OCR 誤読、復刻本、一括刊行年、目次ヒットを疑う。

## 検索語展開

最低限やること:

1. 表記ゆれを 2〜3 種追加
2. 旧字・異体字を確認
3. 関連する上位語・下位語を 1 つずつ加える

## 検索時の注意

- メタデータ検索の再試行が先。全文検索はその後
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
