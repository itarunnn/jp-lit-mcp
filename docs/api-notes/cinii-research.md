# CiNii Research API メモ

確認日: 2026-04-25

## 初版方針

- `cinii_articles` は `https://cir.nii.ac.jp/opensearch/articles` の `format=json` を使う。
- `cinii_dissertations` は `https://cir.nii.ac.jp/opensearch/dissertations` の `format=json` を使う。
- `cinii_books` は `https://cir.nii.ac.jp/opensearch/books` の `format=json` を使う。
- detail は `https://cir.nii.ac.jp/crid/{crid}.json` を使う。
- `cinii_books` の detail 時には `https://ci.nii.ac.jp/books/opensearch/holder?ncid=...&format=json` も使い、所蔵館情報を補完する。
- `appid` は `CINII_RESEARCH_APP_ID` が設定されているときだけ付ける。
- sort は当面 `issued_date` のみ対応する。
  - `cinii_articles`: `desc -> sortorder=0`, `asc -> sortorder=1`
  - `cinii_dissertations`: `desc -> sortorder=0`, `asc -> sortorder=1`
  - `cinii_books`: `asc -> sortorder=2`, `desc -> sortorder=3`
  - それ以外の `sort_by` は送らない。

## 実レスポンス確認メモ

- 2026-04-25 時点では OpenSearch `format=json` は `appid` なしでも 200 を返した。
- ただし公式文書では `appid` を要求しているため、実装では optional env として残す。
- search response は `opensearch:totalResults` と `items[]` を持つ。
- `items[]` では `@id` が CRID URL、`dc:creator` が著者、`prism:publicationDate` が発行年、`prism:publicationName` がタイトル相当 fallback として使える。
- detail JSON-LD は metadata 中心で、source/type によって持つ項目がかなり違う。
- `cinii_articles` は detail に title が薄いケースがある。
- `cinii_dissertations` は博士論文・学位論文用の source として扱う。detail は共通 JSON-LD mapper を使い、本文公開や機関リポジトリ到達は別確認にする。
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
- `cinii_dissertations`
  - 博士論文・学位論文系 source
  - 既定横断には含めず、学位論文を探す意図があるときに明示指定する
- `cinii_books`
  - 図書・雑誌系 source
  - detail では `NCID` が取れた場合に holdings も取得する

同じ CiNii Research API を使うが、MCP 上は source を分ける。これにより `articles`、`dissertations`、`books` の正規化境界と調査意図を無理に混ぜずに保てる。

## 2026-06-19 cinii_dissertations 明示 source メモ

- CiNii Dissertations は 2024-12-09 に CiNii Research へ統合され、2025-05-12 に並行運用が終了した。実装は旧 `ci.nii.ac.jp/d/search` ではなく、CiNii Research OpenSearch の `dissertations` search type を使う。
- 検索 endpoint は `https://cir.nii.ac.jp/opensearch/dissertations`。detail は既存の `https://cir.nii.ac.jp/crid/{crid}.json` を使う。
- `CINII_RESEARCH_BASE_URL` に `/opensearch/articles` や `/opensearch/books` を渡した場合も、adapter が source ごとに `/opensearch/dissertations` へ差し替える。
- `issued_from` / `issued_to` は OpenSearch の `from` / `until` に渡す。CiNii Research docs では `dissertations` の検索タイプでも 2024-12-09 更新分から対応とされている。
- degree name、award institution、fulltext link などの博士論文固有 filter は、今回の初期実装では schema に足さない。まず source 意図の明示と CRID detail 取得を優先する。
- CSL JSON export では `source=cinii_dissertations` または `material_type` に `thesis` / `dissertation` を含む場合、CSL type を `thesis` にする。

## 2026-06-28 category filter / diagnostics メモ

- `cinii_books` では `filters.cinii.category` を OpenSearch `category` に渡す。
- `category` は NDC / NDLC の notation を半角スペース区切りで渡し、CiNii Books 側では分類記号の OR 検索として扱われる。
- 初期実装では `jp_lit_search.query` 必須 contract を維持し、category-only 検索は導入しない。
- `jp_lit_suggest_classification_codes` は Web NDL Authorities の `skos:relatedMatch` から NDC / NDLC を抽出して `suggested_category_param` を返す。
- `jp_lit_search.diagnostics` は、CiNii 系の 0 件・ローマ字 query と、source を問わない広い結果集合を machine-readable に返すための補助情報で、検索結果の正誤や文献価値を判定するものではない。

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
- `cinii_dissertations` は博士論文メタデータの入口であり、本文到達性や機関リポジトリ本文の確認は IRDB、NDL デジタルコレクション、各大学リポジトリ等で再確認する。

## 参照元

- CiNii Research API: https://support.nii.ac.jp/en/cir/api
- OpenSearch: https://support.nii.ac.jp/en/cir/r_opensearch
- CiNii Dissertations integration: https://support.nii.ac.jp/en/cir/cid_integration
- About CiNii Dissertations: https://support.nii.ac.jp/en/cinii_dissertations
- Data output formats: https://support.nii.ac.jp/en/cir/r_dataoutput
- CiNii Books OpenSearch: https://support.nii.ac.jp/en/cib/api/b_opensearch
- CiNii Books OpenSearch for Holdings: https://support.nii.ac.jp/en/cib/api/b_opensearch_hold
