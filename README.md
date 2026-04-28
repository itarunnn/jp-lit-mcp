# ndl-jp-lit-mcp

NDL Search、NDL デジタルコレクション、CiNii Research、J-STAGE、Japan Search、JDCat、nihu_bridge（NIHU 統合検索）を対象にした日本語文献探索向け MCP サーバーです。NDL 系 source の検索は SRU API を使います。`ndl_digital` は `NDL Search SRU + dpid=ndl-dl` を使い、次世代デジタルライブラリー API（`lab.ndl.go.jp/dl/api`）への bridge を通じて OCR・全文検索・図版検索にも対応しています。

## セットアップ

```bash
npm install
```

## 公開ツール（7種）

| ツール | 概要 | 対応 source |
|--------|------|------------|
| `jp_lit_search` | 横断検索・source 指定検索 | 全 source |
| `jp_lit_get_record` | 書誌詳細取得 | 全 source |
| `jp_lit_get_text_coordinates` | ページ単位 OCR + 座標 + 画像 URL | `ndl_digital` のみ |
| `jp_lit_get_fulltext` | 資料単位 全文 OCR | `ndl_digital` のみ |
| `jp_lit_search_pages` | 資料内ページ全文検索 | `ndl_digital` のみ |
| `jp_lit_search_fulltext` | デジコレ全資料を OCR 全文からキーワード検索 | `ndl_digital` のみ |
| `jp_lit_search_illustrations` | デジコレ全資料の図版・挿絵をテキストキーワードで検索 | `ndl_digital` のみ |

### アクセス制限について

`jp_lit_search(source=ndl_digital)` は館内限定・図書館送信資料を含むすべてのメタデータを返します。OCR 系ツール（`jp_lit_get_text_coordinates` / `jp_lit_get_fulltext` / `jp_lit_search_pages`）はインターネット公開資料のみ対応です。`source_id` 経由で呼ぶ場合は事前に `jp_lit_get_record` で `source_metadata.next_digital_library.available=true` を確認してください。`jp_lit_search_fulltext` / `jp_lit_search_illustrations` の結果 `pid` はインターネット公開済みのため確認不要です。

## 対応 source（15種）

| source | 概要 | 推奨 |
|--------|------|------|
| `ndl_catalog` | NDL 蔵書 | ✓ |
| `ndl_digital` | NDL デジタルコレクション | ✓ |
| `ndl_articles` | NDL 雑誌記事索引 | ✓ |
| `ndl_articles_online` | NDL 雑誌記事索引オンライン版 | |
| `ndl_search` | NDL Search 全体（互換 source） | |
| `irdb` | 学術機関リポジトリデータベース | |
| `jdcat` | 人文学・社会科学総合データカタログ | |
| `nihu_bridge` | nihuBridge 統合検索（NIHU 7機関 100+ DB） | ✓ |
| `cinii_articles` | CiNii 論文 | ✓ |
| `cinii_books` | CiNii 図書 | ✓ |
| `jstage_articles` | J-STAGE 論文 | ✓ |
| `japan_search` | Japan Search（横断検索の既定対象外） | |
| `kokkai_minutes` | 国会会議録（第1回国会〜現在） | |
| `teikoku_minutes` | 帝国議会会議録（第1〜90回、1890〜1947年） | |

source 未指定の横断検索対象: `ndl_catalog` / `ndl_digital` / `ndl_articles` / `ndl_articles_online` / `cinii_articles` / `cinii_books` / `jstage_articles` / `nihu_bridge`

## 実装状況

テスト 229 件すべて通過。`npm test` / `npm run build` / `npm run smoke:mcp` が通る状態を維持。

### 検索パラメータ

- `limit` 上限 **100 件**。デフォルトは横断検索 **48 件**・個別検索 **50 件**
- 横断検索（source 未指定）: 各 source から内部で **30 件**取得（8 source × 30 = 最大240件プール）→ ラウンドロビンで `limit` 件に絞って返す
- `nihu_bridge` を横断検索対象に追加（2026-04-28）

### source 別の実装メモ

