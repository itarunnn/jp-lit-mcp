# 技術リファレンス

このページは、`jp-lit-mcp` の MCP ツール仕様、source、環境変数、保存形式、既知の制約を引くためのリファレンスです。使い始めるための説明は [README](../README.md)、調査依頼の出し方は [使い方ガイド](usage-guide.md) を参照してください。

## 全体仕様

### 検索モデル

`jp_lit_search` は `source` を指定すると個別 source を検索し、指定しない場合は既定の横断検索になります。

- `limit` の上限は 100 件です。
- 個別検索の既定 `limit` は 50 件です。
- 横断検索の既定 `limit` は 48 件です。
- 横断検索では、内部で各 source から最大 30 件ずつ取得し、ラウンドロビンで `limit` 件に絞って返します。
- 横断検索の `page` は 1 のみです。ページングしたい場合は個別 source を指定してください。

横断検索に含まれる source は次の 8 つです。

```text
ndl_catalog
ndl_digital
ndl_articles
ndl_articles_online
cinii_articles
cinii_books
jstage_articles
nihu_bridge
```

`ndl_search` / `irdb` / `jdcat` / `japan_search` / `kokkai_minutes` / `teikoku_minutes` は、目的がはっきりしているときに `source` を明示して使います。

### データ量を抑える設計

検索・詳細取得の基本ツールは軽量メタデータを返します。OCR 全文、ページ座標、図版情報、調査セッションの書き出しは専用ツールに分けています。

- 共通スキーマで扱える情報は `title` / `authors` / `issued_at` などのトップレベルに正規化します。
- source 固有の情報は `source_metadata` に保持します。
- 上流 API の生データや重い payload は `raw` やローカルキャッシュに退避します。

## Source 一覧

| source | 検索 API | 詳細 API | 横断 | 主な用途・注意点 |
| ------ | -------- | -------- | ---- | ---------------- |
| `ndl_catalog` | NDL Search SRU | NDL detail JSON | yes | NDL 蔵書・公共図書館等の書誌・所蔵。sort / facets 対応 |
| `ndl_digital` | NDL Search SRU + `dpid=ndl-dl` | NDL detail JSON | yes | デジコレ資料のメタデータ。OCR 利用可否は `next_digital_library` を確認 |
| `ndl_articles` | NDL Search SRU | NDL detail JSON | yes | 雑誌記事索引。詳細取得は CiNii CRID フォールバックあり |
| `ndl_articles_online` | NDL Search SRU | none | yes | オンライン採録記事の検索のみ。詳細取得は常に `null` |
| `ndl_search` | NDL Search SRU | NDL detail JSON | no | NDL Search 参加機関 100 以上の広域検索。存在確認・初動調査向き |
| `cinii_articles` | CiNii OpenSearch | CiNii JSON-LD | yes | 論文・記事。sort は `issued_date` のみ |
| `cinii_books` | CiNii OpenSearch | CiNii JSON-LD + holdings | yes | 大学図書館等の図書・雑誌所蔵。`holdings[]` を返す場合あり |
| `jstage_articles` | J-STAGE WebAPI | J-STAGE 記事 HTML meta | yes | 学協会誌。sort 未対応。PDF URL が取れる場合あり。詳細は best-effort |
| `irdb` | IRDB OpenSearch Atom | IRDB 詳細 HTML | no | 機関リポジトリ。`filters.irdb` 対応 |
| `jdcat` | JDCat JSON API | JDCat JSON API | no | 人文学・社会科学系の研究データ。論文・図書の既定横断には含めない |
| `nihu_bridge` | nihuBridge POST | nihuBridge REST | yes | 人文学系専門 DB 横断。`filters.nihu_bridge` 対応 |
| `japan_search` | Japan Search API | Japan Search API | no | 文化資源・美術・地域資料。最終確認は元機関 DB で行う |
| `kokkai_minutes` | 国会会議録 API speech | 国会会議録 API meeting | no | 第1回国会以降の発言検索 |
| `teikoku_minutes` | 帝国議会会議録 API speech | 帝国議会会議録 API meeting | no | 第1〜90回帝国議会の発言検索 |

## 共通スキーマ

### `SearchOutput`

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| `query` | string | 実行した検索語 |
| `source` | source \| null | 個別 source。横断検索では `null` |
| `page` | number | 取得ページ |
| `limit` | number | 返却上限 |
| `total` | number | この検索呼び出しでの総件数 |
| `items[]` | `SearchItem[]` | 検索結果 |
| `facets` | object | source が対応する場合のみ |
| `cache` | object | キャッシュ状態。`hit=true` の場合は過去保存データの再利用 |

`total` / `limit` / `page` は 1 回の MCP ツール呼び出し単位の値です。Skill が複数回検索して要約する場合は、各検索ごとに読んでください。

