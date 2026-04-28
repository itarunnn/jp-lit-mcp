# NDL Search API メモ

確認日: 2026-04-27

## 現行実装

- 検索は SRU を使う。
  - `https://ndlsearch.ndl.go.jp/api/sru`
  - `operation=searchRetrieve`
  - `version=1.2`
  - `recordSchema=dcndl`
  - `recordPacking=xml`
- detail は引き続き `bib/external/search` を使う。
  - `https://ndlsearch.ndl.go.jp/api/bib/external/search?cs=bib&f-token=[token]`
- SRU XML は `parseSruXml` と `projectNdlSruSearchResponse` で mapper 互換 shape に投影する。
- `sortKeys` は使わず、`sortBy` を使う。
- `jp_lit_search` の `sort_by` / `sort_order` は NDL 系 source でのみ意味を持つ。
- NDL 系の search 結果には `facets.providers` / `facets.ndc` / `facets.issued_years` を返す。

## 実 API 調査で確定した点

- `version=1.2` が通る。
- `recordSchema=dcndl` を使う。
- `recordPacking=xml` で `recordData` に RDF/XML がネストされた形になる。
- `sortKeys=title,,1` は `illegal sortKeys value` を返す。
- `sortBy=title/sort.ascending` は通る。

## OpenSearch について

- OpenSearch search は現行の検索経路では使わない。
- ただし以下はまだ残している。
  - RSS/channel 形の detail XML 互換投影コード
  - 旧 fixture
  - 旧 changelog / 実装履歴の参照
- つまり `OpenSearch = 現行 API` ではなく、`履歴と互換保守対象` という位置づけ。

## fixture の方針

- Search fixture の live 元
  - SRU:
    `https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&version=1.2&recordSchema=dcndl&recordPacking=xml&maximumRecords=3&startRecord=1&query=anywhere%3D%22%E5%9B%BD%E7%AB%8B%E5%9B%BD%E4%BC%9A%E5%9B%B3%E6%9B%B8%E9%A4%A8%E5%B9%B4%E5%A0%B1%22`
- Record fixture の live 元
  - `https://ndlsearch.ndl.go.jp/api/bib/external/search?cs=bib&f-token=R100000039-I1000732`
- SRU fixture は XML をそのまま保持し、`tests/fixtures/ndl-sru/*.xml` で検証する。
- 旧 OpenSearch fixture は detail 互換と履歴確認のため残している。
- 既存 JSON fixture は compatibility projection と live 応答抜粋の追跡用に保持している。

## live 応答から fixture へ落とした手順

- SRU XML は live 形をそのまま保存し、parser / projection の入力に使う。
- 既存 JSON fixture は XML をそのまま使わない旧 mapper / 旧テストとの互換確認用に残している。
- `source_id` 相当の token, provider 系情報, viewer 候補 URL を追跡できるように、`_fixture.liveResponseExtract` には detail の `items[*].meta` などを残した。

## fixture で実際に使っているフィールド

### search-response.json / search-response.xml

- compatibility projection で mapper が読むフィールド
  - `totalResults`
  - `items[].id`
  - `items[].title`
  - `items[].subtitle`
  - `items[].authors`
  - `items[].publisher`
  - `items[].issued`
  - `items[].summary`
  - `items[].url`
  - `items[].online`
  - `items[].digitalCollection`
  - `items[].providerId`
- live 応答抜粋として残したフィールド
  - `rss.channel.openSearch:totalResults`
  - `rss.channel.item[].link`
  - `rss.channel.item[].author`
  - `rss.channel.item[].dc:title`
  - `rss.channel.item[].dc:publisher`
  - `rss.channel.item[].dc:identifier`
  - `rss.channel.item[].rdfs:seeAlso`
- SRU fixture で直接検証するフィールド
  - `searchRetrieveResponse.numberOfRecords`
  - `searchRetrieveResponse.records.record[].recordData.rdf:RDF`
  - `searchRetrieveResponse.extraResponseData.facet`

### record-response.json

- compatibility projection で mapper が読むフィールド
  - `id`
  - `title`
  - `subtitle`
  - `authors`
  - `publisher`
  - `issued`
  - `summary`
  - `url`
  - `online`
  - `digitalCollection`
  - `alternativeTitles`
  - `publicationPlace`
  - `language`
  - `materialType`
  - `extent`
  - `subjects`
  - `identifiers`
  - `tableOfContents`
  - `hasPageImages`
  - `hasTextCoordinates`
  - `viewerUrl`
  - `accessNote`
  - `providerId`
  - `providerName`
- live 応答抜粋として残したフィールド
  - `list[0].id`
  - `list[0].meta.t0245c`
  - `list[0].meta.k00220`
  - `list[0].meta.t02450`
  - `list[0].meta.t02451`
  - `list[0].meta.k28569`
  - `list[0].meta.t02460`
  - `list[0].meta.k09022`
  - `list[0].meta.k00410`
  - `list[0].meta.t02600`
  - `list[0].items[].meta.k39020`
  - `list[0].items[].meta.k39022`
  - `list[0].items[].meta.t38664`
  - `list[0].items[].meta.t38665`
  - `list[0].items[].meta.t38668`
  - `list[0].items[].meta.k30012`
  - `list[0].items[].meta.k80404`
  - `list[0].items[].meta.k31000`
  - `list[0].items[].meta.k39027`
  - `list[0].items[].meta.k39029`

### record fixture の追跡対応

- `alternativeTitles[0]` は `list[0].meta.t02460[0].v` を抜粋したもの
- `identifiers.issn` は `list[0].meta.k00220[0].v` を抜粋したもの
- `identifiers.issnl` は `list[0].meta.k28569[0].v` を抜粋したもの

## API / 実装メモ

- 検索 API ベース URL
  - SRU: `https://ndlsearch.ndl.go.jp/api/sru`
- 詳細取得 URL
  - `https://ndlsearch.ndl.go.jp/api/bib/external/search?cs=bib&f-token=[token]`
- SRU の主要パラメータ
  - `operation`, `version`, `recordSchema`, `recordPacking`, `maximumRecords`, `startRecord`, `query`, `sortBy`
- 2026-04-26 時点の provider 固定 source
  - `ndl_catalog` = `dpid=iss-ndl-opac`
  - `ndl_articles` = `dpid=zassaku`
  - `ndl_articles_online` = `dpid=zassaku-online`
  - `ndl_digital` = `dpid=ndl-dl`
  - `ndl_search` = `dpid` 未指定の広い互換 source
- SRU search は 2026-04-27 時点で実装済み。
- OpenSearch search の live parse は履歴として残るが、現行検索では使わない。
- JSON fixture は互換テストと live 応答抜粋の追跡用として引き続き保持する。

## 参照元

- APIのご利用について: https://ndlsearch.ndl.go.jp/en/help/api/
- API仕様の概要: https://ndlsearch.ndl.go.jp/help/api/specifications
- 外部提供インタフェース仕様書（第1.4版, 2026-03-31）: https://ndlsearch.ndl.go.jp/file/help/api/specifications/ndlsearch_api_20260331.pdf
