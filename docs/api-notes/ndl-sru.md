# NDL SRU API メモ

確認日: 2026-04-26

## Task 0 調査結果

- 現行の扱いやすい呼び方は `version=1.2`、`recordSchema=dcndl`、`recordPacking=xml`。
- `recordSchema=dcndl_v3` は計画書に書かれていたが、実レスポンス確認の前提としては不採用にする。
- `recordPacking=string` だと `recordData` と `extraResponseData` が XML エスケープ文字列になる。
- `recordPacking=xml` だと `recordData` はネスト XML のまま取れ、`extraResponseData` の facets も XML としてそのまま取れる。
- `sortKeys=title,,1` は `illegal sortKeys value` を返した。
- 代わりに `sortBy=title/sort.ascending` は `version=1.2` で通る。

## fixture

- `tests/fixtures/ndl-sru/search-ndl-catalog.xml`
  - `iss-ndl-opac`
  - `recordPacking=xml`
- `tests/fixtures/ndl-sru/search-ndl-articles.xml`
  - `zassaku`
  - `recordPacking=xml`
- `tests/fixtures/ndl-sru/search-ndl-articles-online.xml`
  - `zassaku-online`
  - `recordPacking=xml`
- `tests/fixtures/ndl-sru/search-ndl-digital.xml`
  - `ndl-dl`
  - `recordPacking=xml`
- `tests/fixtures/ndl-sru/search-ndl-catalog-sort-title.xml`
  - `sortBy=title/sort.ascending`

## 形の要点

- ルートは `searchRetrieveResponse`
- 件数は `numberOfRecords`
- 次位置は `nextRecordPosition`
- facets は `extraResponseData.facets.lst[]`
  - `REPOSITORY_NO`
  - `NDC`
  - `ISSUED_DATE`
  - `LIBRARY`
- 検索結果本体は `records.record[].recordData["rdf:RDF"]`
- 書誌本体は `dcndl:BibResource`
- 所蔵・外部リンクは `dcndl:Item`

## フィールド確認

### ndl_catalog

- title: `dcterms:title`
- creator: `dcterms:creator.foaf:Agent.foaf:name` または `dc:creator`
- publisher: `dcterms:publisher.foaf:Agent.foaf:name`
- issued: `dcterms:issued`
- publicationPlace: `dcndl:publicationPlace`
- language: `dcterms:language`
- materialType: `dcndl:materialType[@_rdfs:label]`
- identifier: `dcterms:identifier[@_rdf:datatype]`
- viewer URL 候補: `dcndl:Item.rdfs:seeAlso` の `dl.ndl.go.jp`

### ndl_articles

- title: `dcterms:title`
- creator: `dcterms:creator.foaf:Agent.foaf:name`
- publisher: `dcterms:publisher.foaf:Agent.foaf:name`
- issued: `dcterms:issued`
- journal title: `dcndl:publicationName`
- volume/number/issue/pages:
  - `dcndl:publicationVolume`
  - `dcndl:number`
  - `dcndl:issue`
  - `dcndl:pageRange`
- materialType: `dcndl:materialType[@_rdfs:label]`
- CiNii CRID 候補:
  - `dcndl:Item.rdfs:seeAlso`
  - `https://cir.nii.ac.jp/crid/...`

### ndl_articles_online

- 基本形は `ndl_articles` と同じ
- `dcterms:description` に `資料形態 : テキストデータ` や `コレクション : ...` が入る
- `dcterms:accessRights` がある
- `dcterms:relation` に `https://dl.ndl.go.jp/...` が入る

### ndl_digital

- `dpid=ndl-dl` でも書誌本体は `R100000002` を含む
- viewer URL 候補:
  - `dcndl:Item.rdfs:seeAlso`
  - `https://dl.ndl.go.jp/pid/...`
- `dcterms:relation` や `rdfs:seeAlso` にデジタル系 URL が入る
- `dcndl:collection` / `dcterms:description` にデジタルコレクション情報が入る

## 実装メモ

- SRU parser は `recordPacking=xml` 前提で書く。
- `recordData` から `dcndl:BibResource` と `dcndl:Item[]` を引ければ、既存 mapper 互換 shape を作れる。
- `ndl_digital` は provider ではなく、`dpid=ndl-dl` で問い合わせた結果として `digitalCollection=true` を強制する方が安全。
- sort は `sortKeys` ではなく `sortBy` を使う設計へ切り替える。