| source | 検索 API | 詳細 API | 横断検索 | 備考 |
|--------|---------|---------|---------|------|
| `ndl_catalog` | SRU `dcndl` | NDL detail JSON | ✓ | sort / facets 対応 |
| `ndl_digital` | SRU `dcndl` + `dpid=ndl-dl` | NDL detail JSON | ✓ | 次世代 DL bridge あり |
| `ndl_articles` | SRU `dcndl` | NDL detail JSON | ✓ | getRecord は CiNii CRID フォールバックあり |
| `ndl_articles_online` | SRU `dcndl` | — | ✓ | getRecord は常に null（既知の制約）|
| `cinii_articles` | CiNii OpenSearch | CiNii JSON-LD | ✓ | sort は `issued_date` のみ |
| `cinii_books` | CiNii OpenSearch | CiNii JSON-LD | ✓ | `holdings[]` に所蔵館情報 |
| `jstage_articles` | J-STAGE WebAPI | J-STAGE WebAPI | ✓ | sort 未対応。`source_metadata.pdf_url` に PDF 直リンク |
| `irdb` | IRDB OpenSearch atom | IRDB 詳細 HTML | — | `filters.irdb` 対応（fulltext / title / author 等） |
| `jdcat` | JDCat JSON API | JDCat JSON API | — | |
| `nihu_bridge` | nihuBridge POST | nihuBridge REST | ✓ | `filters.nihu_bridge` 対応（institute / database / bbox 等）|
| `japan_search` | Japan Search API | Japan Search API | — | 文化財・美術・地域資料向け |
| `kokkai_minutes` | 国会会議録 API（speech） | 国会会議録 API（meeting） | — | 第1回国会〜現在 |
| `teikoku_minutes` | 帝国議会会議録 API（speech） | 帝国議会会議録 API（meeting） | — | 第1〜90回（1890〜1947年）|

横断検索（source 未指定）に含まれない source は `jp_lit_search(source=...)` で明示指定が必要。

### 共通スキーマ（SearchItem / RecordItem）の主要フィールド

| フィールド | 型 | 備考 |
|-----------|-----|------|
| `title` / `subtitle` / `title_reading` | string \| null | |
| `authors[]` | `{name, role}[]` | |
| `issued_at` / `issued_at_label` / `issued_at_precision` | string \| null | precision: day / month / year / unknown |
| `material_type` | string \| null | NDL 系・CiNii 詳細は充実。CiNii 検索でも `dc:type` を反映 |
| `subjects[]` | string[] | NDL SRU は `dcterms:subject` テキスト件名のみ（URI / NDC 番号はスキップ）|
| `table_of_contents[]` | string[] | NDL SRU 検索は `dcterms:tableOfContents`。getRecord は `t35050`（ページ付き）→ `t35052`（章タイトル）の優先順で全 items 横断集約 |
| `summary` | string \| null | getRecord は `t35200`（要約）を全 items 横断集約 |
| `availability` | `{online, digital_collection}` | |
| `content_access` | `{has_page_images, viewer_url, ...}` | RecordItem のみ |
| `source_metadata` | object | source 固有情報（pdf_url / holdings / next_digital_library 等）|

### コンテキスト肥大化を避ける設計方針

- `jp_lit_search` / `jp_lit_get_record` は軽量メタデータのみ返す
- OCR 全文・座標・図版は専用ツールに分離（`jp_lit_get_text_coordinates` / `jp_lit_get_fulltext` / `jp_lit_search_pages` / `jp_lit_search_fulltext` / `jp_lit_search_illustrations`）
- `raw` / `source_metadata` は source 固有情報の退避先。通常利用では共通スキーマを優先する

## ツールリファレンス

### jp_lit_search

日本語文献ポータルを検索する。

