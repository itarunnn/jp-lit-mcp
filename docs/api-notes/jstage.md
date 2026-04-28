# J-STAGE API メモ

## 採用方針

- `jstage_articles` は `J-STAGE WebAPI` の記事検索を使う。
- 検索は `https://api.jstage.jst.go.jp/searchapi/do?service=3&article=...` の XML を使う。
- 詳細取得は独立の detail API を持たないため、記事ページ HTML の meta タグを使う。

## 根拠

- J-STAGE 公式の WebAPI 案内では、記事検索結果を XML で取得できる。
- `service=3` の記事検索は live 応答で `Atom/OpenSearch` 形を返す。
- 記事ページ HTML には `citation_*` 系 meta があり、DOI、誌名、著者、掲載年、ページ、PDF URL などを取得できる。

## 2026-04-26 時点の実装メモ

- 検索パラメータは `service=3`, `article=<query>`, `page=<n>` を利用。
- `source_id` は記事 URL の pathname を保持し、detail では `https://www.jstage.jst.go.jp` に解決して再取得する。
- detail は現状 `summary` を `null`、`table_of_contents` を `[]` で返す。`subjects` は meta から抽出できる範囲だけ返す。
- `content_access.viewer_url` には `citation_pdf_url` を優先し、なければ記事 URL を返す。

## 2026-04-27 sort 調査メモ

- J-STAGE WebAPI の論文検索結果取得（`service=3`）には `sortflg` がある。
- ただし選べるのは次の 2 種だけ。
  - `1`: 検索結果のスコア順
  - `2`: 巻・分冊・号・開始ページ順
- これは現在の MCP 公開引数 `sort_by` / `sort_order` とは対応が悪い。
  - `issued_date` や `title` に直接対応しない
  - `sort_order` も表現できない
- そのため、`jstage_articles` は現時点では sort 未対応のままとする。
- もし将来対応するなら、`sort_by=bibliographic` のような source 固有拡張か、別ツール化が必要。

## 注意

- J-STAGE WebAPI は大量ダウンロードを禁じている。
- クレジット表示として `Powered by J-STAGE` 相当が必要。
- 商用利用には別途申請が必要。

## 参照元

- J-STAGE WebAPI: https://www.jstage.jst.go.jp/static/pages/JstageServices/TAB3/-char/ja
- J-STAGE WebAPI ご利用マニュアル Ver.2.0 (2026-03-26): https://www.jstage.jst.go.jp/static/files/ja/manual_api.pdf
