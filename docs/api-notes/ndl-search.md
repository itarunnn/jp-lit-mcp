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

## 利用条件メモ

- 利用申請の要否
  - `https://ndlsearch.ndl.go.jp/en/help/api/` では、利用形態によっては事前申請が必要とされている。
  - 営利企業・営利団体は、メタデータ提供機関側でライセンス済みのデータを使う場合を除き、原則として申請が必要。
  - 個人・非営利団体でも、営利利用に当たる場合は同様に申請が必要。
  - 非営利利用で利益を得ない場合は、原則として申請不要。ただし API 提供対象データプロバイダごとの条件確認が前提。
- 継続利用時の連絡に関する注意
  - 継続的に API を利用する場合は、利用実態把握のため申請フォームから利用内容と連絡先を知らせてほしい、と案内されている。
  - 連絡先を出しておくと、API 変更通知（日本語）が送られる。
- クレジット表記に関する注意
  - API を使う Web サイトやアプリには、NDL Search API を利用している旨のクレジット表記が必要。
  - メタデータ提供元データベースや提供機関のクレジットが必要なデータでは、その表記も必要。
- 過大アクセス時の制限可能性
  - 同時アクセス数はサーバ負荷防止のため制限される。
  - 特定 IP から大量リクエストが継続した場合、サイトへのアクセスを遮断する可能性がある。
- 免責の趣旨
  - 国立国会図書館は相応の注意を払って情報を提供するが、掲載情報やリソースの利用により行われた行為について責任を負わないとしている。
  - また、外部サイトや外部提供メタデータの正確性・適法性・安全性を保証せず、内容や URL の変更、中断、保守停止の可能性も明記している。
- API 提供対象データの前提
  - `https://ndlsearch.ndl.go.jp/help/api/specifications` には、NDL Search で検索できるデータのうち、許諾が得られたもののみ API 提供対象とある。
  - 実装側では「検索できるものがすべて API で使える」とはみなさず、データプロバイダごとの利用条件確認が必要。

## v1 実装メモ

- Task 5 の `fetchJson` は JSON 専用ラッパー。
- 検索 adapter は公式 OpenSearch の URL 構成 (`any`, `cnt`, `idx`) を使うが、Task 5 時点では live の RSS/XML を直接 parse していない。
- そのため `search()` が現時点で受け付けるのは、fixture のような flatten 済み JSON だけでなく、OpenSearch XML を別工程で JSON-compatible に変換した payload まで。
- 公式 OpenSearch endpoint にそのまま live access して XML が返った場合は、`NDL Search OpenSearch XML parsing is not implemented in Task 5` という明示的なエラーにしている。
- 詳細取得は `f-token` ベースの internal json URL を使う前提で、こちらは JSON 応答を期待している。
- 次タスクで XML パーサを入れる場合も、mapper 自体は namespaced / nested な JSON-compatible 形を受けられるようにしてあるため、adapter 側に XML -> object 変換を足す形で繋げやすい。

## 参照元

- APIのご利用について: https://ndlsearch.ndl.go.jp/en/help/api/
- API仕様の概要: https://ndlsearch.ndl.go.jp/help/api/specifications
- 外部提供インタフェース仕様書（第1.4版, 2026-03-31）: https://ndlsearch.ndl.go.jp/file/help/api/specifications/ndlsearch_api_20260331.pdf
- 外部提供インタフェース仕様書 附録1（2026-03-31）: https://ndlsearch.ndl.go.jp/file/help/api/specifications/ndlsearch_api_ap1_20260331.pdf
- DC-NDL（RDF）フォーマット仕様: https://ndlsearch.ndl.go.jp/en/renkei/dcndl/
