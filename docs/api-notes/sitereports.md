# 全国文化財総覧 OAI-PMH 調査メモ

確認日: 2026-07-29

対象 source 候補: `sitereports`

## 結論

`decision: defer`

`indirect_discovery: go`

直接 harvest の代わりに、既存の IRDB / NDL Search 連携メタデータを使う。これで書誌、摘要中の遺構・遺物語、DOI、公式 record URL を取得する。座標・調査面積等の全国文化財総覧固有 field は対象外。

- OAI-PMH endpoint と `oai_dc` / `junii2` の公開までは確認できた。
- 全国文化財総覧の個別画面は、JDCat の同一資料メタデータより遺跡名、所在地、調査期間、調査原因、時代、遺構、遺物等が豊富で、専門 source としての追加価値はある。
- 一方、約4分半の間隔を空けた後の `ListRecords` も HTTP 429 となり、実レコードの `junii2` 項目、ページング、安定 ID と公式 URL の対応を確認できなかった。
- 公開情報からは、自動収集の推奨間隔、メタデータの長期保存・索引化・再表示条件、全件収集時の運用窓口を確定できなかった。
- `Identify` は `deletedRecord=transient` を返すため、差分収集だけでは削除を恒久的に追跡できない。定期的な全件照合は上流負荷との両立確認が必要になる。
- 現在の `.cache/jp-lit-mcp/cache/v1` は検索応答キャッシュであり、十万件規模の収集済みコーパスと全文索引を管理する用途には適さない。

したがって、現時点では次の3段階に分ける。

| 範囲 | 判断 | 条件 |
|---|---|---|
| 保存済み fixture を使う parser・写像・索引の小規模検証 | 限定的に Go | 上流へ追加アクセスせず、公開メタデータだけを扱う |
| OAI-PMH の初回全件収集・継続差分同期・ローカル索引の本番実装 | defer | 提供元に推奨間隔、保存・再表示、全件照合、帰属表示を確認してから再判断 |
| 検索 HTML のクロール、PDF・画像・OCR 全文の一括取得、429 の回避を目的とした並列化や接続元変更 | No-Go | 初期 source の範囲外 |

direct OAI harvesting の `decision: go` ではないため、この時点では詳細実装計画を作らない。

## サービス名と対象範囲

- 現在の正式名称は「全国文化財総覧」。
- 2025-03-31 に「全国遺跡報告総覧」から改称された。同じサービスの名称変更であり、別 DB が新設されたわけではない。
- 公式ガイド等には旧名称が残っているページがあるため、初出では「全国文化財総覧（旧・全国遺跡報告総覧）」と書く。
- 発掘調査報告書等の書誌、公開 PDF、遺跡情報、文化財データ等を扱う。ただし、発行機関による登録を基礎としており、全国の刊行物を完全に収録する DB ではない。
- 2026-07-29 のトップページ表示は、PDF 書誌 49,157 件、書誌総数 138,851 件、遺跡抄録 160,399 件等だった。件数は変動するスナップショットとして扱う。

## OAI-PMH の確認結果

endpoint:

`https://sitereports.nabunken.go.jp/api/oai/request`

### `Identify`

2026-07-29 02:40:46 JST に HTTP 200、`text/xml` で応答した。

| 項目 | 値 |
|---|---|
| `repositoryName` | `全国文化財総覧` |
| `baseURL` | `https://sitereports.nabunken.go.jp/api/oai/request` |
| `protocolVersion` | `2.0` |
| `adminEmail` | `library@nabunken.go.jp` |
| `earliestDatestamp` | `2021-06-18T09:06:05Z` |
| `deletedRecord` | `transient` |
| `granularity` | `YYYY-MM-DDThh:mm:ssZ` |
| `compression` | `deflate` |

### `ListMetadataFormats`

2026-07-29 02:47:13 JST に HTTP 200 で次の2形式を確認した。

| `metadataPrefix` | namespace / schema |
|---|---|
| `oai_dc` | Open Archives Initiative の OAI Dublin Core |
| `junii2` | `http://irdb.nii.ac.jp/oai` / `http://irdb.nii.ac.jp/oai/junii2-3-1.xsd` |

Junii2 3.1 の仕様上はタイトル、作成者、主題、内容記述、出版者、日付、識別子、URI、全文 URL、DOI、NCID 等を表現できる。ただし、全国文化財総覧が各項目を実際にどの程度埋めているかは未確認である。

### レート制限

今回の live probe は、必要最小限で止めた。

| 時刻（JST） | verb | 結果 |
|---|---|---|
| 02:40:46 | `Identify` | HTTP 200 |
| 02:41:08 | `ListMetadataFormats` | HTTP 429 |
| 02:47:13 | `ListMetadataFormats` | HTTP 200 |
| 02:51:44 | `ListRecords`。`from` と `until` を `earliestDatestamp` の同一時刻に限定 | HTTP 429 |

429 応答は通常の HTML で、`Retry-After` header はなかった。調査時にはトップページや個別ページの確認も並行していたため、上表から安全な最小間隔や OAI-PMH 固有の閾値を推定してはならない。2回目の 429 で追加試行を止めた。

このため、次は未確認のままである。

- `junii2` 実レコードの項目充足率
- 1応答あたりの件数と `resumptionToken`
- `setSpec` の構成
- OAI identifier から公式レコード URL への安定した写像
- 更新・削除レコードの実例
- 429 / 5xx 後の推奨再開方法