### `SearchItem` / `RecordItem`

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| `source` | source | 取得元 source |
| `source_id` | string | 詳細取得に渡す ID |
| `title` / `subtitle` / `title_reading` | string \| null | タイトル系フィールド |
| `authors[]` | `{name, role}[]` | 著者・発言者など |
| `publisher` | string \| null | 出版者・提供者 |
| `journal_title` | string \| null | 掲載誌名。best-effort の source あり |
| `issued_at` / `issued_at_label` | string \| null | 正規化日付と表示用日付 |
| `issued_at_precision` | `day` \| `month` \| `year` \| `unknown` | 日付精度 |
| `summary` | string \| null | 要約・抄録。source により空の場合あり |
| `url` | string \| null | 元レコード URL |
| `availability` | object | `{online, digital_collection}` |
| `material_type` | string \| null | 資料種別 |
| `subjects[]` | string[] | 件名 |
| `table_of_contents[]` | string[] | 目次。source により検索結果にも入る |
| `source_metadata` | object | source 固有情報。検索結果では分類情報などが入る場合あり |

`RecordItem` ではさらに `alternative_titles` / `publication_place` / `language` / `extent` / `identifiers` / `content_access` / `source_metadata` / `raw` を返します。

### `source_metadata` の代表例

| source | 主なフィールド |
| ------ | -------------- |
| NDL 系検索結果 | `classification.ndc`, `classification.ndlc` |
| `ndl_digital` | `next_digital_library`, `provider_id`, `provider_name` |
| `cinii_books` | `holding_count`, `holdings[]` |
| `jstage_articles` | `pdf_url`, `article_url` |
| `irdb` | `source_uri`, `repository_name`, `publication_type` |
| `kokkai_minutes` / `teikoku_minutes` | 会議・発言単位の識別情報 |

## MCP ツール

### 検索・詳細取得

#### `jp_lit_search`

日本語文献・資料を検索します。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `query` | string | 必須 | 検索キーワード |
| `source` | source | なし | 指定しない場合は既定横断検索 |
| `limit` | number | 横断 48 / 個別 50 | 最大 100 |
| `page` | number | 1 | 横断検索では 1 のみ |
| `sort_by` | string | なし | `title` / `creator` / `issued_date` / `created_date` / `modified_date` |
| `sort_order` | string | なし | `asc` / `desc` |
| `force_refresh` | boolean | `false` | `true` でキャッシュを無視して upstream 再検索 |
| `issued_from` | string | なし | 発行日・発言日の下限 |
| `issued_to` | string | なし | 発行日・発言日の上限 |
| `filters.irdb` | object | なし | `source=irdb` のときのみ |
| `filters.nihu_bridge` | object | なし | `source=nihu_bridge` のときのみ |
| `filters.jdcat` | object | なし | `source=jdcat` のときのみ |
| `filters.ndl` | object | なし | NDL 系 source のときのみ。件名・NDC・NDLC |

`sort_by` の対応状況:

- `ndl_search` / `ndl_catalog` / `ndl_digital` / `ndl_articles` / `ndl_articles_online`: 対応
- `cinii_articles` / `cinii_books`: `issued_date` のみ対応
- `japan_search`: `issued_from` / `issued_to` を `r-tempo` に変換
- `jstage_articles` / `irdb` / `jdcat` / `nihu_bridge`: 未対応

レスポンスの `cache`:

- `hit`: `true` ならキャッシュヒット
- `cache_key`: 該当キャッシュキー
- `saved_at`: キャッシュ保存時刻（ISO）
- `refresh_hint`: キャッシュヒット時の再検索導線メッセージ

`issued_from` / `issued_to` の対応状況:

- NDL 系: CQL の `dcterms.issued` 範囲条件に変換
- CiNii 系: `from` / `until` に変換
- J-STAGE: `pubyearfrom` / `pubyearto` に変換
- 国会・帝国議会: `from` / `until` に変換。年だけ渡した場合は年初・年末に補完
- NIHU Bridge: `filters.nihu_bridge.period_from` / `period_to` がない場合のみ自動マッピング
- Japan Search: 先頭 4 桁の年だけ使い、`r-tempo` に変換
- IRDB / JDCat: 未対応

`filters.irdb`:

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| `fulltext` | boolean | 全文ありに絞り込む |
| `title` | string | タイトル |
| `author` | string | 著者 |
| `keyword` | string | キーワード・件名 |
| `journal` | string | 掲載誌 |
| `publisher` | string | 出版者・機関 |

`filters.ndl`:

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| `subject` | string | 件名。CQL の `dcterms.subject` 条件に変換 |
| `ndc` | string | NDC。CQL の `dc.subject` 条件に変換 |
| `ndlc` | string | NDLC。`KH286` 形式は `http://id.ndl.go.jp/class/ndlc/KH286` に正規化 |

対応 source は `ndl_search` / `ndl_catalog` / `ndl_digital` / `ndl_articles` / `ndl_articles_online` です。

