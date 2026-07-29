# IRDB API メモ

確認日: 2026-04-27

## 初版方針

- `irdb` source を追加する。
- 初版は `source=irdb` 指定専用とし、既定横断検索には入れない。
- 検索は IRDB 公式 `OpenSearch` を使う。
- `get_record` は OAI-PMH ではなく、IRDB 詳細画面を主経路にする。
- 原機関 URI は `source_metadata.source_uri` に保持する。
- PDF 本文取得や OCR は別フェーズに切る。

## 公式仕様で確認できたこと

- OpenSearch endpoint:
  - `https://irdb.nii.ac.jp/opensearch/search`
- 主な検索パラメータ:
  - `q`
  - `title`
  - `author`
  - `authorid` — 作成者 ID（CiNii Research の著者 ID 等）。2026-04-27 公式ドキュメントで確認、初版メモには未記録だった
  - `keyword`
  - `journal`
  - `issn`
  - `publisher`
  - `dissertationid`
  - `dissertationaffiliation`
  - `fulltext`
  - `count`
  - `start`
  - `lang`
  - `format`
- `format` は `rss` / `atom`
- `count` は `20` / `50` / `100` 以外を指定すると既定値 `20` に戻る。
- `fulltext` は `ALL` または `1`
- 発行年による絞り込みパラメータは存在しない。結果の `pubDate` フィールドは返されるが検索条件には指定できない

## live 応答確認メモ

### OpenSearch

- `format=atom` は `rss` より豊富で、少なくとも次を持つ。
  - `title`
  - `link` / `id`（IRDB 詳細 URL）
  - `author`
  - `contributor`
  - `language`
  - `publisher`
  - `URI`（原機関側 URL）
  - `irname`
  - `prism:publicationName`
  - `prism:issn`
  - `prism:volume`
  - `prism:number`
  - `prism:startingPage`
  - `prism:endingPage`
  - `prism:publicationDate`
  - `content`
  - `updated`
- したがって初版は `atom` を優先するのがよい。

### detail

- IRDB 詳細画面 HTML には、検索結果より豊富なメタデータがある。
- 確認できた項目:
  - タイトル（多言語）
  - 作成者（多言語）
  - 内容注記
  - 出版者
  - 日付
  - 言語
  - 資源タイプ
  - 出版タイプ
  - 資源識別子
    - HDL
    - URI
  - 収録誌情報
    - PISSN
    - NCID
    - 雑誌名
    - 巻
    - 号
    - 開始ページ
    - 終了ページ
  - ファイル URL
  - MIME type
  - コンテンツ更新日時
  - 機関リポジトリ名
- したがって `get_record` の主経路は IRDB 詳細画面でよい。

### 原機関 URL

- `URI` に入っている原機関側ページは有用だが、安定性は機関側に依存する。
- 実地確認では、対象 URI の一つがメンテナンス中で利用できなかった。
- そのため、`get_record.url` は IRDB 詳細画面 URL を優先し、原機関 URL は `source_metadata.source_uri` に保持する方が安全。

## 実装上の注意

- `count` 制約があるので、MCP の `limit` をそのまま上流へ渡せない。
- 初版では次のような調整が必要。
  - 上流には `20 / 50 / 100` のいずれかを渡す
  - MCP 返却では requested `limit` に合わせて slice する
  - `page` と `start` の換算を慎重に扱う
- `summary` は `content` や詳細画面の `内容注記` から best-effort で取る。
- `content="application/pdf"` のように、抄録ではなくファイル種別が入るケースがある。
- `author` / `contributor` / 多言語表記の扱いは正規化ルールを決める必要がある。

## search / detail の公開契約

### search

OpenSearch Atom の検索結果では、次を `source_metadata` に保持する。

- `source_uri`
- `repository_name`
- `language`
- `record_updated_at`
- `journal_issn`
- `journal_volume`
- `journal_number`
- `starting_page`
- `ending_page`
- `sitereports`

`source_uri` は、credentials を含まない absolute `http:` / `https:` URL
だけを公開する。`javascript:`、`data:`、relative URL、malformed URL は
`source_uri` や `sitereports` に昇格させない。

### detail

詳細画面では、次を `source_metadata` に保持する。search と同じ値を
一律に引き継ぐわけではなく、詳細 HTML から確認できた項目を返す。

- `irname`
- `repository_name`
- `source_uri`
- `publication_type`
- `resource_type`
- `journal_issn`
- `journal_ncid`
- `journal_volume`
- `journal_number`
- `starting_page`
- `ending_page`
- `file_url`
- `file_urls`
- `file_mime_type`
- `record_updated_at`
- `sitereports`

`file_urls` は、詳細画面が返した file link のうち、credentials を含まない
absolute `http:` / `https:` URL の配列である。`file_url` はその先頭要素を
後方互換用に残す。query と fragment は HTML entity を復号した後も変更しない。
不採用 link を含む元 HTML は `raw.sections.file` で確認できる。

`identifiers` は typed label ごとに保持する。

- `identifiers.uri`: `URI` label の原機関 URL
- `identifiers.hdl`: `HDL` label の Handle URL
- `identifiers.doi`: `DOI` label の DOI 値

DOI、HDL、URI が同じ row にある場合も、いずれかで置き換えず同時に返す。

### 全国文化財総覧参照

`source_uri` が exact host `sitereports.nabunken.go.jp` の numeric root path
を指す場合だけ、`source_metadata.sitereports` を追加する。

- `record_id`
- `record_url`
- `doi`

`record_url` は HTTPS の canonical record URL とし、入力 URL の query /
fragment は付けない。subdomain suffix、credentials、非標準 port、nested path
は公式 record とみなさない。

## 初版でやらないこと

- OAI-PMH ハーベスト
- PDF 本文抽出
- 既定横断検索への投入
- source 固有 filter の全面公開

## 2026-07-29 全国文化財総覧の間接 discovery

- 全国文化財総覧の一部 record は IRDB OpenSearch / detail から検索できる。
- Atom の `URI` が公式 record、`content` が摘要、`irname` が原リポジトリ provenance を返す。
- 全国文化財総覧本体を harvest せず、既存 IRDB adapter で書誌・摘要・公式 URL を取得する経路を採用する。

## filters.irdb と OpenSearch パラメータ写像

`jp_lit_search(source=irdb, filters={irdb: {...}})` で指定できる絞り込み条件。

| MCP フィールド | OpenSearch パラメータ | 備考 |
|---------------|---------------------|------|
| `filters.irdb.fulltext=true` | `fulltext=1` | `false` または未指定のときはパラメータなし |
| `filters.irdb.title` | `title=<value>` | |
| `filters.irdb.author` | `author=<value>` | |
| `filters.irdb.keyword` | `keyword=<value>` | |
| `filters.irdb.journal` | `journal=<value>` | |
| `filters.irdb.publisher` | `publisher=<value>` | |

- `query` の `q` パラメータは常に付与される。
- `source=irdb` 以外（横断検索含む）では `filters.irdb` を渡すと validation error になる。
- IRDB の `fulltext` は `1`（全件対象）か指定なし（全文なし）のみ有効。`ALL` は現行 API では動作確認していない。

## 参照元

- IRDB OpenSearch: https://support.irdb.nii.ac.jp/ja/about/manual/opensearch
- IRDB 検索: https://support.irdb.nii.ac.jp/ja/about/manual/search
- IRDB 技術情報: https://support.irdb.nii.ac.jp/ja/tech-info
- IRDB データ提供: https://support.irdb.nii.ac.jp/ja/application/irdb
