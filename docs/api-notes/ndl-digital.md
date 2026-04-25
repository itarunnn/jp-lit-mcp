# NDL Digital API メモ

確認日: 2026-04-25

## Task 4 live XML 対応の方針

- `ndl_digital` source は引き続き `NDL Search API + dpid=ndl-dl` を使う。
- OpenSearch XML は `projectNdlSearchOpenSearchXml` を再利用して mapper 互換 shape に投影する。
- search は `dpid=ndl-dl` を付けた live XML / JSON の両方を受ける。
- detail は XML / JSON の両方を受けるが、`providerId` が無い XML は `digitalCollection=true` かつ `providerName=国立国会図書館デジタルコレクション` のときだけ通す。
- 上の fallback で通した場合でも、`source_metadata.provider_id` は推定値を埋めず `null` のまま返す。

## Task 8 fixture の前提

- `ndl_digital` source は引き続き `NDL Search API + dpid=ndl-dl` を使う。
- Search fixture の live 元
  - `https://ndlsearch.ndl.go.jp/api/opensearch?title=%E5%9B%BD%E7%AB%8B%E5%9B%BD%E4%BC%9A%E5%9B%B3%E6%9B%B8%E9%A4%A8%E5%B9%B4%E5%A0%B1&cnt=3&idx=1&dpid=ndl-dl`
- Record fixture の live 元
  - `https://ndlsearch.ndl.go.jp/api/bib/external/search?cs=bib&f-token=R100000039-I1000732`
- Task 6 時点の adapter は OpenSearch XML parse を持たないため、fixture は NDL Search 側と同様に compatibility projection と live 応答抜粋を同居させた。
- Task 8 品質差し戻し対応で、top-level compatibility projection も `_fixture.liveResponseExtract` と同じ資料サンプルへ揃えた。
  - `search-response.json` は `R100000039-I1012769`、`record-response.json` は `R100000039-I1000732` の live 抜粋に合わせて dummy 値を除去した

## live 応答から fixture へ落とした手順

- OpenSearch XML は `rss.channel` 配下の必要項目だけを JSON-compatible に写し、`_fixture.liveResponseExtract` に保存した。
- detail JSON は `list[0]` と `items[*]` に digital 利用可否や viewer 情報が分散するため、必要な meta だけ抜粋した。
- `alternativeTitles` / `identifiers.issn` / `identifiers.issnl` も live 抜粋から追跡できるよう、`list[0].meta.t02460` / `k00220` / `k28569` を保持した。
- 既存 mapper / 既存テストは flat fields を読むため、top-level の `items[]` / record flat fields は維持した。

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
  - `rss.channel.item[].dcndl:volume`
  - `rss.channel.item[].dc:publisher`
  - `rss.channel.item[].dc:date`
  - `rss.channel.item[].dcterms:issued`
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
  - `hasPageImages`
  - `hasTextCoordinates`
  - `viewerUrl`
  - `accessNote`
  - `providerId`
  - `providerName`
  - `rawUrl`
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
  - `list[0].items[].type`
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

## `dpid=ndl-dl` メモ

- `ndl-dl` は国立国会図書館デジタルコレクションの provider ID。
- live XML 対応後も `ndl-digital` adapter は OpenSearch URL に `dpid=ndl-dl` を付けるだけで、record 取得先は NDL Search detail endpoint のまま。
- `ndl-dl-online` や `ndl-dl-open` は別 provider ID であり、この adapter では直接扱わない。

## content_access 判定メモ

- `has_page_images`
  - fixture 互換 flat field では top-level `hasPageImages`
  - live 抜粋側では `items[].meta.t38668`, `k30012`, `k39022` を手掛かりに trace できるよう残した
- `viewer_url`
  - fixture 互換 flat field では top-level `viewerUrl`
  - live 抜粋側では `items[].meta.k30012[0].v`
- `access_note`
  - fixture 互換 flat field では top-level `accessNote`
  - live 抜粋側では `items[].meta.k39020`, `k39027`, `k39029`

## 実装メモ

- OpenSearch XML の live parse は 2026-04-25 時点で実装済み。
- `dcndl:provider` 単独では `digitalCollection=true` を立てない。
- `providerId` が明示的に `ndl-dl` 以外なら record は弾く。
- JSON fixture は互換テストと live 応答抜粋の追跡用として継続する。

## 参照元

- API仕様の概要: https://ndlsearch.ndl.go.jp/help/api/specifications
- API提供対象データプロバイダ一覧: https://ndlsearch.ndl.go.jp/help/api/provider
- 外部提供インタフェース仕様書（第1.4版, 2026-03-31）: https://ndlsearch.ndl.go.jp/file/help/api/specifications/ndlsearch_api_20260331.pdf