`filters.nihu_bridge`:

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| `institute` | string[] | `nijl` / `nmjh` / `ninjal` / `ircjs` / `rihn` / `nme` / `nihu` |
| `database` | string[] | DB ID |
| `normalize` | boolean | 異体字同定。`false` で明示的にオフ |
| `period_from` / `period_to` | string | 時期 |
| `bbox` | object | `{lat1, lon1, lat2, lon2}` |

`filters.jdcat`:

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| `subject` | string | 件名・トピック |
| `geographic` | string | 調査地域 |
| `contributor` | string | 配布機関 |
| `title` | string | タイトル |
| `temporal` | string | 調査時期 |
| `creator` | string | 作成者・調査機関 |

#### `jp_lit_get_record`

検索結果の詳細レコードを取得します。

| 引数 | 型 | 説明 |
| ---- | -- | ---- |
| `source` | source | 必須 |
| `source_id` | string | 必須 |

`source=ndl_digital` の場合、`source_metadata.next_digital_library` に OCR 系ツールの利用可否が入ります。

### 調べ方・類似事例

#### `jp_lit_search_kaken_projects`

KAKEN の研究課題を検索し、研究テーマ、キーワード、研究成果報告書 PDF、成果リストの手がかりを返します。文献検索 source ではなく、テーマ把握・検索語展開・報告書 PDF 到達のための補助ツールです。成果リストに論文・図書・学会発表が含まれる場合も、それらは文献候補として扱い、CiNii / J-STAGE / IRDB / NDL などで確認してください。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `query` | string | 必須 | 研究課題を探す検索語 |
| `limit` | number | 10 | 最大 20 |
| `page` | number | 1 | 1 始まり |
| `detail_limit` | number | 5 | 詳細ページを取得して報告書 PDF / 成果 preview を補完する件数。最大 10。`0` なら詳細未確認 |
| `researcher_name` | string | なし | 研究者名での絞り込み補助 |
| `from_fiscal_year` / `to_fiscal_year` | number | なし | 助成期間の範囲指定 |
| `include_outputs` | boolean | true | 成果 preview を返すか |

返り値では `detail_fetched` / `detail_omitted_reason` / `report_pdf_status` を必ず確認してください。`report_pdf_status="not_checked"` は PDF が無いという意味ではなく、詳細取得を省略した状態です。

このツールは KAKEN OpenSearch API を使うため、`CINII_RESEARCH_APP_ID` が必要です。CiNii Research / CiNii Books と同じ NII / CiNii 系の appid を利用します。

#### `jp_lit_search_guides_manuals`

レファレンス協同データベースの調べ方マニュアルを検索します。書誌候補そのものではなく、どの資料・索引・参考図書から始めるかの手がかりを得るためのツールです。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `query` | string | 必須 | 調べたいテーマ |
| `limit` | number | 10 | 最大 20 |
| `page` | number | 1 | 1 始まり |
| `lib_id` | string | なし | 特定館コード |
| `lib_group` | string | なし | `public` / `univ` / `special` / `school` / `archive` / `ndl` / `other` |

返り値では `search_keywords` / `guide_headings` を次の検索語作成に使います。

#### `jp_lit_search_guides_cases`

レファレンス協同データベースのレファレンス事例を検索します。類似質問、回答プロセス、参考資料を調査の次の一手として参照します。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `query` | string | 必須 | 類似事例を探したいテーマ・語句 |
| `limit` | number | 10 | 最大 20 |
| `page` | number | 1 | 1 始まり |
| `lib_id` | string | なし | 特定館コード |
| `lib_group` | string | なし | `public` / `univ` / `special` / `school` / `archive` / `ndl` / `other` |

返り値では `answer_process` / `reference_sources` を確認します。

### NDL デジタルコレクション OCR・図版

OCR 系ツールはインターネット公開資料のみ対応します。`source_id` 経由で呼ぶ場合は、先に `jp_lit_get_record(source=ndl_digital, source_id=...)` で `source_metadata.next_digital_library.available=true` を確認してください。`jp_lit_search_fulltext` / `jp_lit_search_illustrations` の結果に含まれる `pid` は、そのまま OCR 系ツールへ渡せます。

#### `jp_lit_search_fulltext`

次世代デジタルライブラリー全資料を OCR 全文テキストから検索します。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `keyword` | string | 必須 | 検索語 |
| `searchfield` | string | `contentonly` | `contentonly` / `metaonly` / `all` |
| `size` | number | 20 | 最大 100 |
| `from` | number | 0 | オフセット |
| `f_ndc` | string | なし | NDC 分類 |
| `fc_is_classic` | boolean | なし | 古典籍資料 |

主な出力は `pid` / `viewer_url` / `title` / `responsibility` / `publisher` / `published` / `publishyear` / `ndc` / `bib_id` / `call_no` / `page_count` / `is_classic` / `highlights` です。

#### `jp_lit_search_pages`

