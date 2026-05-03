# source 利用条件メモ

この文書は、`jp-lit-mcp` が利用している主な DB / API の利用条件を、実装・ドキュメント・運用確認用に整理したものです。法的助言ではありません。

通常の想定は、利用者が自分の端末で MCP サーバーを動かし、検索結果をローカルにキャッシュする個人調査用途です。一方で、公開 Web サービス、共有サーバ、クラウド上の常設 bot、メタデータの再配布・ミラー・検索サービス化では、各提供元の表示条件・保存条件・営利利用条件が問題になりやすくなります。公開・配布・業務利用・共有サーバ運用を行う場合は、必ず元の規約・ヘルプを再確認してください。

## 早見表

| source / API | 事前登録 | 営利利用 | クレジット / 表示 | 継続利用時の注意 | メモ |
|---|---|---|---|---|---|
| `ndl_search` / `ndl_catalog` / `ndl_articles` / `ndl_articles_online` | 利用目的により必要 | 条件付き | provider ごとの条件確認 | 継続アクセスは連絡協力のお願いあり | NDL Search 全体の条件に従う |
| `ndl_digital` 検索部 | NDL Search と同様 | NDL Search と同様 | provider ごとの条件確認 | 同上 | 検索は NDL Search SRU を使用 |
| 次世代デジタルライブラリー API | 原則不要 | 営利かつ継続的利用は問い合わせ | 加工時の明示など配慮事項あり | 営利かつ継続的利用は問い合わせ | OCR / 図版 / 全文はここを使用 |
| `cinii_articles` / `cinii_books` | App ID 要 | 商用は事前連絡推奨 | 著作権法等に従い適切取扱い | 短時間大量アクセスは遮断あり | API利用登録が必要 |
| `jstage_articles` | 非営利は不要 | 営利は申請必要 | JST 提供である旨表示、J-STAGE へのリンク | 利用者運営サービスでの 24 時間超保存・大量取得に注意 | 検索は WebAPI、詳細は記事ページ HTML meta の best-effort |
| `irdb` | 明示的な登録要件は未確認 | 規程ベース | 規程と個別条件に従う | 個人情報・詳細HTML取得に留意 | 検索は OpenSearch、詳細は IRDB 詳細画面 HTML の best-effort |
| `japan_search` | 公開 API に登録不要と読める | データごとに異なる | source 表記推奨、参加機関条件確認 | 個別コンテンツ条件確認 | metadata / thumbnail / content で条件が異なる |
| `jdcat` | 利用者登録不要 | 配布者 / 提供者ごとに異なる | 配布者側条件確認 | 個別データ条件確認 | WEKO3 JSON API に依存するメタデータ横断検索 |
| `nihu_bridge` | 登録要件は未確認 | 個別 DB / コンテンツ条件に依存 | 元 DB 側条件確認 | 個別確認が必要 | 利用者向け API 仕様書あり。ポータル的性格が強い |
| `kokkai_minutes` | 不要 | NDL ウェブサイト規約に従う | 著作権帰属に注意 | 高負荷アクセス禁止、数秒空ける | 発言著作権に注意 |
| `teikoku_minutes` | 不要 | NDL ウェブサイト規約に従う | 著作権帰属に注意 | 高負荷アクセス禁止、数秒空ける | 発言著作権に注意 |
| `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases`（CRD） | 不要 | 非営利目的に限る | クレジット表示・提供館名表示が必要 | 継続利用時は連絡先・利用内容を知らせる協力依頼あり | レファレンス協同データベース API 2.0 を使用 |

## source ごとのメモ

### NDL Search 系

対象:

- `ndl_search`
- `ndl_catalog`
- `ndl_articles`
- `ndl_articles_online`
- `ndl_digital` の検索部

確認できたこと:

- 利用目的により、利用申請やデータ提供機関による許諾が必要な場合があります。
- 個人・非営利団体等で、データ利用により収益を得ない場合は利用申請不要です。
- 収益を得る場合は営利目的に当たり、利用申請が必要です。
- 利用条件は provider ごとに異なるので、`API提供対象データプロバイダ一覧` の確認が必要です。
- 継続的にアクセスする場合は、利用申請の要否にかかわらず、連絡先・利用内容を知らせてほしいという協力依頼があります。

参考:

- NDL Search API 利用: https://ndlsearch.ndl.go.jp/help/api
- NDL API 一覧: https://www.ndl.go.jp/use/api

### 次世代デジタルライブラリー API

対象:

- `jp_lit_search_fulltext`
- `jp_lit_search_pages`
- `jp_lit_get_text_coordinates`
- `jp_lit_get_fulltext`
- `jp_lit_search_illustrations`

確認できたこと:

- `営利目的かつ継続的な利用を除き、申請不要で自由に利用` できます。
- 収録資料は著作権保護期間満了資料で、資料データは PDM ですが、加工したことの明示や自由利用可能表記の保持など、配慮事項があります。
- 著作権以外の権利・利益にも留意が必要です。

参考:

