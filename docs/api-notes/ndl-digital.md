# NDL Digital API メモ

確認日: 2026-04-24

## Task 6 の実装方針

- 外向きの source 名は `ndl_digital` だが、Task 6 の内部実装は NDL Search API の `dpid=ndl-dl` を使う。
- 検索は `https://ndlsearch.ndl.go.jp/api/opensearch` に `dpid=ndl-dl` を付けて行う。
- 詳細取得は `https://ndlsearch.ndl.go.jp/api/bib/external/search?cs=bib&f-token=[token]` を使う。
- `次世代デジタルライブラリー API` は本文/OCR/座標系の将来拡張として位置づけ、Task 6 では未実装。

## Task 6 で使う URL

- 検索: `https://ndlsearch.ndl.go.jp/api/opensearch`
  - 主要パラメータ: `any`, `cnt`, `idx`, `dpid=ndl-dl`
- 詳細: `https://ndlsearch.ndl.go.jp/api/bib/external/search?cs=bib&f-token=[token]`

## `ndl-dl` の位置づけ

- `ndl-dl` は国立国会図書館デジタルコレクションのデータプロバイダ ID。
- API 提供対象データプロバイダ一覧では、`ndl-dl` は電子書籍・電子雑誌を含まない本体コレクションとして案内されている。
- `ndl-dl-online`、`ndl-dl-open` は別 ID で、Task 6 の adapter はこれらを直接扱わない。

## レスポンス項目メモ

- NDL Search API の返戻形式は DC-NDL ベースで、Task 6 では Task 5 と同様に JSON-compatible な payload を前提に mapper を実装する。
- `content_access.has_page_images`
  - 明示フィールドがあれば採用する。
  - 取れない場合は安全側で `false`。
- `content_access.has_text_coordinates`
  - Task 6 では次世代デジタルライブラリー API を使わないため、明示フィールドがなければ `false`。
- `content_access.viewer_url`
  - 明示フィールドがあれば採用する。
  - `dl.ndl.go.jp` の viewer URL を原則候補とし、取れない場合は `null`。
- `content_access.access_note`
  - payload に利用条件メモがあれば採用し、なければ `null`。
- `table_of_contents`
  - NDL Search detail payload で取り出せない場合は空配列。

## 利用条件メモ

- API の利用条件とクレジット表記は NDL Search API 全体の条件に従う。
- デジタルコンテンツ自体の利用条件は各コンテンツのメタデータを確認する必要がある。
- 画像、OCR、座標情報の取得条件は Task 6 の対象外で、将来の別タスクで整理する。

## 参照元

- API仕様の概要: https://ndlsearch.ndl.go.jp/help/api/specifications
- API提供対象データプロバイダ一覧: https://ndlsearch.ndl.go.jp/help/api/provider
- 外部提供インタフェース仕様書（第1.4版, 2026-03-31）: https://ndlsearch.ndl.go.jp/file/help/api/specifications/ndlsearch_api_20260331.pdf