特定資料内のページを OCR 全文から検索します。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `source` | source | 必須 | `ndl_digital` のみ |
| `source_id` | string | なし | `pid` と排他 |
| `pid` | string | なし | `source_id` と排他 |
| `keyword` | string | 必須 | 検索語 |
| `size` | number | 20 | 最大 100 |
| `from` | number | 0 | オフセット |

#### `jp_lit_get_text_coordinates`

特定ページの OCR テキスト、座標、ページ画像 URL を取得します。

| 引数 | 型 | 説明 |
| ---- | -- | ---- |
| `source` | source | `ndl_digital` のみ |
| `source_id` | string | `pid` と排他 |
| `pid` | string | `source_id` と排他 |
| `page` | number | 必須 |

出力の `page_image_url` は IIIF 画像 URL です。`coordjson` の座標はフルサイズ画像のピクセル座標なので、リサイズ画像で使う場合はスケーリングが必要です。

#### `jp_lit_get_fulltext`

特定資料の全ページ OCR JSON を取得します。

| 引数 | 型 | 説明 |
| ---- | -- | ---- |
| `source` | source | `ndl_digital` のみ |
| `source_id` | string | `pid` と排他 |
| `pid` | string | `source_id` と排他 |

出力は `pid` / `pages` / `raw` です。大きい資料では返却が重くなることがあります。

#### `jp_lit_search_illustrations`

次世代デジタルライブラリー全資料の図版・挿絵をテキストキーワードで検索します。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `keyword` | string | 必須 | 検索語 |
| `size` | number | 20 | 最大 100 |
| `from` | number | 0 | オフセット |

`items[]` には `pid` / `page` / `x` / `y` / `w` / `h` / `graphictags` / `page_image_url` / `illustration_image_url` が含まれます。`illustration_image_url` は IIIF `pct:x,y,w,h` で図版部分を切り出した直リンクです。

### 典拠・分類補助

#### `jp_lit_resolve_authority`

Web NDL Authorities を使って、人名・団体名・件名などの典拠候補を確認します。文献そのものを検索する source ではなく、検索語展開・別名義確認・件名確認のための補助ツールです。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `query` | string | 必須 | 典拠検索語 |
| `type` | string | `all` | `person` / `corporate` / `subject` / `uniform_title` / `genre` / `all` |
| `limit` | number | `5` | 最大 20 |

人名・団体名では、同一人物・同一団体の別名義を `same_identity_names` に入れます。色川武大のように筆名が別典拠としてリンクされている場合、`阿佐田, 哲也` などは `same_identity_names[].relation="pseudonym"` として返ります。

件名では、上位語・下位語・関連語を `broader_terms` / `narrower_terms` / `related_terms` に分けます。これらは検索範囲を広げる可能性があるため、`search_hints.reference_terms` として参考扱いにします。

#### `jp_lit_find_authority_terms_by_classification`

Web NDL Authorities を使って、NDC などの分類から対応する件名標目を探します。分類しか分からない分野で、未知の本を探すための探索語候補を得る補助ツールです。特に古い図書では件名が付与されていない場合があるため、分類は主題探索の重要な入口になります。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `classification` | string | 必須 | 分類記号。例: `596.7` |
| `scheme` | string | `NDC10` | `NDC10` / `NDC9` / `NDC8` / `NDC6` |
| `limit` | number | `20` | 最大 50 |

分類から得た件名標目は正解リストではなく探索語候補です。分類範囲が広い場合や NDC の版が異なる場合は、調査意図に合わせて絞り込んでください。実際の文献検索では、分類前方一致、出版年、所蔵場所、資料種別などとの掛け合わせが有効です。

### 調査セッション

検索結果や詳細取得結果はキャッシュに保存され、候補の選別結果はセッションに保存できます。重い OCR / 全文 / 図版 payload は session 側に重複保存せず、cache key 参照で扱います。

#### `jp_lit_annotate_session`

既存の検索・書誌取得結果に候補ラベルとメモを保存します。

| 引数 | 型 | 説明 |
| ---- | -- | ---- |
| `tool` | string | 対象ツール名 |
| `cache_key` | string | 対象キャッシュキー |
| `selected_items[]` | array | 採用候補 |
| `selected_items[].label` | string | `confirmed` / `strong_candidate` / `weak_candidate` |
| `notes[]` | string[] | 任意の調査メモ |

#### `jp_lit_export_session`

現在の調査セッション、または `session_id` で指定した過去セッションを `exports/` に書き出します。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `session_id` | string | 現在のセッション | `YYYY-MM-DD-HHMMSS` |
| `format` | string | `markdown` | `markdown` / `json` / `csl-json` |
| `profile` | string | `full_log` | `full_log` / `selected` / `unselected` |
| `output_path` | string | 自動 | 出力先 |
| `include_unselected` | boolean | true | 未採用候補を含めるか |

