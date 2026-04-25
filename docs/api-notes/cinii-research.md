# CiNii Research API メモ

確認日: 2026-04-25

## 初版方針

- `cinii_research` source は初版では `articles` 検索に固定する。
- search は `https://cir.nii.ac.jp/opensearch/articles` の `format=json` を使う。
- detail は `https://cir.nii.ac.jp/crid/{crid}.json` を使う。
- `appid` は `CINII_RESEARCH_APP_ID` が設定されているときだけ付ける。

## 実レスポンス確認メモ

- 2026-04-25 時点では OpenSearch `format=json` は `appid` なしでも 200 を返した。
- ただし公式文書では `appid` を要求しているため、実装では optional env として残す。
- search response は `opensearch:totalResults` と `items[]` を持つ。
- `items[]` では `@id` が CRID URL、`dc:creator` が著者、`prism:publicationDate` が発行年、`prism:publicationName` がタイトル相当 fallback として使える。
- detail JSON-LD は metadata 中心で、サンプルによっては独立した title field を持たない。
- そのため初版では detail の title も `publication.prism:publicationName` fallback を使う。

## マッピング方針

- `source_id`
  - `@id` URL 末尾の CRID を使う
- `title`
  - `title`
  - `dc:title`
  - `prism:publicationName`
  - 上の順で fallback
- `authors`
  - search: `dc:creator[]`
  - detail: `creator[].foaf:name[]`
- `issued_at`
  - `prism:publicationDate`
- `identifiers`
  - `productIdentifier[].identifier`
  - `dataSourceIdentifier[]`
- `material_type`
  - detail の `@type`

## 既知の制約

- `articles` 検索固定なので、書籍・研究データ・プロジェクト等はまだ分けて扱っていない。
- detail JSON-LD に title が無いケースでは `publicationName` fallback を使うため、厳密な論文題名とズレる可能性がある。
- availability / content_access は現時点では未解決で、すべて保守的に `false` / `null` を返す。

## 参照元

- CiNii Research API: https://support.nii.ac.jp/en/cir/api
- OpenSearch: https://support.nii.ac.jp/en/cir/r_opensearch
- Data output formats: https://support.nii.ac.jp/en/cir/r_dataoutput