| 引数 | 型 | 既定 | 説明 |
|------|----|------|------|
| `query` | string | 必須 | 検索キーワード |
| `source` | string | なし（横断） | source 指定 |
| `limit` | number | 横断:48 / 個別:50 | 最大 100 |
| `page` | number | 1 | 横断検索は 1 のみ |
| `sort_by` | string | — | NDL 系は正式対応。CiNii は `issued_date` のみ有効 |
| `sort_order` | string | — | NDL 系は正式対応。CiNii は `issued_date` と組み合わせたときのみ有効 |
| `filters.irdb` | object | — | `source=irdb` のときのみ有効。横断検索では使えない |
| `filters.irdb.fulltext` | boolean | — | `true` のとき全文検索対象に絞り込む（`fulltext=1`） |
| `filters.irdb.title` | string | — | タイトルで絞り込む |
| `filters.irdb.author` | string | — | 著者名で絞り込む |
| `filters.irdb.keyword` | string | — | キーワード（件名）で絞り込む |
| `filters.irdb.journal` | string | — | 掲載誌名で絞り込む |
| `filters.irdb.publisher` | string | — | 出版者（機関名）で絞り込む |
| `filters.nihu_bridge` | object | — | `source=nihu_bridge` のときのみ有効 |
| `filters.nihu_bridge.institute` | string[] | — | 機関ID配列（`nijl`/`nmjh`/`ninjal`/`ircjs`/`rihn`/`nme`/`nihu`）|
| `filters.nihu_bridge.database` | string[] | — | DB ID配列 |
| `filters.nihu_bridge.normalize` | boolean | — | 異体字同定。`false` で明示的にオフ（既定: ON）|
| `filters.nihu_bridge.period_from` | string | — | 開始時期（ISO8601 / 年）|
| `filters.nihu_bridge.period_to` | string | — | 終了時期（ISO8601 / 年）|
| `filters.nihu_bridge.bbox` | object | — | 空間検索 bounding box `{lat1, lon1, lat2, lon2}` |

sort 対応状況:
- `ndl_*`: 対応
- `cinii_articles` / `cinii_books`: `issued_date` のみ対応
- `jstage_articles`: 未対応
- `japan_search`: 未対応
- `irdb`: 未対応
- `jdcat`: 未対応
- `nihu_bridge`: 未対応

filters.irdb 対応状況:
- `source=irdb` のときのみ有効
- 横断検索（source 省略時）では使えない
- `source=irdb` 以外で指定すると validation error になる

### jp_lit_get_record

書誌詳細を取得する。`source=ndl_digital` の場合 `source_metadata.next_digital_library` に公開状況（pid / available / reason）が入る。

| 引数 | 型 | 説明 |
|------|----|------|
| `source` | string | 必須 |
| `source_id` | string | 必須 |

### jp_lit_get_text_coordinates

ページ単位の OCR テキスト・座標・IIIF 画像 URL を取得する（インターネット公開資料のみ）。

| 引数 | 型 | 説明 |
|------|----|------|
| `source` | string | `ndl_digital` のみ |
| `source_id` | string | `pid` と排他。事前に `available=true` を確認すること |
| `pid` | string | `source_id` と排他。`jp_lit_search_fulltext` の結果をそのまま渡せる |
| `page` | number | 必須 |

出力: `pid` / `page` / `page_image_url` / `contents` / `coordjson` / `raw`

- `page_image_url`: `https://dl.ndl.go.jp/api/iiif/{pid}/R{page:07d}/full/full/0/default.jpg`
- `coordjson`: OCR 座標（フルサイズ画像のピクセル座標。IIIF リサイズ時は要スケーリング）

### jp_lit_get_fulltext

資料単位の全文 OCR JSON を取得する（インターネット公開資料のみ）。

| 引数 | 型 | 説明 |
|------|----|------|
| `source` | string | `ndl_digital` のみ |
| `source_id` | string | `pid` と排他 |
| `pid` | string | `source_id` と排他 |

出力: `pid` / `pages`（`{ id, page, contents }[]`）/ `raw`

### jp_lit_search_pages

資料内のページをキーワードで全文検索する（インターネット公開資料のみ）。

| 引数 | 型 | 既定 | 説明 |
|------|----|------|------|
| `source` | string | 必須 | `ndl_digital` のみ |
| `source_id` | string | — | `pid` と排他 |
| `pid` | string | — | `source_id` と排他 |
| `keyword` | string | 必須 | |
| `size` | number | 20 | 最大 100 |
| `from` | number | 0 | オフセット |

出力: `pid` / `keyword` / `total` / `from` / `items` / `raw`

### jp_lit_search_fulltext

次世代デジタルライブラリー全資料を OCR 全文テキストからキーワード検索する。結果にはインターネット公開資料のみ含まれる。