`format="csl-json"` は、文献管理・引用処理ツールへ渡すための CSL JSON 配列を書き出します。`profile="selected"` で確認済み・候補化した文献だけを書き出す使い方を推奨します。CSL JSON では `profile="full_log"` でも未採用候補を混ぜず、未採用候補だけを確認したい場合は `profile="unselected"` を指定します。RIS / BibTeX が必要な場合は、Zotero や変換ツール側で変換してください。

#### `jp_lit_export_view`

キャッシュ系ビュー結果を直接 `exports/` に書き出します。`jp_lit_list_cache` / `jp_lit_search_cache_index` / `jp_lit_refine_results` の実行結果をその場で Markdown または JSON 化できます。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `view` | string | 必須 | `cache_list` / `cache_query` / `refined_results` |
| `params` | object | ビューごと | 選択したビューに対応する入力。`cache_list` は `jp_lit_list_cache`、`cache_query` は `jp_lit_search_cache_index`、`refined_results` は `jp_lit_refine_results` の入力をそのまま渡す |
| `format` | string | `markdown` | `markdown` / `json` |
| `export_all` | boolean | false | `refined_results` で全件をページングして書き出す |
| `duplicate_notes` | boolean | false | `refined_results` に重複クラスタ確認欄を含める |
| `output_path` | string | 自動 | 出力先（未指定時は `exports/{view}.{timestamp}.{ext}`） |

返り値の `item_count` は、`cache_list` / `cache_query` では `total`、`refined_results` では `total_after` を使います。
`duplicate_notes=true` は全件確認用の作業台です。CSL JSON へ渡す候補を整える前に、Markdown / JSON で重複候補を確認し、採用する項目を `jp_lit_annotate_session` に保存してから `jp_lit_export_session(format="csl-json", profile="selected")` を使う流れを推奨します。

#### `jp_lit_find_sessions`

過去セッションを検索します。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `query` | string | 必須 | 主題・キーワード・候補タイトル・メモの検索語 |
| `limit` | number | 10 | 最大 50 |

返り値の `matched_fields` は `query` / `selected_title` / `notes` のいずれかです。

## 代表的な呼び出し順

### メタデータ検索から詳細取得

```text
jp_lit_search(source=ndl_catalog, query="...")
  -> items[].source_id
jp_lit_get_record(source=ndl_catalog, source_id="...")
```

### デジコレ書誌から OCR へ進む

```text
jp_lit_search(source=ndl_digital, query="...")
  -> items[].source_id
jp_lit_get_record(source=ndl_digital, source_id="...")
  -> source_metadata.next_digital_library.available を確認
jp_lit_get_text_coordinates(source=ndl_digital, source_id="...", page=N)
```

### 全文検索からページ画像へ進む

```text
jp_lit_search_fulltext(keyword="大政奉還")
  -> items[].pid
jp_lit_search_pages(source=ndl_digital, pid="...", keyword="大政奉還")
  -> items[].page
jp_lit_get_text_coordinates(source=ndl_digital, pid="...", page=N)
```

### 図版検索から画像 URL を使う

```text
jp_lit_search_illustrations(keyword="富士山")
  -> items[].illustration_image_url
```

## `next_digital_library`

`jp_lit_get_record(source=ndl_digital)` の `source_metadata.next_digital_library` は、次世代デジタルライブラリー側の OCR ツール利用可否を表します。

```json
{
  "pid": "897115",
  "available": true,
  "reason": null,
  "book_api_url": "...",
  "total_page": 12,
  "public_domain": true,
  "online_pdf": false
}
```

| フィールド | 型 | 説明 |
| ---------- | -- | ---- |
| `pid` | string | 次世代デジタルライブラリー PID |
| `available` | boolean | OCR 系ツールを使えるか |
| `reason` | string \| null | 利用不可理由。現状は主に `not_available_in_next_digital_library` |
| `book_api_url` | string | `/book/{pid}` エンドポイント |
| `total_page` | number \| null | 総ページ数 |
| `public_domain` | boolean \| null | パブリックドメイン判定 |
| `online_pdf` | boolean \| null | PDF 一括ダウンロード可否 |

`available=false` は、実務上は次世代側未収録であることが多いですが、アクセス制限や上流都合との厳密な区別はしていません。PID を解決できない場合は `next_digital_library` 自体が `null` になります。

## 環境変数

通常利用では、各 source の base URL を設定する必要はありません。次の環境変数は、上流 API の URL を明示・上書きしたい場合や、テスト環境・プロキシを使う場合のためのものです。`CINII_RESEARCH_APP_ID` は CiNii の安定利用に推奨し、KAKEN API tool では必須です。

