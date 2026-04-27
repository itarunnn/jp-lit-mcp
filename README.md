# ndl-jp-lit-mcp

NDL Search、NDL デジタルコレクション、CiNii Research、J-STAGE、Japan Search を対象にした日本語文献探索向け MCP サーバーです。NDL 系 source の検索は SRU API を使います。`ndl_digital` は `NDL Search SRU + dpid=ndl-dl` を使い、次世代デジタルライブラリー API（`lab.ndl.go.jp/dl/api`）への bridge を通じて OCR・全文検索・図版検索にも対応しています。

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

## 対応 source（11種）

| source | 概要 | 推奨 |
|--------|------|------|
| `ndl_catalog` | NDL 蔵書 | ✓ |
| `ndl_digital` | NDL デジタルコレクション | ✓ |
| `ndl_articles` | NDL 雑誌記事索引 | ✓ |
| `ndl_articles_online` | NDL 雑誌記事索引オンライン版 | |
| `ndl_search` | NDL Search 全体（互換 source） | |
| `irdb` | 学術機関リポジトリデータベース | |
| `cinii_articles` | CiNii 論文 | ✓ |
| `cinii_books` | CiNii 図書 | ✓ |
| `cinii_research` | `cinii_articles` の後方互換 alias | |
| `jstage_articles` | J-STAGE 論文 | ✓ |
| `japan_search` | Japan Search（横断検索の既定対象外） | |
| `kokkai_minutes` | 国会会議録（第1回国会〜現在） | |
| `teikoku_minutes` | 帝国議会会議録（第1〜90回、1890〜1947年） | |

source 未指定の横断検索対象: `ndl_catalog` / `ndl_digital` / `ndl_articles` / `ndl_articles_online` / `cinii_articles` / `cinii_books` / `jstage_articles`

## 実装状況

- テスト: 203件すべて通過
- `npm test` / `npm run build` / `npm run smoke:mcp` を通した状態を維持
- NDL 系 source の検索は SRU（`version=1.2`, `recordSchema=dcndl`）に移行済み
- `sort_by` / `sort_order` / `facets`（providers / ndc / issued_years）は NDL 系 source で利用可能
- `cinii_articles` / `cinii_books` は `sort_by=issued_date` のみ対応
- `jstage_articles` は J-STAGE WebAPI の `sortflg` が現在の公開 API に素直に対応しないため、sort 未対応
- `irdb` source を追加
  - 検索は IRDB OpenSearch (`format=atom`)
  - detail は IRDB 詳細画面 HTML
  - 既定横断検索には入れない
- `SearchItem` / `RecordItem` に `title_reading` / `material_type` / `subjects` / `journal_title` を追加済み
- 次世代デジタルライブラリー bridge 完成
  - `jp_lit_get_record(source=ndl_digital)` → `source_metadata.next_digital_library`（pid / available / reason / book_api_url）
  - `jp_lit_get_text_coordinates` / `jp_lit_get_fulltext` / `jp_lit_search_pages` → PID 直接渡しにも対応
  - `jp_lit_search_fulltext` → 次世代 API `/dl/api/book/search` で OCR 全文横断検索
  - `jp_lit_search_illustrations` → 次世代 API `/dl/api/illustration/searchbytext` で図版検索
- `jstage_articles` の `source_metadata.pdf_url` に PDF 直リンクを格納済み
- `cinii_books` の `source_metadata.holdings[]` に所蔵館情報を格納済み

### 現状サマリ

- 文献系 source:
  - `ndl_catalog`
  - `ndl_digital`
  - `ndl_articles`
  - `ndl_articles_online`
  - `irdb`
  - `cinii_articles`
  - `cinii_books`
  - `jstage_articles`
  - `japan_search`
- OCR / 次世代デジタルライブラリー系:
  - `jp_lit_get_text_coordinates`
  - `jp_lit_get_fulltext`
  - `jp_lit_search_pages`
  - `jp_lit_search_fulltext`
  - `jp_lit_search_illustrations`
- `irdb` は検索・詳細取得まで実装済み
  - 検索: IRDB OpenSearch `format=atom`
  - 詳細: IRDB 詳細画面 HTML
  - live smoke: `irdb / 夏目漱石` 通過
  - 既定横断検索には未投入
