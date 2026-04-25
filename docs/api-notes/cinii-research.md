# CiNii Research API メモ

確認日: 2026-04-25

## 初版方針

- `cinii_research` は後方互換 alias として `cinii_articles` と同じ挙動をする。
- `cinii_articles` は `https://cir.nii.ac.jp/opensearch/articles` の `format=json` を使う。
- `cinii_books` は `https://cir.nii.ac.jp/opensearch/books` の `format=json` を使う。
- detail は `https://cir.nii.ac.jp/crid/{crid}.json` を使う。
- `appid` は `CINII_RESEARCH_APP_ID` が設定されているときだけ付ける。

## 実レスポンス確認メモ

- 2026-04-25 時点では OpenSearch `format=json` は `appid` なしでも 200 を返した。
- ただし公式文書では `appid` を要求しているため、実装では optional env として残す。
- search response は `opensearch:totalResults` と `items[]` を持つ。
- `items[]` では `@id` が CRID URL、`dc:creator` が著者、`prism:publicationDate` が発行年、`prism:publicationName` がタイトル相当 fallback として使える。
- detail JSON-LD は metadata 中心で、source/type によって持つ項目がかなり違う。
- `cinii_articles` は detail に title が薄いケースがある。
- `cinii_books` は `title`, `publisher`, `NCID`, `ISBN` などが比較的素直に取れる。

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

- `cinii_research`
  - `cinii_articles` の alias
- `cinii_articles`
  - 論文系 source
- `cinii_books`
  - 図書・雑誌系 source

同じ CiNii Research API を使うが、MCP 上は source を分ける。これにより `articles` と `books` の正規化境界を無理に混ぜずに保てる。

## 2026-04-25 精度改善メモ

- detail で `dc:title` を優先するよう更新
- `description[].notation[]` から summary を抽出
- `publication.dc:publisher` を publisher に反映
- `dcterms:subject[].notation[]` と `foaf:topic` を subjects に反映
- `publication` の `volume`, `number`, `startingPage`, `endingPage` を `source_metadata` に保持
- `url[]` を `source_metadata.urls` に保持

## 既知の制約

- detail JSON-LD に title が無いケースでは `publicationName` fallback を使うため、厳密な論文題名とズレる可能性がある。
- availability / content_access は現時点では未解決で、すべて保守的に `false` / `null` を返す。

## 参照元

- CiNii Research API: https://support.nii.ac.jp/en/cir/api
- OpenSearch: https://support.nii.ac.jp/en/cir/r_opensearch
- Data output formats: https://support.nii.ac.jp/en/cir/r_dataoutput