| 変数 | 既定値 | 説明 |
| ---- | ------ | ---- |
| `NDL_SEARCH_BASE_URL` | `https://ndlsearch.ndl.go.jp/api/sru` | `ndl_search` / `ndl_catalog` / `ndl_articles` / `ndl_articles_online` |
| `NDL_DIGITAL_BASE_URL` | `https://ndlsearch.ndl.go.jp/api/sru` | `ndl_digital`。`dpid=ndl-dl` は adapter 側で付与 |
| `NEXT_DIGITAL_LIBRARY_BASE_URL` | `https://lab.ndl.go.jp/dl/api` | 次世代デジタルライブラリー API |
| `CINII_RESEARCH_BASE_URL` | `https://cir.nii.ac.jp/opensearch/articles` | CiNii 系検索 |
| `CINII_RESEARCH_RECORD_BASE_URL` | `https://cir.nii.ac.jp/crid` | CiNii 系詳細 |
| `CINII_BOOKS_HOLDINGS_BASE_URL` | `https://ci.nii.ac.jp/books/opensearch/holder` | CiNii Books 所蔵 |
| `CINII_RESEARCH_APP_ID` | なし | CiNii 安定利用に推奨。KAKEN API tool では必須。実値はシークレット経由で渡す |
| `JSTAGE_BASE_URL` | `https://api.jstage.jst.go.jp/searchapi/do` | J-STAGE 検索 |
| `JSTAGE_ARTICLE_BASE_URL` | `https://www.jstage.jst.go.jp` | J-STAGE 記事ページ HTML 詳細 |
| `JAPAN_SEARCH_BASE_URL` | `https://jpsearch.go.jp/api/item/search/jps-cross` | Japan Search 検索 |
| `JAPAN_SEARCH_ITEM_BASE_URL` | `https://jpsearch.go.jp/api/item` | Japan Search 詳細 |
| `IRDB_SEARCH_BASE_URL` | `https://irdb.nii.ac.jp/opensearch/search` | IRDB 検索 |
| `IRDB_DETAIL_BASE_URL` | `https://irdb.nii.ac.jp` | IRDB 詳細 |
| `JDCAT_BASE_URL` | `https://jdcat.jsps.go.jp` | JDCat 検索・詳細 |
| `KOKKAI_SPEECH_BASE_URL` | `https://kokkai.ndl.go.jp/api/speech` | 国会会議録検索 |
| `KOKKAI_MEETING_BASE_URL` | `https://kokkai.ndl.go.jp/api/meeting` | 国会会議録詳細 |
| `TEIKOKU_SPEECH_BASE_URL` | `https://teikokugikai-i.ndl.go.jp/api/emp/speech` | 帝国議会検索 |
| `TEIKOKU_MEETING_BASE_URL` | `https://teikokugikai-i.ndl.go.jp/api/emp/meeting` | 帝国議会詳細 |
| `NIHU_BRIDGE_SEARCH_URL` | `https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/search` | NIHU Bridge 検索 |
| `NIHU_BRIDGE_RECORD_BASE_URL` | `https://api.bridge.nihu.jp/v1/integratedsearch/metadatas` | NIHU Bridge 詳細 |
| `CRD_API_BASE_URL` | `https://crd.ndl.go.jp/api/refsearch` | レファレンス協同データベース API |
| `NDL_AUTHORITIES_SPARQL_URL` | `https://id.ndl.go.jp/auth/ndla/sparql` | Web NDL Authorities SPARQL endpoint |

`NDL_SEARCH_BASE_URL` / `NDL_DIGITAL_BASE_URL` は `/api/sru` / `/api/opensearch` / `/api/bib/external/search` のどれを渡しても内部で正規化します。

## MCP 登録例

通常は `CINII_RESEARCH_APP_ID` だけ設定すれば十分です。KAKEN tool を使わない場合は `env` ごと省略できます。

```json
{
  "mcpServers": {
    "jp-lit": {
      "command": "npx",
      "args": ["-y", "jp-lit-mcp"],
      "env": {
        "CINII_RESEARCH_APP_ID": "your-cinii-app-id"
      }
    }
  }
}
```

サンプルは [mcp-config.example.json](../mcp-config.example.json) にあります。アプリ別の登録手順は `docs/install/` 以下を参照してください。

## CLI 診断

導入環境の切り分けには、軽量 `doctor` コマンドを使えます。

```bash
npx -y jp-lit-mcp doctor
```

`doctor` は Node.js、パッケージバージョン、MCP entrypoint、同梱 Skills、cache / exports への書き込み、`CINII_RESEARCH_APP_ID` の有無を確認します。外部 DB への live API アクセスは行いません。

## ローカル保存

このサーバーは、検索結果や書誌取得結果を repo 内へローカル保存できます。標準的な想定は、利用者が自分の端末で調査を継続するためのローカルキャッシュです。公開サービス・共有サーバ・クラウド上の常設 bot として複数利用者に提供する場合は、source ごとの保存条件を [データ利用条件メモ](source-usage-conditions.md) で確認してください。

| 種別 | 保存先 | 内容 |
| ---- | ------ | ---- |
| キャッシュ | `.cache/jp-lit-mcp/cache/v1/` | 各ツールの `structuredContent` と重い payload |
| セッション | `.cache/jp-lit-mcp/sessions/` | 採用候補、候補ラベル、短いメモ、検索全体のメモ |
| エクスポート | `exports/` | 明示的に書き出した Markdown / JSON / CSL JSON |