- `jp_lit_search(source=irdb)` に `filters.irdb` を追加済み
  - `fulltext` / `title` / `author` / `keyword` / `journal` / `publisher` の6フィールドに対応
  - `source=irdb` 以外で指定すると validation error
  - 発行年フィルターは IRDB OpenSearch API に存在しないため非対応
- `kokkai_minutes` / `teikoku_minutes` を追加
  - 検索: 国会会議録 API (`kokkai.ndl.go.jp/api/speech`) / 帝国議会会議録 API (`teikokugikai-i.ndl.go.jp/api/emp/speech`) の speech エンドポイント（発言単位）
  - 詳細: meeting エンドポイント（会議全体）
  - 既定横断検索には含めない

### コンテキスト肥大化を避ける方針

- MCP は `検索` と `取得` に徹し、要約・論点整理・引用文生成は LLM 側に任せる
- `jp_lit_search` / `jp_lit_get_record` には OCR 全文や座標 JSON を混ぜない
- 重い payload は別ツールに分離する
  - `jp_lit_get_text_coordinates`
  - `jp_lit_get_fulltext`
  - `jp_lit_search_pages`
  - `jp_lit_search_fulltext`
  - `jp_lit_search_illustrations`
- `raw` / `source_metadata` は source 固有情報の退避先として残すが、通常利用では共通スキーマを優先する
- 横断検索には portal 系 source を入れすぎず、既定対象は絞る

### live 確認済み

- `ndl_catalog / 菊池寛`
- `ndl_digital / 菊池寛`
- `ndl_articles / 夏目漱石` — 検索・getRecord（CiNii CRID フォールバック）
- `ndl_articles_online / 夏目漱石` — 検索のみ（getRecord は常に null、既知の制約）
- `cinii_articles / 夏目漱石`
- `cinii_books / 夏目漱石`（holdings 含む）
- `jstage_articles / 夏目漱石`
- `japan_search / 夏目漱石`
- `irdb / 夏目漱石`
- `ndl_digital / 帝国図書館一覧` — OCR・座標・IIIF 画像 URL（PID 897115）
- CiNii: `CINII_RESEARCH_APP_ID` を設定した状態で確認済み
- IRDB: live smoke で検索・getRecord を確認済み

## ツールリファレンス

### jp_lit_search

日本語文献ポータルを検索する。

| 引数 | 型 | 既定 | 説明 |
|------|----|------|------|
| `query` | string | 必須 | 検索キーワード |
| `source` | string | なし（横断） | source 指定 |
| `limit` | number | 10 | 最大 50 |
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

sort 対応状況:
- `ndl_*`: 対応
- `cinii_articles` / `cinii_books` / `cinii_research`: `issued_date` のみ対応
- `jstage_articles`: 未対応
- `japan_search`: 未対応
- `irdb`: 未対応

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

- `items[]`: `pid` / `title` / `responsibility` / `publisher` / `published` / `publishyear` / `ndc` / `page_count` / `is_classic` / `highlights`
- `items[].pid` は `jp_lit_search_pages` / `jp_lit_get_text_coordinates` / `jp_lit_get_fulltext` にそのまま渡せる

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
{ "pid": "897115", "available": true, "reason": null, "book_api_url": "..." }

// 館内限定等（OCR ツール利用不可）
{ "pid": "1000732", "available": false, "reason": "not_indexed_in_next_digital_library", "book_api_url": "..." }