| 引数 | 型 | 既定 | 説明 |
|------|----|------|------|
| `keyword` | string | 必須 | |
| `searchfield` | string | `contentonly` | `contentonly` / `metaonly` / `all` |
| `size` | number | 20 | 最大 100 |
| `from` | number | 0 | |
| `f_ndc` | string | — | NDC 分類で絞り込み |
| `fc_is_classic` | boolean | — | 古典籍資料で絞り込み |

出力: `keyword` / `searchfield` / `total` / `from` / `items` / `raw`

- `items[]`: `pid` / `title` / `responsibility` / `publisher` / `published` / `publishyear` / `ndc` / `bib_id` / `call_no` / `page_count` / `is_classic` / `highlights`
- `items[].pid` は `jp_lit_search_pages` / `jp_lit_get_text_coordinates` / `jp_lit_get_fulltext` にそのまま渡せる
- `items[].bib_id`（NDL書誌ID）があれば `jp_lit_get_record(source=ndl_catalog, source_id=bib_id)` で書誌詳細に直接アクセスできる

### jp_lit_search_illustrations

次世代デジタルライブラリー全資料の図版・挿絵をテキストキーワードで検索する。

| 引数 | 型 | 既定 | 説明 |
|------|----|------|------|
| `keyword` | string | 必須 | |
| `size` | number | 20 | 最大 100 |
| `from` | number | 0 | |

出力: `keyword` / `total` / `from` / `items` / `raw`

- `items[]`: `id`（`PID_page_index`）/ `pid` / `page` / `x` / `y` / `w` / `h`（%座標）/ `graphictags` / `page_image_url` / `illustration_image_url`
- `illustration_image_url`: IIIF `pct:x,y,w,h` で図版部分をトリミングした直リンク（認証不要）

## 主要なユースケースフロー

### メタデータ検索 → 書誌詳細

```
jp_lit_search(source=ndl_catalog, query="...")
  → source_id 取得
jp_lit_get_record(source=ndl_catalog, source_id=...)
```

### デジコレ → OCR 読み取り（source_id 経由）

```
jp_lit_search(source=ndl_digital, query="...")
  → source_id 取得
jp_lit_get_record(source=ndl_digital, source_id=...)
  → source_metadata.next_digital_library.available を確認
  → available=true なら pid 取得
jp_lit_get_text_coordinates(source=ndl_digital, source_id=..., page=N)
```

### 全文検索 → ページ特定 → OCR（pid 直渡し）

```
jp_lit_search_fulltext(keyword="大政奉還")
  → items[].pid 取得（公開資料のみ。available 確認不要）
jp_lit_search_pages(source=ndl_digital, pid=..., keyword="大政奉還")
  → ヒットページ番号取得
jp_lit_get_text_coordinates(source=ndl_digital, pid=..., page=N)
```

### 図版検索 → 画像取得

```
jp_lit_search_illustrations(keyword="富士山")
  → items[].illustration_image_url を直接表示
  → items[].pid + page で jp_lit_get_text_coordinates も呼べる
```

## next_digital_library フィールド仕様

`jp_lit_get_record(source=ndl_digital)` の `source_metadata.next_digital_library`:

```json
// インターネット公開済み（OCR ツール利用可）
{ "pid": "897115", "available": true, "reason": null, "book_api_url": "...", "total_page": 12, "public_domain": true, "online_pdf": false }

// 館内限定等（OCR ツール利用不可）
{ "pid": "1000732", "available": false, "reason": "not_indexed_in_next_digital_library", "book_api_url": "...", "total_page": null, "public_domain": null, "online_pdf": null }

// PID 解決不可
null
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `pid` | string | 次世代デジタルライブラリー PID |
| `available` | boolean | インターネット公開済みかどうか |
| `reason` | string \| null | 非公開の理由（`"not_indexed_in_next_digital_library"` など）|
| `book_api_url` | string | `/book/{pid}` エンドポイントの URL |
| `total_page` | number \| null | 総ページ数（`available=false` のとき null）|
| `public_domain` | boolean \| null | パブリックドメイン判定（`available=false` のとき null）|
| `online_pdf` | boolean \| null | PDF 一括ダウンロード可否（`available=false` のとき null）|

## 環境変数

| 変数 | 既定値 | 説明 |
|------|--------|------|
| `NDL_SEARCH_BASE_URL` | `https://ndlsearch.ndl.go.jp/api/sru` | ndl_search / ndl_catalog / ndl_articles / ndl_articles_online の検索 URL |
| `NDL_DIGITAL_BASE_URL` | `https://ndlsearch.ndl.go.jp/api/sru` | ndl_digital の検索 URL（`dpid=ndl-dl` は adapter 側で付与） |
| `NEXT_DIGITAL_LIBRARY_BASE_URL` | `https://lab.ndl.go.jp/dl/api` | 次世代デジタルライブラリー API の base URL |
| `CINII_RESEARCH_BASE_URL` | `https://cir.nii.ac.jp/opensearch/articles` | cinii 系の検索 URL |
| `CINII_RESEARCH_RECORD_BASE_URL` | `https://cir.nii.ac.jp/crid` | cinii 系の detail URL |
| `CINII_BOOKS_HOLDINGS_BASE_URL` | `https://ci.nii.ac.jp/books/opensearch/holder` | cinii_books 所蔵 API URL |
| `CINII_RESEARCH_APP_ID` | — | CiNii 安定利用に推奨。実値はシークレット経由で渡すこと |
| `JSTAGE_BASE_URL` | `https://api.jstage.jst.go.jp/searchapi/do` | jstage_articles 検索 URL |
| `JSTAGE_ARTICLE_BASE_URL` | `https://www.jstage.jst.go.jp` | jstage_articles 詳細 URL |
| `JAPAN_SEARCH_BASE_URL` | `https://jpsearch.go.jp/api/item/search/jps-cross` | japan_search 検索 URL |
| `JAPAN_SEARCH_ITEM_BASE_URL` | `https://jpsearch.go.jp/api/item` | japan_search 詳細 URL |
| `IRDB_SEARCH_BASE_URL` | `https://irdb.nii.ac.jp/opensearch/search` | irdb 検索 URL |
| `IRDB_DETAIL_BASE_URL` | `https://irdb.nii.ac.jp` | irdb 詳細 URL |
| `JDCAT_BASE_URL` | `https://jdcat.jsps.go.jp` | jdcat 検索・詳細 API の base URL |
| `KOKKAI_SPEECH_BASE_URL` | `https://kokkai.ndl.go.jp/api/speech` | kokkai_minutes 検索 URL |
| `KOKKAI_MEETING_BASE_URL` | `https://kokkai.ndl.go.jp/api/meeting` | kokkai_minutes 詳細 URL |
| `TEIKOKU_SPEECH_BASE_URL` | `https://teikokugikai-i.ndl.go.jp/api/emp/speech` | teikoku_minutes 検索 URL |
| `TEIKOKU_MEETING_BASE_URL` | `https://teikokugikai-i.ndl.go.jp/api/emp/meeting` | teikoku_minutes 詳細 URL |
| `NIHU_BRIDGE_SEARCH_URL` | `https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/search` | nihu_bridge 検索 URL |
| `NIHU_BRIDGE_RECORD_BASE_URL` | `https://api.bridge.nihu.jp/v1/integratedsearch/metadatas` | nihu_bridge 詳細取得 base URL |

補足: `NDL_SEARCH_BASE_URL` / `NDL_DIGITAL_BASE_URL` は `/api/sru` / `/api/opensearch` / `/api/bib/external/search` のどれを渡しても内部で正規化します。

## 実行方法

### 開発実行

```bash
npm run dev
```

### テスト

```bash
npm test
```

### 型ビルド

```bash
npm run build
```

### MCP smoke check（ローカル、API 疎通なし）

```bash
npm run smoke:mcp
```

### live smoke check

```bash
$env:SMOKE_LIVE="1"; npm run smoke:mcp
```

- `SMOKE_LIVE_SOURCE`（既定: `ndl_catalog`）/ `SMOKE_LIVE_QUERY`（既定: `菊池寛`）で対象を変更できます。
- `SMOKE_LIVE_SOURCE=ndl_digital` のとき、`next_digital_library.available=true` の資料があれば `jp_lit_get_text_coordinates` / `jp_lit_get_fulltext` も自動検証します。
- `SMOKE_LIVE_SOURCE=cinii_books` のとき、`source_metadata.holding_count` / `holdings[]` も確認します。