明示的に export しない限り、保存物は内部ファイルとしてのみ保持されます。

## 開発・検証コマンド

| 目的 | コマンド |
| ---- | -------- |
| 開発実行 | `npm run dev` |
| テスト | `npm test` |
| 型ビルド | `npm run build` |
| MCP smoke check（API 疎通なし） | `npm run smoke:mcp` |
| CLI doctor | `npx -y jp-lit-mcp doctor` |
| live smoke matrix | `npm run smoke:mcp:live-matrix` |

PowerShell で live smoke check を単発実行する例:

```powershell
$env:SMOKE_LIVE="1"; npm run smoke:mcp
```

live smoke の主な環境変数:

- `SMOKE_LIVE_SOURCE`: 対象 source。既定は `ndl_catalog`
- `SMOKE_LIVE_QUERY`: 検索語。既定は `菊池寛`
- `SMOKE_LIVE_SOURCES`: matrix 対象 source のカンマ区切り指定
- `SMOKE_LIVE_RETRY_COUNT`: source ごとの retry 回数。既定は `2`
- `SMOKE_LIVE_REPORT_PATH`: matrix レポート出力先。既定は `exports/live-smoke-report.json`

`SMOKE_LIVE_SOURCE=ndl_digital` のときは、`next_digital_library.available=true` の資料があれば OCR 系ツールも検証します。`SMOKE_LIVE_SOURCE=cinii_books` のときは `holding_count` / `holdings[]` も確認します。`jdcat` は upstream `503 Service Temporarily Unavailable` のときだけ skip 扱いにします。

## 既知の制約

- `ndl_digital` は独立 API ではなく `NDL Search SRU + dpid=ndl-dl` を使います。
- KAKEN は `jp_lit_search` の source ではありません。`jp_lit_search_kaken_projects` は研究課題・報告書 PDF・成果リストの入口であり、成果リスト中の文献確定には使いません。
- 次世代デジタルライブラリー API と OCR 系ツールはインターネット公開資料のみ対象です。
- `ndl_search` は広域・初動向きです。CiNii / J-STAGE はハーベスト済みメタデータのため情報が薄く、NIHU Bridge は対象外です。
- `ndl_articles_online` は検索のみ対応です。`jp_lit_get_record` は常に `null` になります。
- `ndl_articles` の `journal_title` は `dc:description` の `掲載誌：...` からの best-effort 抽出です。巻号が混入することがあります。
- `ndl_articles` の巻・号・頁は `RecordItem.source_metadata` のみに入ります。
- `ndl_digital` の detail 判定は安全側です。`source_metadata.provider_id` が `null` のまま返ることがあります。
- `cinii_articles` / `cinii_books` の sort は `issued_date` のみ対応です。
- `jstage_articles` は現行の `sort_by` / `sort_order` に対応していません。
- `jstage_articles` の `summary` は常に `null` です。J-STAGE WebAPI はアブストラクトを返しません。
- `jstage_articles` の detail は J-STAGE 記事ページ HTML の `citation_*` meta を使う best-effort 抽出です。
- `japan_search` は横断ポータル source のため、既定横断検索には含めていません。
- `japan_search` の `issued_from` / `issued_to` は年単位へ丸めます。
- `irdb` は既定横断検索に含めていません。
- `irdb` の上流 `count` は `20` / `50` / `100` だけ有効です。adapter 側で `limit` を補正します。
- `irdb` の detail は IRDB 詳細画面 HTML を使います。原機関側 URI は `source_metadata.source_uri` に保持します。
- `issued_from` / `issued_to` は `irdb` / `jdcat` では未対応です。
- `jdcat` は研究データカタログであり、既定横断検索には含めていません。
- `filters.jdcat` は JDCat（WEKO3）の API パラメータに依存しています。
- `jdcat` は公開 JSON API `/api/records/` と `/api/records/{id}` を使います。
- `jdcat` の `availability.online=true` は配布元 URI が示されていることを意味し、データ本体が無条件公開されている保証ではありません。
- `nihu_bridge` の sort は現時点で未対応です。

### `jp_lit_refine_results`

