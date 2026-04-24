# NDL Search API メモ

確認日: 2026-04-24

## Task 8 fixture の方針

- Search fixture の live 元
  - `https://ndlsearch.ndl.go.jp/api/opensearch?title=%E5%9B%BD%E7%AB%8B%E5%9B%BD%E4%BC%9A%E5%9B%B3%E6%9B%B8%E9%A4%A8%E5%B9%B4%E5%A0%B1&cnt=3&idx=1`
- Record fixture の live 元
  - `https://ndlsearch.ndl.go.jp/api/bib/external/search?cs=bib&f-token=R100000039-I1000732`
- Task 5 時点の adapter は OpenSearch XML を live parse しないため、fixture は 2 層構成にした。
  - top-level: 既存 mapper / 既存テストが読む flat な compatibility projection
  - `_fixture.liveResponseExtract`: 2026-04-24 に取得した live 応答の JSON-compatible 抜粋
- Task 8 品質差し戻し対応で、top-level compatibility projection も `_fixture.liveResponseExtract` と同じ資料サンプルへ揃えた。
  - `record-response.json` の token / title / viewer 系ダミー値は除去し、`R100000039-I1000732 = 国立国会図書館年報` の live 抜粋ベースへ更新した

## live 応答から fixture へ落とした手順

- OpenSearch XML は XML 文字列のままではテストに使いづらいため、要点だけを namespaced key のまま JSON-compatible に写した。
- 既存 mapper が直接読むのは top-level の `totalResults` / `items[]` なので、ここは Task 5 からの契約を壊さないよう維持した。
- `source_id` 相当の token, provider 系情報, viewer 候補 URL を追跡できるように、`_fixture.liveResponseExtract` には `link`, `dc:identifier`, `rdfs:seeAlso`, detail の `items[*].meta` を残した。

## fixture で実際に使っているフィールド

### search-response.json

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
  - `list[0].meta.t02450`
  - `list[0].meta.t02451`
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

## API / 実装メモ

- 検索 API ベース URL
  - OpenSearch: `https://ndlsearch.ndl.go.jp/api/opensearch`
  - SRU: `https://ndlsearch.ndl.go.jp/api/sru`
- 詳細取得 URL
  - `https://ndlsearch.ndl.go.jp/api/bib/external/search?cs=bib&f-token=[token]`
- OpenSearch の主要パラメータ
  - `any`, `title`, `creator`, `publisher`, `dpid`, `cnt`, `idx`
- OpenSearch XML をそのまま受けた場合、現実装は `NDL Search OpenSearch XML parsing is not implemented...` を返す。
- そのため Task 8 fixture は「live 応答抜粋を保持した JSON-compatible sample」であり、完全な XML dump ではない。

## 参照元

- APIのご利用について: https://ndlsearch.ndl.go.jp/en/help/api/
- API仕様の概要: https://ndlsearch.ndl.go.jp/help/api/specifications
- 外部提供インタフェース仕様書（第1.4版, 2026-03-31）: https://ndlsearch.ndl.go.jp/file/help/api/specifications/ndlsearch_api_20260331.pdf
