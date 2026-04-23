# NDL Search API メモ

確認日: 2026-04-24

## 公式に確認できた URL

- 検索 API ベース URL
  - OpenSearch: `https://ndlsearch.ndl.go.jp/api/opensearch`
  - SRU: `https://ndlsearch.ndl.go.jp/api/sru`
- OpenSearch Description Document
  - `https://ndlsearch.ndl.go.jp/api/opensearch_description`
- v1 で詳細取得に使う URL
  - `https://ndlsearch.ndl.go.jp/api/bib/external/search?cs=bib&f-token=[token]`
  - 2026-03-31 版の外部提供インタフェース仕様書 2.共通事項に、内部項目の json を確認する URL として掲載されている。OpenSearch の正式な detail API として説明されているわけではないため、将来変更リスクはある。

## OpenSearch 主要パラメータ

- `any`: 簡易検索相当
- `title`: タイトル
- `creator`: 作成者
- `publisher`: 出版者
- `digitized_publisher`: デジタル化した製作者
- `ndc`: 分類。前方一致
- `from`, `until`: 出版年月日。`YYYY` / `YYYY-MM` / `YYYY-MM-DD`
- `dpid`: データプロバイダ ID
- `isbn`
- `mediatype`
- `cnt`: 返戻件数。省略時 200、最大 500
- `idx`: 開始位置。省略時 1

補足:

- 項目間の論理条件はすべて AND。
- 同一検索項目内で複数値を空白区切り指定した場合、`dpid` と `mediatype` は OR、それ以外は AND。
- `dpid` のみ指定した検索はできない。
- `idx` と `cnt` を使っても 501 件目以降は取得できない。

## データプロバイダ ID の例

- `iss-ndl-opac`: 国立国会図書館蔵書
- `iss-ndl-opac-bib`: 国立国会図書館蔵書（巻号以外）
- `iss-ndl-opac-inprocess`: 国立国会図書館新着書誌情報
- `iss-ndl-opac-national`: 国立国会図書館全国書誌情報
- `ndl-dl`: 国立国会図書館デジタルコレクション
- `ndl-dl-online`: 国立国会図書館デジタルコレクション（電子書籍・電子雑誌）
- `ndl-dl-open`: 国立国会図書館デジタルコレクション（オープンデータ）

## レスポンス項目の見どころ

- API 概要ページには、返戻データ形式は DC-NDL を基本形にしているとある。
- タイトルは `dcterms:title` または `dc:title/rdf:Description/rdf:value`
- 作成者は `dcterms:creator` または `dc:creator`
- 出版年月日は `dcterms:issued`。自由記述側は `dcterms:date`
- 目次は `dcterms:tableOfContents/rdf:Description/dcterms:title`

## v1 実装メモ

- Task 5 の adapter は live XML 解析までは入れず、fixture ベースで「OpenSearch / internal json を JSON 化した後の形」を前提に mapper を作っている。
- 検索は OpenSearch ベースで `any`, `cnt`, `idx` を使う。
- 詳細は `f-token` ベースの internal json URL を使う。

## 参照元

- API仕様の概要: https://ndlsearch.ndl.go.jp/help/api/specifications
- 外部提供インタフェース仕様書（第1.4版, 2026-03-31）: https://ndlsearch.ndl.go.jp/file/help/api/specifications/ndlsearch_api_20260331.pdf
- 外部提供インタフェース仕様書 附録1（2026-03-31）: https://ndlsearch.ndl.go.jp/file/help/api/specifications/ndlsearch_api_ap1_20260331.pdf
- DC-NDL（RDF）フォーマット仕様: https://ndlsearch.ndl.go.jp/en/renkei/dcndl/