保存済みの `jp_lit_search` 結果を upstream 再検索せずに再抽出します。単一結果の再ソート/再フィルタだけでなく、複数キャッシュの集合演算にも対応します。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `cache_key` | string | なし | 単一の対象キャッシュ |
| `cache_keys` | string[] | なし | 複数キャッシュを明示指定 |
| `session_id` | string | なし | 指定セッション内の `jp_lit_search` 結果をまとめて対象化 |
| `combine` | string | `union` | `union` / `intersection` / `minus` |
| `key_by` | string | `source_record` | 集合演算キー。`source_record` / `duplicate_key` / `title_author_year` |
| `sort_by` | string | なし | `issued_at` / `title` |
| `sort_order` | string | `asc` | `asc` / `desc` |
| `limit` | number | 30 | 最大 200 |
| `offset` | number | 0 | 先頭スキップ件数 |
| `include_duplicate_clusters` | boolean | false | 重複候補クラスタを返す |
| `cluster_limit` | number | 20 | 返すクラスタ数 |
| `cluster_offset` | number | 0 | クラスタの先頭スキップ件数 |
| `cluster_member_limit` | number | 5 | 各クラスタで返す member preview 件数 |
| `filters` | object | なし | `source` / `issued_from` / `issued_to` / `online` / `digital_collection` / `title_contains` / `author_contains` |

`combine=minus` は「先頭集合 - 後続集合」の差集合です。
既定では、整理後の結果を会話で扱いやすくするため先頭 30 件だけ返します。全体件数は `total_after` で把握し、全件が必要な場合は `limit` を増やすか `jp_lit_export_view(view="refined_results", ...)` で書き出してください。

重複クラスタは通常の再整理では返しません。必要なときだけ `include_duplicate_clusters=true` を指定します。クラスタは自動削除ではなく、`duplicate_key` と title/author/year の近似一致から候補を示すものです。`search_result_readiness` は検索結果レベルのメタデータ充足度であり、引用確定には `jp_lit_get_record` や現物確認が必要です。

### `jp_lit_search_cache_index`

保存済み `jp_lit_search` キャッシュを横断検索し、再抽出に使える `cache_key` 群を返します。返された `cache_keys` はそのまま `jp_lit_refine_results(cache_keys=[...])` に渡せます。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `query` | string | 必須 | キャッシュ検索語 |
| `session_id` | string | なし | 対象セッションを限定 |
| `source` | source | なし | キャッシュの source で絞り込み |
| `issued_from` | string | なし | `items[].issued_at` の下限 |
| `issued_to` | string | なし | `items[].issued_at` の上限 |
| `saved_on` | string | なし | キャッシュ保存日（`YYYY-MM-DD` / `today` / `yesterday` / `last_7_days`） |
| `saved_from` | string | なし | キャッシュ保存日時の下限（ISO 文字列） |
| `saved_to` | string | なし | キャッシュ保存日時の上限（ISO 文字列） |
| `limit` | number | 50 | 最大 200 |

`saved_on` ショートハンドはサーバー側で `Asia/Tokyo` 基準に解決されます。`saved_on` を指定した場合、出力には解決後の日付（`saved_on_resolved`）も含まれます。

出力には `cache_keys[]` と、各キャッシュの `matched_fields`（`query` / `title` / `author` / `subject` / `source_id`）が含まれます。

### `jp_lit_delete_cache`

ローカルキャッシュを削除します。単体削除または tool 単位の一括削除に対応します。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `tool` | string | `jp_lit_search` | 対象ツール |
| `cache_key` | string | なし | 単体削除対象 |
| `clear_all` | boolean | `false` | `true` で対象 tool のキャッシュを一括削除 |

### `jp_lit_prune_cache`

古いローカルキャッシュの削除候補を列挙し、`dry_run=false` のときだけ削除します。既定では削除せず候補確認だけを行います。対象は `.cache/jp-lit-mcp/cache/v1/` と旧保存先 `.cache/ndl-jp-lit-mcp/cache/v1/` の cache ファイルで、セッションや `exports/` は削除しません。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `older_than_days` | number | `30` | この日数より古い cache を候補にする |
| `tool` | string | なし | 対象ツール（未指定なら全 tool） |
| `dry_run` | boolean | `true` | `true` なら候補表示のみ。削除する場合は `false` |
| `limit` | number | `100` | 最大 1000 |

出力には `matched_count`、`pruned_count`、`total_bytes`、`candidates[]`、読み取りをスキップしたファイル数 `skipped_count` が含まれます。壊れた JSON や tool ディレクトリ名と cache 内 metadata が一致しないファイルは削除対象にせず、`skipped[]` に理由を返します。

### `jp_lit_list_cache`

ローカルキャッシュの一覧と集計を返します。作成日・source・session で絞り込めます。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `tool` | string | なし | 対象ツール（未指定なら全 tool） |
| `session_id` | string | なし | 対象セッションを限定 |
| `saved_on` | string | なし | キャッシュ保存日（`YYYY-MM-DD` / `today` / `yesterday` / `last_7_days`） |
| `saved_from` | string | なし | キャッシュ保存日時の下限（ISO 文字列） |
| `saved_to` | string | なし | キャッシュ保存日時の上限（ISO 文字列） |
| `source` | source | なし | 検索系キャッシュの source で絞り込み |
| `limit` | number | 100 | 最大 500 |

`saved_on` ショートハンドはサーバー側で `Asia/Tokyo` 基準に解決されます。`saved_on` を指定した場合、出力には解決後の日付（`saved_on_resolved`）も含まれます。
