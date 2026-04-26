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
- detail は `summary` / `subjects` / `table_of_contents` を未実装のまま `null` / `[]` にする。
- `content_access.viewer_url` には `citation_pdf_url` を優先し、なければ記事 URL を返す。

## 注意

- J-STAGE WebAPI は大量ダウンロードを禁じている。
- クレジット表示として `Powered by J-STAGE` 相当が必要。
- 商用利用には別途申請が必要。

