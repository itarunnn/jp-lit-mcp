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

## source_metadata の候補

- `irname`
- `source_uri`
- `repository_name`
- `resource_type`
- `publication_type`
- `journal_issn`
- `journal_ncid`
- `journal_volume`
- `journal_number`
- `starting_page`
- `ending_page`
- `file_url`
- `file_mime_type`
- `record_updated_at`

## 初版でやらないこと

- OAI-PMH ハーベスト
- PDF 本文抽出
- 既定横断検索への投入
- source 固有 filter の全面公開

## filters.irdb と OpenSearch パラメータ写像

`jp_lit_search(source=irdb, filters={irdb: {...}})` で指定できる絞り込み条件。

| MCP フィールド | OpenSearch パラメータ | 備考 |
|---------------|---------------------|------|
| `filters.irdb.fulltext=true` | `fulltext=1` | `false` または未指定のときはパラメータなし |
| `filters.irdb.title` | `title=<value>` | |
| `filters.irdb.author` | `author=<value>` | |

- `query` の `q` パラメータは常に付与される。
- `source=irdb` 以外（横断検索含む）では `filters.irdb` を渡すと validation error になる。
- IRDB の `fulltext` は `1`（全件対象）か指定なし（全文なし）のみ有効。`ALL` は現行 API では動作確認していない。

## 参照元

- IRDB OpenSearch: https://support.irdb.nii.ac.jp/ja/about/manual/opensearch
- IRDB 検索: https://support.irdb.nii.ac.jp/ja/about/manual/search
- IRDB 技術情報: https://support.irdb.nii.ac.jp/ja/tech-info
- IRDB データ提供: https://support.irdb.nii.ac.jp/ja/application/irdb