- サービス説明: https://lab.ndl.go.jp/service/tsugidigi/
- API案内: https://lab.ndl.go.jp/service/tsugidigi/apiinfo/

### CiNii Research / CiNii Books

確認できたこと:

- OpenSearch などの API 利用には、デベロッパー登録を行い `appid` を取得する必要があります。
- API 利用は、利用規程・利用細則・ウェブ API 利用細則への同意が前提です。
- 短時間で大量アクセスすると遮断される可能性があります。
- 商用サイトでの利用を希望する場合等は、API 利用申請の前に連絡するよう案内されています。

参考:

- 利用規約: https://support.nii.ac.jp/ja/cinii/terms
- API 利用登録: https://support.nii.ac.jp/ja/cinii/api/developer
- API 概要: https://support.nii.ac.jp/en/cinii/api/api_outline

### J-STAGE WebAPI

実装での利用:

- `jp_lit_search(source=jstage_articles, ...)` は `https://api.jstage.jst.go.jp/searchapi/do` を使います。
- `jp_lit_get_record(source=jstage_articles, ...)` は J-STAGE の記事ページ HTML を取得し、`citation_*` などの `<meta>` タグから best-effort で詳細情報を抽出します。
- そのため、検索と詳細取得で利用条件・安定性の性質が異なります。

確認できたこと:

- 非営利目的での利用は、JST への利用申請不要です。
- 営利目的での利用は、有償 / 無償を問わず JST への利用申請が必要です。
- WebAPI 規約は、API で入手した情報を利用者が運営する Web サイト、アプリケーション、その他サービスで使う場面を明示的に想定しています。
- API 利用情報を利用者運営サービスに表示する場合、JST 提供である旨の表示と J-STAGE へのリンク生成が求められます。
- 利用者運営サービスの主たるコンテンツとして本 API を組み込まないこと、とされています。J-STAGE の代替 DB、ミラー、常設検索サービスのような使い方は避けるべきです。
- WebAPI 提供情報を機械可読な状態でサーバやクラウド等に 24 時間以上保存・キャッシュしない旨の条件があります。これは特に、利用者運営サービス側で API 由来メタデータを蓄積・再提供する運用に関わる注意点として扱います。
- J-STAGE 閲覧規約も遵守対象です。記事ページ HTML の詳細取得は WebAPI ではなく通常ページ取得なので、高頻度取得は避け、壊れやすい best-effort として扱います。

運用メモ:

- `jp-lit-mcp` の標準的なキャッシュは、利用者が自分の端末で使うローカル保存です。この個人調査用途と、サーバ / クラウド上で API 由来メタデータを蓄積して複数利用者へ提供する用途は分けて考えます。
- 共有サーバ・クラウド・公開サービスとして運用する場合、J-STAGE WebAPI 由来のメタデータを 24 時間以上機械可読な状態で保持しない設計、または J-STAGE を source 別にキャッシュ無効化 / 短期 TTL 化する設計が必要です。
- J-STAGE の詳細取得は HTML meta 抽出なので、表示や引用に使う場合は必ず `url` から元記事ページを確認します。

参考:

- 利用規約: https://www.jstage.jst.go.jp/static/pages/WebAPI/-char/ja
- サービス案内: https://www.jstage.jst.go.jp/static/pages/JstageServices/TAB3/-char/ja

### IRDB

実装での利用:

- `jp_lit_search(source=irdb, ...)` は公式に案内されている `https://irdb.nii.ac.jp/opensearch/search` を使います。
- `jp_lit_get_record(source=irdb, ...)` は OpenSearch 結果に含まれる IRDB 詳細画面 URL の HTML を取得し、ページ内メタデータを best-effort で抽出します。
- 原機関リポジトリ側の URL は `source_metadata.source_uri` として保持します。

確認できたこと:

- IRDB は `学術コンテンツサービス利用規程` に基づいて運用されており、利用時点で同意したものとみなされます。
- 公開している OpenSearch 利用案内はありますが、今回確認した範囲では CiNii のような個別 API 登録要件は見当たりませんでした。
- メタデータ・書誌情報に含まれる個人情報の扱いに関する注意が明示されています。
- OpenSearch は検索結果の RSS / Atom フィード仕様が公開されています。
- 詳細取得は API 仕様として明文化された JSON/XML ではなく、IRDB 詳細画面 HTML の best-effort 抽出です。HTML 構造変更で壊れる可能性があります。

運用メモ:

- 高頻度に `jp_lit_get_record(source=irdb, ...)` を回して詳細 HTML を大量取得する運用は避けます。
- 研究利用・引用・二次利用では、IRDB 詳細画面だけでなく、`source_metadata.source_uri` の原機関リポジトリ側の条件も確認します。

参考:

- 利用規約: https://support.irdb.nii.ac.jp/ja/termsofuse
- OpenSearch: https://support.irdb.nii.ac.jp/ja/about/manual/opensearch

### Japan Search

確認できたこと:

- 開発者向け API は公開されています。
- metadata と thumbnail の利用条件は、各参加機関の database introduction page を確認する必要があります。
- database page に特段の条件がない metadata は `CC0 1.0` で使えるとされています。
- 個別の digital contents は、検索結果詳細画面と元データベース側の利用条件を確認する必要があります。
- source 表記や加工の明示が推奨されています。

参考:

- 開発者向け情報: https://jpsearch.go.jp/api
- 簡易Web APIガイド: https://jpsearch.go.jp/static/developer/webapi/
- Policy: https://jpsearch.go.jp/en/policy

### JDCat

実装での利用:

- `https://jdcat.jsps.go.jp/api/records/` と `/api/records/{id}` の JSON API を使います。
- `filters.jdcat` は JDCat の WEKO3 系 API パラメータに依存します。

確認できたこと:

- 利用者登録は不要で、どなたでも利用できます。
- JDCat はメタデータ横断検索であり、実データの利用条件は `配布者 / 提供者` によって異なります。
- そのため、検索結果から遷移した先で個別条件を確認する必要があります。
- `availability.online=true` は配布元 URI があることを意味するだけで、データ本体が無条件で再利用可能であることは意味しません。

参考:

- JDCat トップ: https://jdcat.jsps.go.jp/

### nihuBridge

実装での利用:

- `https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/search` と `/metadatas/{id}` を使います。
- nihuBridge の公式説明では API 提供が明記されており、統合検索機能の利用者向け API 仕様書と API チュートリアルが公開されています。

確認できたこと:

- nihuBridge は人間文化研究機構および連携機関の研究資源を共有・活用するためのポータルです。
- 統合検索 API の仕様書は公開されています。
- 今回確認した範囲では、CiNii のような個別 API 登録要件は見つけられていません。
- 実際のコンテンツや画像の利用条件は、元 DB・元機関側で個別に確認する前提と考えるのが安全です。

参考:

- nihuBridge トップ: https://bridge.nihu.jp/
- nihuBridge 公式説明: https://www.nihu.jp/ja/database/nihubridge.html
- 統合検索機能 利用者向け API 仕様書: https://www.nihu.jp/files/site/doc/mid4/nihuBridge_API_specification.pdf
- nihuBridge API チュートリアル: https://www.nihu.jp/files/site/doc/mid4/Tutorial_nihuBridgeAPI.pdf

### 国会会議録検索 API

確認できたこと:

- API 利用に手続きは不要です。
- `国立国会図書館ウェブサイトのコンテンツ利用規約` に従います。
- 個々の発言の著作権は発言者に帰属する場合があり、利用の可否は著作権法上の条件を自分で確認する必要があります。
- 高負荷利用は禁止で、多重リクエストを避け、取得後は数秒空けて次リクエストを行うよう案内されています。

参考:

- API 仕様: https://kokkai.ndl.go.jp/api.html

### 帝国議会会議録検索 API

確認できたこと:

- API 利用に手続きは不要です。
- `国立国会図書館ウェブサイトのコンテンツ利用規約` に従います。
- 発言の著作権は個々の発言者に帰属しうるため、利用可否の確認が必要です。
- 高負荷利用は禁止で、多重リクエストを避け、取得後は数秒空けて次リクエストを行うよう案内されています。

参考:

- API 仕様: https://teikokugikai-i.ndl.go.jp/teikoku_api.html

### レファレンス協同データベース（CRD）

対象:

- `jp_lit_search_guides_manuals`
- `jp_lit_search_guides_cases`

確認できたこと:

- API 2.0（`https://crd.ndl.go.jp/api/refsearch`）を使用。事前登録・APIキーは不要です。
- **非営利目的に限り**利用可能です。営利目的での利用は禁止されています。
- 結果を表示・再配布する場合は、**クレジット表示（レファレンス協同データベース）と提供館名表示**が必要です。
- 継続的に利用する場合は、連絡先・利用内容を NDL に知らせてほしいという協力依頼があります。
- このMCPは調べ方マニュアル（type=manual）とレファレンス事例（type=reference）の RSS 形式を利用しています。

参考:

- API 2.0 概要: https://crd.ndl.go.jp/jp/help/general/help_07.html
- API 2.0 仕様: https://crd.ndl.go.jp/jp/help/general/help_07_api_2.html

## メモ

- `source` ごとの利用条件は、API 利用条件だけでなく、返却されたデータやリンク先コンテンツの著作権・二次利用条件も分けて考える必要があります。
- 特に `Japan Search`、`JDCat`、`nihuBridge` のような横断ポータル系は、元データ側の条件確認を README に明記した方が安全です。
- `J-STAGE` と `IRDB` は検索 API だけでなく詳細ページ HTML の best-effort 抽出も使っています。高頻度の詳細取得や、HTML 由来データを API 同等に扱う運用は避けます。
- J-STAGE WebAPI 由来の情報は、利用者運営サービスでサーバ / クラウド等に 24 時間以上機械可読な状態で保存・キャッシュしない条件に注意します。これは個人端末上の一時的な調査キャッシュよりも、共有運用・ミラー的運用で問題になりやすい制約として扱います。