## MCP 登録例

```json
{
  "mcpServers": {
    "ndl-jp-lit": {
      "command": "node",
      "args": ["J:\\apps\\ndl-jp-lit-mcp\\dist\\src\\index.js"],
      "cwd": "J:\\apps\\ndl-jp-lit-mcp",
      "env": {
        "NDL_SEARCH_BASE_URL": "https://ndlsearch.ndl.go.jp/api/sru",
        "NDL_DIGITAL_BASE_URL": "https://ndlsearch.ndl.go.jp/api/sru",
        "NEXT_DIGITAL_LIBRARY_BASE_URL": "https://lab.ndl.go.jp/dl/api",
        "CINII_RESEARCH_BASE_URL": "https://cir.nii.ac.jp/opensearch/articles",
        "CINII_RESEARCH_RECORD_BASE_URL": "https://cir.nii.ac.jp/crid",
        "CINII_BOOKS_HOLDINGS_BASE_URL": "https://ci.nii.ac.jp/books/opensearch/holder",
        "CINII_RESEARCH_APP_ID": "your-cinii-app-id",
        "JSTAGE_BASE_URL": "https://api.jstage.jst.go.jp/searchapi/do",
        "JSTAGE_ARTICLE_BASE_URL": "https://www.jstage.jst.go.jp",
        "JAPAN_SEARCH_BASE_URL": "https://jpsearch.go.jp/api/item/search/jps-cross",
        "JAPAN_SEARCH_ITEM_BASE_URL": "https://jpsearch.go.jp/api/item",
        "IRDB_SEARCH_BASE_URL": "https://irdb.nii.ac.jp/opensearch/search",
        "IRDB_DETAIL_BASE_URL": "https://irdb.nii.ac.jp",
        "JDCAT_BASE_URL": "https://jdcat.jsps.go.jp",
        "KOKKAI_SPEECH_BASE_URL": "https://kokkai.ndl.go.jp/api/speech",
        "KOKKAI_MEETING_BASE_URL": "https://kokkai.ndl.go.jp/api/meeting",
        "TEIKOKU_SPEECH_BASE_URL": "https://teikokugikai-i.ndl.go.jp/api/emp/speech",
        "TEIKOKU_MEETING_BASE_URL": "https://teikokugikai-i.ndl.go.jp/api/emp/meeting"
      }
    }
  }
}
```

サンプルは [mcp-config.example.json](J:/apps/ndl-jp-lit-mcp/mcp-config.example.json:1) にあります。`CINII_RESEARCH_APP_ID` の実値は Git 管理外のシークレット経由で渡してください。

## 既知の制約

- `ndl_digital` は独立 API ではなく `NDL Search SRU + dpid=ndl-dl` を使います。次世代デジタルライブラリー API はインターネット公開資料のみ対象です。
- `ndl_search` は広い互換 source です。通常は `ndl_catalog` / `ndl_digital` / `ndl_articles` を推奨します。
- `cinii_articles` / `cinii_books` の sort は `issued_date` のみ対応です。`title` / `creator` / `created_date` / `modified_date` は無視します。
- `jstage_articles` には WebAPI 側で `sortflg` はありますが、指定できるのは `スコア順` と `巻・分冊・号・開始ページ順` だけです。現行の `sort_by` / `sort_order` には対応しないため、MCP では未対応にしています。
- `jstage_articles` の `summary` は常に `null` です。J-STAGE WebAPI はアブストラクトを返さず、記事ページのアブストラクトも JavaScript 動的レンダリングのため取得不可です。
- `ndl_articles_online` は検索のみ対応です。getRecord は bib detail API がレコードを返さず CiNii CRID フォールバックも存在しないため常に null を返します。
- `japan_search` は横断ポータル source のため、source 未指定の横断検索に含めていません。
- `irdb` は既定横断検索に含めていません。紀要・学位論文・報告書などが広く混ざるため、まずは `source=irdb` 指定専用です。
- `irdb` の上流 `count` は `20 / 50 / 100` だけ有効です。adapter 側で `limit` を補正しています。
- `irdb` の detail は IRDB 詳細画面 HTML を使います。原機関側 `URI` は `source_metadata.source_uri` に保持します。
- `jdcat` は既定横断検索に含めていません。研究データカタログであり、論文・図書の既定横断に混ぜない設計です。
- `jdcat` は当初想定の HTML parser ではなく、公開 JSON API `/api/records/` と `/api/records/{id}` を使っています。
- `jdcat` の `availability.online=true` は JDCat メタデータ上で配布元 `URI` が示されていることを意味します。データ本体が無条件公開されている保証ではありません。
- `ndl_articles` の `journal_title` は best-effort 抽出です。`dc:description` の `掲載誌：XXX` パターンから取得しますが、巻号が混入することがあります。
- `ndl_articles` の巻・号・頁は `RecordItem.source_metadata` のみに入ります。`SearchItem` では提供していません（設計上の割り切り）。
- `ndl_digital` の detail 判定は安全側です。`source_metadata.provider_id` が `null` のまま返ることがあります。
- `nihu_bridge` の sort は現時点で未対応です。上流 API のソートパラメータが限定的なため MCP では使用しません。
- `nihu_bridge` の sort は現時点で未対応です。上流 API のソートパラメータが限定的なため MCP では使用しません。