OAI-PMH の `resumptionToken` は一般仕様上 opaque として扱い、内容を解析・改変しない。`deletedRecord=transient` は、削除情報を永続提供する保証ではない。

## 既存 source との重複と追加価値

同一資料の例として、全国文化財総覧 ID `20037` と JDCat record `168192` を比較した。

- 全国文化財総覧の個別画面:
  - 書名、シリーズ、編著者、発行機関、発行日
  - NCID、全国書誌番号、DOI
  - 遺跡名、読み、所在地、市町村コード、遺跡番号、座標
  - 調査期間、調査面積、調査原因
  - 遺跡種別、時代、遺構、遺物
  - 公式 PDF 導線
- JDCat:
  - 書名、作成者、提供者、日付、言語
  - DOI、配布元 URI、都道府県、短い説明
  - 汎用的な主題とアクセス情報

全国文化財総覧の直接レコードには明確な専門的追加価値がある。一方、個別画面の BibTeX / TSV 出力は主に書誌項目で、遺跡情報は十分ではなかった。OAI-PMH の実データが同等に豊富か確認できるまでは、ローカル索引で実現できる検索軸を確定できない。

## 利用条件と権利の境界

- OAI-PMH endpoint の公開は機械連携の技術的入口を意味するが、メタデータ全体への包括的な CC / ODC license や無制限の再配布許諾を意味しない。
- 公式ガイドは、報告書データの著作権が各発行自治体・機関等に帰属すると案内している。
- 著作権法上の引用の範囲を超える利用や画像利用では、発行機関への確認が必要と案内されている。
- 個別の Online Library / Cultural Data に CC BY 4.0 等の表示がある場合でも、サービス全体へ一般化しない。
- 調査日時点の公開情報からは、OAI-PMH の推奨頻度、取得メタデータの長期保存、索引化、検索結果での再表示に関する包括的な条件を確認できなかった。
- `robots.txt` は今回 HTTP 429 となり、現行内容を確認できなかった。過去の観察だけを根拠に現在の許可・禁止範囲を断定しない。

ローカル研究用途で扱う場合も、元レコード URL、DOI、取得日、個別の権利表示を保持する。公開サービス、共有サーバ、メタデータ配布、営利利用へ広げる前には再確認する。

## 実装へ進む場合の構成

既存の `SourceAdapter` と `SearchItem` / `RecordItem` には、ローカル索引を読む adapter を接続できる。ただし、収集・索引と検索 adapter は分ける。

1. `sitereports` 専用の OAI-PMH 収集・保存・索引 subsystem
2. 専用索引を読み取り、既存の `jp_lit_search` / `jp_lit_get_record` に写像する read-only adapter

現在の検索応答キャッシュにはコーパスを混在させない。実装を再開するなら、明示的な `SITEREPORTS_DATA_DIR` のような安定保存先、schema version、index generation、checkpoint、tombstone、再構築手順が必要である。

初期案では次の運用境界が安全である。

- `sitereports` は明示指定専用とし、既定横断検索へ自動追加しない。
- 同期は MCP tool ではなく、停止・再開・状態確認のできる保守 CLI とする。
- MCP は索引の read-only 検索と同期状態の表示だけを行う。
- 429 では即時停止し、無指定の並列化、接続元切替、短時間 retry をしない。
- PDF URL は案内情報として保持しても、PDF 本体、画像、OCR 全文を収集しない。

SQLite FTS は候補だが、Node.js 22 / 24 と Windows / Ubuntu の配布・動作検証を Go 条件に含める。`node:sqlite` の安定性と警告、native dependency の導入コストを比較してから選ぶ。

## defer を解除する条件

全国文化財総覧の窓口へ、少なくとも次を確認する。

1. 個人利用のローカル MCP が OAI-PMH を初回収集・差分同期することの可否
2. 推奨アクセス間隔、時間帯、1回の収集量、429 後の待機方法
3. 取得メタデータの長期保存、全文索引化、ローカル検索結果への再表示の可否と必要な出典表示
4. 推奨する `metadataPrefix`、`set`、差分同期方式
5. `deletedRecord=transient` を補う全件照合の可否と推奨頻度
6. テスト fixture として少数の OAI-PMH 応答をリポジトリへ保存する場合の扱い

回答後、低頻度で1件以上の `junii2` 応答を取得し、項目充足率と安定 URL 写像を確認する。その後に限り、20〜100件の写像、索引精度、初回収集量・時間・ディスク容量を評価して Go / No-Go を再判定する。

## 参照

- 全国文化財総覧: https://sitereports.nabunken.go.jp/ja
- 名称変更のお知らせ: https://www.nabunken.go.jp/nabunkenblog/2025/03/soran20250331.html
- 使い方ガイド: https://sitereports.nabunken.go.jp/ja/abouts/guide
- プロジェクトについて: https://sitereports.nabunken.go.jp/ja/abouts/project
- 参加方法: https://sitereports.nabunken.go.jp/ja/abouts/participation
- 比較に使った全国文化財総覧 record: https://sitereports.nabunken.go.jp/20037
- 比較に使った JDCat record: https://jdcat.jsps.go.jp/api/records/168192
- OAI-PMH 2.0: https://www.openarchives.org/OAI/openarchivesprotocol.html
- OAI-PMH repository implementation guidelines: https://www.openarchives.org/OAI/2.0/guidelines-repository.htm
- Junii2: https://support.irdb.nii.ac.jp/ja/tech-info/junii2
