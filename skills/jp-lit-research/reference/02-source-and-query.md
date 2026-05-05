# jp-lit-research source and query

## source 選択の要点

- 存在確認・初動調査（広域）: `ndl_search`
- 近代以降の図書・雑誌（詳細）: `ndl_catalog` → `ndl_digital` → `cinii_books`
- 論文・紀要: `cinii_articles` → `jstage_articles` → `ndl_articles` → `irdb`
- 本文中の語を探す: `jp_lit_search_fulltext` → `jp_lit_search_pages`
- 図版・挿絵: `jp_lit_search_illustrations` → `japan_search`
- 所蔵確認: `ndl_catalog` → `cinii_books`
- 再録・改稿・最終版候補: `ndl_catalog` → `cinii_books` → `ndl_digital`
- 人文専門 DB 横断: `nihu_bridge`
- 研究データ: `jdcat`
- 会議録: `kokkai_minutes` / `teikoku_minutes`
- 調べ方・類似事例: `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases`

## researchmap 個人ページの扱い

researchmap は API tool 化しない。通常の文献検索ではまず CiNii / J-STAGE / IRDB / NDL / NIHU 系を使い、研究者名だけを入口にした探索は常用しない。

ただし、文献 DB 調査の途中で次の必要が出た場合は、ユーザー確認後の補助手段として Web 検索で researchmap 個人ページを確認してよい。

- 講演・口頭発表を探している
- 雑誌・一般媒体への寄稿を探している
- 書籍の分担執筆、編著、MISC が他 DB で拾いにくい
- 文献探索の途中で、特定の著者がそのテーマの重要人物らしいと分かった
- 特定研究者の活動履歴から、追加の検索語・イベント名・掲載媒体名を得たい

検索例:

```text
researchmap "研究者名" "口頭発表"
researchmap "研究者名" "書籍等出版物"
site:researchmap.jp "研究者名" "講演"
```

動線は「文献探索で候補を見る → 重要そうな著者名を拾う → researchmap 個人ページで講演・寄稿・書籍等出版物・MISC を確認する → そこで得たタイトル、会議名・イベント名、媒体名、共著者名、出版社名を使って CiNii / J-STAGE / IRDB / NDL / DOI / ISBN で再検索する」とする。

researchmap で見つけた項目は、文献確定ではなく追加探索の手がかりとして扱う。ページや業績一覧の更新日・最終更新状態も確認し、更新が古い場合は「最近の成果は未反映の可能性がある」と見なして他 DB や Web 検索を優先する。

## 検索語展開

最低限やること:

1. 表記ゆれを 2〜3 種追加
2. 旧字・異体字を確認
3. 関連する上位語・下位語を 1 つずつ加える

## 典拠・分類からの検索語展開

人名・団体名・件名・著作名・ジャンルが調査の鍵になる場合は、検索前または 0 件後に `jp_lit_resolve_authority` を使う。

- 人名・団体名:
  - `variant_terms` と `same_identity_terms` は検索語候補にしてよい。
  - 筆名・別名義は、名義別に探すか、まとめて探すかを報告で分ける。
- 件名:
  - `variant_terms` は検索語候補。
  - `reference_terms` は上位語・下位語・関連語を含むため、必要時のみ使う。
- 著作典拠:
  - 翻訳タイトル・別タイトルは `variant_terms` として試す。
- ジャンル:
  - 形式・ジャンルを探す語であり、主題としての検索とは分ける。

分類記号が分かる、または古い図書で件名が弱い場合は `jp_lit_find_authority_terms_by_classification` を使う。

- `NDC10` / `NDC9` / `NDC8` は現代以降の大まかな探索語候補作成に使う。
- 戦前・古い図書では `NDC6` も検討する。
- 分類から得た件名標目は「未知文献探索の入口」であり、正解リストではない。
- その後の実検索では、必要に応じて次へつなぐ。
  - `jp_lit_search(source=ndl_catalog, query=..., filters={ ndl: { subject, ndc } })`
  - `jp_lit_search(source=ndl_digital, query=..., filters={ ndl: { ndc } })`
  - `jp_lit_search_fulltext(keyword=..., f_ndc=...)`

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
- 初出論文や重要論文が見つかった:
  - 発行日を手がかりに、後年の研究書・論文集・著作集・全集への再録・改稿版を探す
  - `ndl_catalog` / `cinii_books` で著者名 + 論文タイトル、著者名 + 主題語を検索する
  - 目次・初出一覧・あとがき・版注記が見つからない場合は `要現物確認` とする
- `ndl_digital` で見つかった: OCR、ページ特定、図版検索へ進むか判断する

## 参照

- `01-core-workflow.md`
- `03-evidence-and-output.md`
- 旧詳細資料: `heuristics/source-selection.md`, `heuristics/query-expansion.md`, `heuristics/failure-modes.md`
