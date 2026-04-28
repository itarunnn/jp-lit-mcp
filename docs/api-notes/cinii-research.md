# CiNii Research API メモ

確認日: 2026-04-25

## 初版方針

- `cinii_articles` は `https://cir.nii.ac.jp/opensearch/articles` の `format=json` を使う。
- `cinii_books` は `https://cir.nii.ac.jp/opensearch/books` の `format=json` を使う。
- detail は `https://cir.nii.ac.jp/crid/{crid}.json` を使う。
- `cinii_books` の detail 時には `https://ci.nii.ac.jp/books/opensearch/holder?ncid=...&format=json` も使い、所蔵館情報を補完する。
- `appid` は `CINII_RESEARCH_APP_ID` が設定されているときだけ付ける。
- sort は当面 `issued_date` のみ対応する。
  - `cinii_articles`: `desc -> sortorder=0`, `asc -> sortorder=1`
  - `cinii_books`: `asc -> sortorder=2`, `desc -> sortorder=3`
  - それ以外の `sort_by` は送らない。

## 実レスポンス確認メモ

- 2026-04-25 時点では OpenSearch `format=json` は `appid` なしでも 200 を返した。
- ただし公式文書では `appid` を要求しているため、実装では optional env として残す。
- search response は `opensearch:totalResults` と `items[]` を持つ。
- `items[]` では `@id` が CRID URL、`dc:creator` が著者、`prism:publicationDate` が発行年、`prism:publicationName` がタイトル相当 fallback として使える。
- detail JSON-LD は metadata 中心で、source/type によって持つ項目がかなり違う。
- `cinii_articles` は detail に title が薄いケースがある。
- `cinii_books` は `title`, `publisher`, `NCID`, `ISBN` などが比較的素直に取れる。
- `CiNii Books holdings API` は `ncid` 必須で、`title` に所蔵館名、`link.@id` に図書館 URL、`rdfs:seeAlso.@id` に図書館 JSON URL を返す。

## マッピング方針

- `source_id`
  - `@id` URL 末尾の CRID を使う
- `title`
  - `title`
  - `dc:title`
  - `prism:publicationName`
  - 上の順で fallback
- detail では `dc:title` があれば優先し、無い場合だけ `publicationName` fallback を使う
- `authors`
  - search: `dc:creator[]`
  - detail: `creator[].foaf:name[]`
- `issued_at`
  - `prism:publicationDate`
- `identifiers`
  - `productIdentifier[].identifier`
  - `dataSourceIdentifier[]`
  - `URI`, `NAID`, `IRDB`, `CIA` などの型をそのまま正規化して保持
- `material_type`
  - detail の `resourceType`
  - 無い場合だけ `@type`

## source 分離方針

- `cinii_articles`
  - 論文系 source
- `cinii_books`
  - 図書・雑誌系 source
  - detail では `NCID` が取れた場合に holdings も取得する

同じ CiNii Research API を使うが、MCP 上は source を分ける。これにより `articles` と `books` の正規化境界を無理に混ぜずに保てる。

## 2026-04-25 精度改善メモ

- detail で `dc:title` を優先するよう更新
- `description[].notation[]` から summary を抽出
- `publication.dc:publisher` を publisher に反映
- `dcterms:subject[].notation[]` と `foaf:topic` を subjects に反映
- `publication` の `volume`, `number`, `startingPage`, `endingPage` を `source_metadata` に保持
- `url[]` を `source_metadata.urls` に保持

## 2026-04-26 cinii_books 所蔵補完メモ

- `productIdentifier[].identifier` から `NCID` を抽出する。
- `NCID` が取れたときだけ `CiNii Books holdings API` を引く。
- holdings response は `@graph[0].items[]` を見て、各要素を次へ正規化する。
  - `library_name`
  - `library_url`
  - `library_json_url`
- 合計件数は `opensearch:totalResults` を優先し、取れなければ `holdings.length` に fallback する。
- 所蔵 API が失敗しても書誌 detail は失敗させず、`source_metadata.holding_count = null`, `source_metadata.holdings = []` を返す。

## 既知の制約

- detail JSON-LD に title が無いケースでは `publicationName` fallback を使うため、厳密な論文題名とズレる可能性がある。
- availability / content_access は現時点では未解決で、すべて保守的に `false` / `null` を返す。
- `cinii_books` の holdings は図書館一覧までで、ILL 条件や館内利用制限の詳細まではまだ持たない。

## 参照元

- CiNii Research API: https://support.nii.ac.jp/en/cir/api
- OpenSearch: https://support.nii.ac.jp/en/cir/r_opensearch
- Data output formats: https://support.nii.ac.jp/en/cir/r_dataoutput
- CiNii Books OpenSearch: https://support.nii.ac.jp/en/cib/api/b_opensearch
- CiNii Books OpenSearch for Holdings: https://support.nii.ac.jp/en/cib/api/b_opensearch_hold