## AI エージェント向け Skill

MCP と組み合わせて使う「日本語文献調査スキル」が `.cursor/skills/jp-lit-research/` に同梱されています。

インストール後の実際の使い方は [docs/usage-guide.md](docs/usage-guide.md) を参照してください。

### 対応プラットフォーム

| プラットフォーム | 検出方式 | 対応状況 |
|----------------|---------|---------|
| Cursor | プロジェクト内 `.cursor/skills/` を自動検出 | ✅ クローンのみで有効 |
| Claude Code | `~/.claude/skills/` にインストール | ✅ スクリプトで導入 |
| Codex | `~/.codex/skills/` にインストール | ✅ スクリプトで導入（アダプター自動追加）|

### Skill の機能

| intent | 内容 |
|--------|------|
| 所蔵・書誌調査 | NDL / CiNii Books 所蔵確認、初出調査 |
| テーマ文献探索 | 複数 source 横断、論文・図書リスト作成 |
| 古語・表記ゆれ検索 | 旧字・旧仮名・カナ揺れ・漢語翻訳語の展開 |
| 全文・ページ特定 | デジコレ全文横断 → ページ特定 → OCR 座標取得 |
| 図版・挿絵検索 | 次世代デジコレ 860 万図版をキーワード検索 |
| 調べ方案内 | 分野別 source 選択と調査計画の提示 |

検索深度は依頼の表現で自動判定する（`quick` / `standard` / `deep`）。

| 深度 | 基準 | 内容 |
|------|------|------|
| `quick` | 「ざっと調べて」「参考程度に」 | 横断検索1回 → LLM選別 → SearchItem のみで報告 |
| `standard` | 「調べて」「探して」（明示なし） | source別検索 → LLM選別 → 選別済みの getRecord → 報告 |
| `deep` | 「網羅的に」「論文用に」 | 全 source + 全文検索 → 詳細な選別過程付きで報告 |

スキル構成（`.cursor/skills/jp-lit-research/`）:

| ファイル | 内容 |
|---------|------|
| `SKILL.md` | 調査フロー（Step 1〜7） |
| `workflows/bibliography-lookup.md` | 所蔵・書誌調査 |
| `workflows/topic-literature-review.md` | テーマ文献探索（深度別フロー） |
| `workflows/historical-term-search.md` | 古語・表記ゆれ検索 |
| `workflows/fulltext-page-lookup.md` | 全文・ページ特定・OCR |
| `workflows/image-illustration-search.md` | 図版・挿絵検索 |
| `workflows/research-guide-lookup.md` | 分野別調査シナリオ（国文学・近現代史・社会科学・美術文化財・言語学・宗教・初出調査） |
| `heuristics/source-selection.md` | ドメイン判定・DB選択ルール |
| `heuristics/db-characteristics.md` | 各DB の特性・選択理由 |
| `heuristics/query-expansion.md` | 検索語展開（旧字・旧仮名・漢語翻訳語） |
| `heuristics/evidence-grading.md` | 典拠評価（確認済み/有力/弱い） |
| `heuristics/failure-modes.md` | 見つからない時の対処 |
| `heuristics/clarifying-questions.md` | 曖昧な依頼への問い返しガイダンス |

