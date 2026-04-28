# JDCat API メモ

確認日: 2026-04-27

## 初版方針

- `jdcat` source を追加する。
- 初版は `source=jdcat` 指定専用とし、既定横断検索には入れない。
- 研究データカタログなので、論文・図書と同じ既定横断には混ぜない。
- `jp_lit_search` / `jp_lit_get_record` に載せるが、将来的に `jp_research_data_search` へ分離する余地を残す。

## 公開サイトで確認できたこと

- JDCat は WEKO3 ベースの公開サイト。
- トップページの説明では、連携アーカイブやリポジトリの研究データメタデータを横断検索するカタログとされている。
- 詳細画面には少なくとも次がある。
  - タイトル
  - 作成者
  - 配布者 / 配布者 URI
  - URI
  - アクセス権
  - 権利情報
  - 概要
  - 対象時期
  - 調査方法
  - データタイプ
  - データの言語
  - 整理番号
  - ID 付与機関
  - 対象地域
  - トピック
  - バージョン
- 詳細画面には `OAI-PMH` / `JSON` / `BIBTEX` のエクスポート導線が表示される。

## 実地確認メモ

- トップ検索フォームは `/search` に submit される。
- 検索結果ページの内部実装は `invenio-search` コンポーネントで、公開 JSON API `/api/records/` を叩いている。
- `Accept: application/json` を付ければ次が公開で使える。
  - 検索: `https://jdcat.jsps.go.jp/api/records/?q=...&size=...&page=...`
  - 詳細: `https://jdcat.jsps.go.jp/api/records/{id}`
- 以前に試した export 系の URL は現環境で `401 Unauthorized` だった。
  - `https://jdcat.jsps.go.jp/records/{id}/export/json`
  - `https://jdcat.jsps.go.jp/records/{id}.json`
- したがって、初版は HTML parser ではなく公開 JSON API で実装するのが安全。

## 設計含意

- `source=jdcat` は
  - search: `/api/records/`
  - detail: `/api/records/{id}`
  の 2 段で実装できる。
- `url` は JDCat 詳細 URL を返す。
- `source_metadata.source_uri` に配布元 URI を残す。
- `availability.online` は、配布元 URI があれば `true` としてよいが、実データ本体の公開可否とは分けて考える。

## スキーマ上で重視したい項目

- `title`
- `authors`
- `summary`
- `subjects`
- `material_type`
- `language`
- `issued_at` または公開日
- `source_metadata.distributor`
- `source_metadata.distributor_uri`
- `source_metadata.source_uri`
- `source_metadata.access_right`
- `source_metadata.rights`
- `source_metadata.data_type`
- `source_metadata.spatial_coverage`
- `source_metadata.temporal_coverage`
- `source_metadata.version`

## 既知の不確定点

- export 系 JSON が 401 になる理由
  - anti-bot
  - referer/cookie 前提
  - 非公開 API
  のどれかは未確定
- `publish_date` を `issued_at` に使うのは便宜的な判断で、元データの公開日と調査対象時期は分けて扱う必要がある

## 参照元

- JDCat トップ: https://jdcat.jsps.go.jp/
- 例: 詳細画面 https://jdcat.jsps.go.jp/records/6693
