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
| `jstage_articles` | J-STAGE WebAPI | J-STAGE WebAPI | yes | 学協会誌。sort 未対応。PDF URL が取れる場合あり |
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
| `format` | string | `markdown` | `markdown` / `json` |
| `profile` | string | `full_log` | `full_log` / `selected` / `unselected` |
| `output_path` | string | 自動 | 出力先 |
| `include_unselected` | boolean | true | 未採用候補を含めるか |

#### `jp_lit_export_view`

キャッシュ系ビュー結果を直接 `exports/` に書き出します。`jp_lit_list_cache` / `jp_lit_search_cache_index` / `jp_lit_refine_results` の実行結果をその場で Markdown または JSON 化できます。

| 引数 | 型 | 既定 | 説明 |
| ---- | -- | ---- | ---- |
| `view` | string | 必須 | `cache_list` / `cache_query` / `refined_results` |
| `params` | object | ビューごと | 選択したビューに対応する入力。`cache_list` は `jp_lit_list_cache`、`cache_query` は `jp_lit_search_cache_index`、`refined_results` は `jp_lit_refine_results` の入力をそのまま渡す |
| `format` | string | `markdown` | `markdown` / `json` |
| `output_path` | string | 自動 | 出力先（未指定時は `exports/{view}.{timestamp}.{ext}`） |

返り値の `item_count` は、`cache_list` / `cache_query` では `total`、`refined_results` では `total_after` を使います。

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

通常利用では、各 source の base URL を設定する必要はありません。次の環境変数は、上流 API の URL を明示・上書きしたい場合や、テスト環境・プロキシを使う場合のためのものです。`CINII_RESEARCH_APP_ID` は CiNii の安定利用に推奨します。

| 変数 | 既定値 | 説明 |
| ---- | ------ | ---- |
| `NDL_SEARCH_BASE_URL` | `https://ndlsearch.ndl.go.jp/api/sru` | `ndl_search` / `ndl_catalog` / `ndl_articles` / `ndl_articles_online` |
| `NDL_DIGITAL_BASE_URL` | `https://ndlsearch.ndl.go.jp/api/sru` | `ndl_digital`。`dpid=ndl-dl` は adapter 側で付与 |
| `NEXT_DIGITAL_LIBRARY_BASE_URL` | `https://lab.ndl.go.jp/dl/api` | 次世代デジタルライブラリー API |
| `CINII_RESEARCH_BASE_URL` | `https://cir.nii.ac.jp/opensearch/articles` | CiNii 系検索 |
| `CINII_RESEARCH_RECORD_BASE_URL` | `https://cir.nii.ac.jp/crid` | CiNii 系詳細 |
| `CINII_BOOKS_HOLDINGS_BASE_URL` | `https://ci.nii.ac.jp/books/opensearch/holder` | CiNii Books 所蔵 |
| `CINII_RESEARCH_APP_ID` | なし | CiNii 安定利用に推奨。実値はシークレット経由で渡す |
| `JSTAGE_BASE_URL` | `https://api.jstage.jst.go.jp/searchapi/do` | J-STAGE 検索 |
| `JSTAGE_ARTICLE_BASE_URL` | `https://www.jstage.jst.go.jp` | J-STAGE 詳細 |
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

`NDL_SEARCH_BASE_URL` / `NDL_DIGITAL_BASE_URL` は `/api/sru` / `/api/opensearch` / `/api/bib/external/search` のどれを渡しても内部で正規化します。

## MCP 登録例

通常は `CINII_RESEARCH_APP_ID` だけ設定すれば十分です。設定しない場合は `env` ごと省略できます。

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

## ローカル保存

このサーバーは、検索結果や書誌取得結果を repo 内へローカル保存できます。

| 種別 | 保存先 | 内容 |
| ---- | ------ | ---- |
| キャッシュ | `.cache/jp-lit-mcp/cache/v1/` | 各ツールの `structuredContent` と重い payload |
| セッション | `.cache/jp-lit-mcp/sessions/` | 採用候補、候補ラベル、短いメモ、検索全体のメモ |
| エクスポート | `exports/` | 明示的に書き出した Markdown / JSON |

明示的に export しない限り、保存物は内部ファイルとしてのみ保持されます。

## 開発・検証コマンド

| 目的 | コマンド |
| ---- | -------- |
| 開発実行 | `npm run dev` |
| テスト | `npm test` |
| 型ビルド | `npm run build` |
| MCP smoke check（API 疎通なし） | `npm run smoke:mcp` |
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
- 次世代デジタルライブラリー API と OCR 系ツールはインターネット公開資料のみ対象です。
- `ndl_search` は広域・初動向きです。CiNii / J-STAGE はハーベスト済みメタデータのため情報が薄く、NIHU Bridge は対象外です。
- `ndl_articles_online` は検索のみ対応です。`jp_lit_get_record` は常に `null` になります。
- `ndl_articles` の `journal_title` は `dc:description` の `掲載誌：...` からの best-effort 抽出です。巻号が混入することがあります。
- `ndl_articles` の巻・号・頁は `RecordItem.source_metadata` のみに入ります。
- `ndl_digital` の detail 判定は安全側です。`source_metadata.provider_id` が `null` のまま返ることがあります。
- `cinii_articles` / `cinii_books` の sort は `issued_date` のみ対応です。
- `jstage_articles` は現行の `sort_by` / `sort_order` に対応していません。
- `jstage_articles` の `summary` は常に `null` です。J-STAGE WebAPI はアブストラクトを返しません。
- `japan_search` は横断ポータル source のため、既定横断検索には含めていません。
- `japan_search` の `issued_from` / `issued_to` は年単位へ丸めます。
- `irdb` は既定横断検索に含めていません。
- `irdb` の上流 `count` は `20` / `50` / `100` だけ有効です。adapter 側で `limit` を補正します。
- `irdb` の detail は IRDB 詳細画面 HTML を使います。原機関側 URI は `source_metadata.source_uri` に保持します。
- `issued_from` / `issued_to` は `irdb` / `jdcat` では未対応です。
- `jdcat` は研究データカタログであり、既定横断検索には含めていません。
- `filters.jdcat` は JDCat（WEKO3）の非公式 API パラメータに依存しています。
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
| `filters` | object | なし | `source` / `issued_from` / `issued_to` / `online` / `digital_collection` / `title_contains` / `author_contains` |

`combine=minus` は「先頭集合 - 後続集合」の差集合です。
既定では、整理後の結果を会話で扱いやすくするため先頭 30 件だけ返します。全体件数は `total_after` で把握し、全件が必要な場合は `limit` を増やすか `jp_lit_export_view(view="refined_results", ...)` で書き出してください。

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