// PID 解決不可
null
```

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
| `KOKKAI_SPEECH_BASE_URL` | `https://kokkai.ndl.go.jp/api/speech` | kokkai_minutes 検索 URL |
| `KOKKAI_MEETING_BASE_URL` | `https://kokkai.ndl.go.jp/api/meeting` | kokkai_minutes 詳細 URL |
| `TEIKOKU_SPEECH_BASE_URL` | `https://teikokugikai-i.ndl.go.jp/api/emp/speech` | teikoku_minutes 検索 URL |
| `TEIKOKU_MEETING_BASE_URL` | `https://teikokugikai-i.ndl.go.jp/api/emp/meeting` | teikoku_minutes 詳細 URL |

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
      "command": "npm",
      "args": ["run", "dev"],
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
        "IRDB_DETAIL_BASE_URL": "https://irdb.nii.ac.jp"
      }
    }
  }
}
```

サンプルは [mcp-config.example.json](J:/apps/ndl-jp-lit-mcp/mcp-config.example.json:1) にあります。`CINII_RESEARCH_APP_ID` の実値は Git 管理外のシークレット経由で渡してください。

## 既知の制約

- `ndl_digital` は独立 API ではなく `NDL Search SRU + dpid=ndl-dl` を使います。次世代デジタルライブラリー API はインターネット公開資料のみ対象です。
- `ndl_search` は広い互換 source です。通常は `ndl_catalog` / `ndl_digital` / `ndl_articles` を推奨します。
- `cinii_research` は `cinii_articles` の互換 alias です。今後は `cinii_articles` / `cinii_books` を推奨します。
- `cinii_articles` / `cinii_books` の sort は `issued_date` のみ対応です。`title` / `creator` / `created_date` / `modified_date` は無視します。
- `jstage_articles` には WebAPI 側で `sortflg` はありますが、指定できるのは `スコア順` と `巻・分冊・号・開始ページ順` だけです。現行の `sort_by` / `sort_order` には対応しないため、MCP では未対応にしています。
- `jstage_articles` の `summary` は常に `null` です。J-STAGE WebAPI はアブストラクトを返さず、記事ページのアブストラクトも JavaScript 動的レンダリングのため取得不可です。
- `ndl_articles_online` は検索のみ対応です。getRecord は bib detail API がレコードを返さず CiNii CRID フォールバックも存在しないため常に null を返します。
- `japan_search` は横断ポータル source のため、source 未指定の横断検索に含めていません。
- `irdb` は既定横断検索に含めていません。紀要・学位論文・報告書などが広く混ざるため、まずは `source=irdb` 指定専用です。
- `irdb` の上流 `count` は `20 / 50 / 100` だけ有効です。adapter 側で `limit` を補正しています。
- `irdb` の detail は IRDB 詳細画面 HTML を使います。原機関側 `URI` は `source_metadata.source_uri` に保持します。
- `ndl_articles` の `journal_title` は best-effort 抽出です。`dc:description` の `掲載誌：XXX` パターンから取得しますが、巻号が混入することがあります。
- `ndl_articles` の巻・号・頁は `RecordItem.source_metadata` のみに入ります。`SearchItem` では提供していません（設計上の割り切り）。
- `ndl_digital` の detail 判定は安全側です。`source_metadata.provider_id` が `null` のまま返ることがあります。

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
| Phase 3 | `jdcat` | 人文学・社会科学総合データカタログ | 未着手 |
| Phase 4 | `nihu_bridge` | 人文学専門 DB 横断 | 未着手 |

**Phase 2 メモ:** 国会会議録検索 API（`kokkai.ndl.go.jp/api`）を使用。speech 単位と meeting 単位の分け方を先に設計する。既定横断検索には入れない。

**Phase 3 メモ:** 論文・図書と混在させないため既定横断検索には入れない。対象時期・調査地域・配布元・アクセス条件を重視。

**Phase 4 メモ:** 異体字・時空間検索が使えるなら専用引数を検討。API 仕様の確認から始める。

### Skill 実装（MCP 外）

**日本語人文社会系文献調査スキル**（リサーチ・ナビ / レファ協の内容を参考に）

「調べ方・source 選択の判断」は静的な知識であり MCP ツールとして実装しない。Claude Code Skill として、研究テーマ別の source 選択基準・典型的な調査フロー・文献が見つからない場合の次の手などをまとめる。

## fixture 構成

| ディレクトリ | 内容 |
|-------------|------|
| `tests/fixtures/ndl-search/` | NDL Search の projection と live 応答抜粋（JSON + XML） |
| `tests/fixtures/ndl-sru/` | SRU `recordPacking=xml` の live 形 XML |
| `tests/fixtures/ndl-digital/` | ndl_digital の projection と live 応答抜粋（JSON + XML） |
| `tests/fixtures/cinii-research/` | OpenSearch JSON と detail JSON-LD |
| `tests/fixtures/irdb/` | OpenSearch Atom と IRDB 詳細 HTML |
| `tests/fixtures/jstage/` | article search XML と記事ページ HTML meta |
| `tests/fixtures/japan-search/` | item search / item detail JSON |
| `tests/fixtures/next-digital-library/` | book / page / fulltext-json / page-search / book-search / illustration-search レスポンス |