### インストール（Claude Code / Codex）

**Windows（PowerShell）:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-skills.ps1
# または特定プラットフォームのみ
powershell -ExecutionPolicy Bypass -File scripts/install-skills.ps1 -Platform claude
powershell -ExecutionPolicy Bypass -File scripts/install-skills.ps1 -Platform codex
```

**macOS / Linux（bash）:**

```bash
bash scripts/install-skills.sh          # claude + codex 両方
bash scripts/install-skills.sh claude   # Claude Code のみ
bash scripts/install-skills.sh codex    # Codex のみ
```

**npm 経由:**

```bash
npm run skills:install
```

Cursor は `.cursor/skills/` をプロジェクトから自動検出するためインストール不要です。

---

## 拡張ロードマップ

### 設計方針

- MCP ツールは「検索・取得」に徹する。要約・ガイド・調べ方は LLM / Skill 側に任せる。
- 「調べ方を返すもの」は MCP ツールではなく Claude Code Skill として実装する。
- 新 source は原則として既定横断検索には入れない（ノイズ対策）。

### MCP 拡張フェーズ

| フェーズ | source | 内容 | 状況 |
|---------|--------|------|------|
| Phase 1 | `irdb` | 機関リポジトリ — 紀要・学位論文・報告書 | ✅ 完了 |
| Phase 2 | `kokkai_minutes` / `teikoku_minutes` | 国会・帝国議会会議録 | ✅ 完了 |
| Phase 3 | `jdcat` | 人文学・社会科学総合データカタログ | ✅ 完了 |
| Phase 4 | `nihu_bridge` | 人文学専門 DB 横断 | ✅ 完了 |

**Phase 2 メモ:** 国会会議録検索 API（`kokkai.ndl.go.jp/api`）を使用。speech 単位と meeting 単位の分け方を先に設計する。既定横断検索には入れない。

**Phase 3 メモ:** 完了。JDCat 公開 JSON API (`/api/records/`, `/api/records/{id}`) を採用。既定横断検索には入れない。対象時期・調査地域・配布元・アクセス条件を `source_metadata` に保持。

**Phase 4 メモ:** 完了。nihuBridge 統合検索 API（POST JSON）を採用。`api.bridge.nihu.jp/v1/integratedsearch/metadatas/search`（認証不要）で NIHU 傘下 7 機関 100+ DB を横断。`normalize: true`（デフォルト）で異体字同定。時間範囲・空間（bbox）検索・機関・DB フィルタに対応。既定横断検索には含めない。

### Skill 実装（MCP 外）

**日本語人文社会系文献調査スキル**（リサーチ・ナビ / レファ協の内容を参考に）

「調べ方・source 選択の判断」は静的な知識であり MCP ツールとして実装しない。Claude Code Skill として、研究テーマ別の source 選択基準・典型的な調査フロー・文献が見つからない場合の次の手などをまとめる。

## fixture 構成

| ディレクトリ | 内容 |
|-------------|------|
| `tests/fixtures/ndl-search/` | NDL Search の projection と live 応答抜粋（JSON + XML）。`record-toc.json`（t35050）/ `record-toc-cross-item.json`（t35052/t35200 cross-item）含む |
| `tests/fixtures/ndl-sru/` | SRU `recordPacking=xml` の live 形 XML。`search-toc.xml`（dcterms:tableOfContents）含む |
| `tests/fixtures/ndl-digital/` | ndl_digital の projection と live 応答抜粋（JSON + XML） |
| `tests/fixtures/cinii-research/` | OpenSearch JSON と detail JSON-LD |
| `tests/fixtures/irdb/` | OpenSearch Atom と IRDB 詳細 HTML |
| `tests/fixtures/jdcat/` | JDCat search / record JSON |
| `tests/fixtures/jstage/` | article search XML と記事ページ HTML meta |
| `tests/fixtures/japan-search/` | item search / item detail JSON |
| `tests/fixtures/next-digital-library/` | book / page / fulltext-json / page-search / book-search / illustration-search レスポンス |
| `tests/fixtures/nihu-bridge/` | nihuBridge search / record 合成 JSON |
