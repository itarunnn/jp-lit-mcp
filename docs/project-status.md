# 実装状況

## 2026-10-09: TEI・IIIFの導入前提の明確化

READMEと各アプリの導入ガイドで、MCP検索、TEI reader、IIIF比較、画像解析、OCRの必要環境を区別した。npmにPythonコードと環境定義を同梱すること、uvとPython本体の準備、Skills配置後のreader起動確認を[共通手順](install/runtime-requirements.md)にまとめた。

変更は文書に限定し、version 0.18.0とruntimeを維持する。既存導入文書テスト9件、関連文書のローカルリンクと追加した参照先、差分を確認した。今回の修正の公開反映は次工程とする。

## 2026-10-08: v0.18.0 IIIF読解・図版比較

IIIFのTEI往復・ローカルOCR・利用中AIアプリの候補取込・図版検索／整列差分を0.18.0へまとめた。利用ガイドを研究用途・依頼例・画面操作中心に全面改稿し、CLI仕様を別資料へ整理した。SkillのOCR導入・評価参照を同梱し、repo外の導入でも辿れる形に揃えた。

CIとpublish前手順へ任意画像環境のfrozen setupとofflineテストを追加した。新規導入・全回帰・独立レビューとWindows/Ubuntu × Node.js22/24のCIを確認した。図版の人による対応確認は継続評価として残し、候補の一般精度や同版木、文字校合を認定しない。[リリースノート](releases/v0.18.0.md)と[利用ガイド](iiif-workbench.md)を参照。

## 2026-10-08: 次期開発版のIIIF統合受入とSkill案内

- 伊勢物語のOCR3候補・AI2候補、廣瀬本万葉集のTEI20参照、国文研本／NDL本『人倫訓蒙図彙』の比較を同じ4窓で保存。原workspace ID・原候補を保持して新しい出典を書き出し、TEI・OCR行・AI・図版両側への移動と保存・再読込を確認した。別workspace reportの取込は拒否する。
- 図版だけの矩形を解析前に選び、AI仮対応2組と別図版10組を評価。対応候補は各1位で整列、別図版は整列保留。基準2領域は同じ1 Canvas、候補6領域は5 Canvasの限定試験。彩色や線のずれを含む調整差約27〜29%を、改版・加筆の認定や汎化精度と区別する。人の図版校合・文字校合は未実施。
- repo内jp-lit-iiif Skillへprepare_reading/import_reading、compare_images/import_comparisonのreferenceを追加。公開npm0.17.0と開発checkoutの操作を区別し、必要な手順をSkill内へ配布する。
- version0.17.0、通常MCP30tools/21sources、新規npm依存0を維持する。品質評価の限界と独立レビューを公開判断へ引き継ぎ、merge/push/releaseを保留する。[利用ガイド](iiif-workbench.md#保存した図版を探して整列差分を確認する開発版)を参照。

## 2026-10-08: 次期開発版の類似図版検索・整列差分

- 保存済み領域画像の局所特徴から候補を探す`compare_images`、出典を再検証する`import_comparison`、両側の原領域へ戻る比較画面を追加。任意のuv/Python3.13/OpenCV-headless環境で実行し、画像の外部送信を行わない。
- 回転・縮尺・平行移動の位置合わせ、重ね合わせ、原濃淡と調整後の差、比較範囲外maskを保存する。弱い・局所的な対応は保留し、成立した候補も図版の一致は別確認とする。枠線・文字・撮影スケールが似る別図版の誤検出を利用ガイドに記録する。
- 原report・両側出典・画像・artifactのhashと固定engine/settingsを保持する。図版対応の確認履歴はTEI本文校合と分け、同じreportの再取込・領域削除／移動で保持する。現在領域に一致する比較だけを出典付き読解資料へ添付する。
- 古典籍3資料12保存画像と同一画像対照、既知の回転・濃淡変更・追加印で機能を検証する。別本間の正解付き評価と主要フローの統合受入は継続する。version0.17.0、通常MCP30tools/21sources、新規npm依存0を維持し、merge/push/releaseを保留する。[図版比較の利用ガイド](iiif-workbench.md#保存した図版を探して整列差分を確認する開発版)を参照。

## 2026-10-08: 次期開発版のTEI改頁本文・AI読解

- TEIのpb後から次pb直前までを、原タグ・XPathと部分切出しの印を持つpage_rangeとして保存・表示・exportする。任意include_inheritedは最も近い祖先のfacsを宣言元付きで展開し、明示overrideと空属性を保持する。曖昧な本文枝・版と巨大範囲には診断・省略を残す。
- 保存済み廣瀬本万葉集の先頭20参照を点検し、18改頁snapshot（うち非空白本文12）とresolved18/unresolved2を保持する。範囲と画像の往復・保存再開を確認し、文字単位の校合は未実施として区別する。
- 利用中AIアプリへの同画像file handoff、原OCRと画像だけの2条件、生成候補・疑義・human/ai別確認履歴を追加する。原run・画像・応答を再検証し、部分読解候補の全文評価を拒否する。伊勢物語2候補の品質順位は未判定。
- version0.17.0、通常MCP30tools/21sources、新規npm依存0を維持する。類似図版・整列差分と統合評価が次段階。主要機能が揃うまでmerge/push/releaseを保留する。[TEI利用ガイド](iiif-workbench.md#tei本文と画像領域を往復する開発版)と[AI読解](iiif-workbench.md#利用中のaiアプリで領域を読み疑義を取り込む)を参照。

## 2026-10-06: 次期開発版のGPU OCR接続と手動結果評価

- 標準NDL古典籍OCR-Liteを保ち、導入済みDocker imageの古典籍OCR ver.3を任意providerとして接続。immutable image ID・engine hashを固定し、通信なしのcontainerで選択画像を処理する。行脱落・TXT/JSON不一致・タイムアウトを検出して原出力を保持する。
- KuroNetの手動候補を共通`evaluate_ocr`へ追加。貼付本文・候補ID・出典・領域を確認し、サービス処理画像hashとモデル版はnullを保持する。同一画像条件を確認できない手動候補のVLM variantは受け付けない。
- 伊勢物語1領域で実画面の貼付・保存・再読込・exportと、Lite/GPUの同じ画像による実行・取込・共通評価・3候補exportを確認。校合済み参照が未登録のため品質順位と金銭費用は未判定。
- version0.17.0、MCP30 tools／21 sources、新規npm依存0を維持。主要IIIF機能が揃うまでmerge・push・releaseを保留する。導入と評価条件は[利用ガイド](iiif-workbench.md#任意のgpu版を固定する)を参照。

## 2026-10-05: 次期開発版のOCR比較評価

- Node-onlyの`evaluate_ocr`を追加。原runと画像・出典を再検証し、原OCRと同じ領域の読解・修訂候補を参照翻刻と比較する。CERと文字多重集合F1、校合宣言、学習重複、Canvas数／領域数を分けて保存する。
- 伊勢物語・当世料理（版本）・膳部料理抄（写本）の12画像でローカルOCR→import→評価を確認。公開翻刻との一致度6画像、参照未登録6画像、文字単位校合0画像。学習重複は未確認、VLMの実比較は継続。精度や未知資料への汎化を確認済みとは扱わない。
- 0.17.0、MCP30 tools／21 sources、新規npm依存0、外部OCR・モデル送信0を維持。評価JSONと指標の使い方は[利用ガイド](iiif-workbench.md#同じ画像の候補を比較評価する)を参照。

## 2026-10-05: 次期開発版のローカルくずし字OCR

- 任意導入のNDL古典籍OCR-LiteをCPUで呼び出す`inspect_ocr_provider`・`run_ocr`・`import_ocr`を追加。保存済み画像とengineのhashを検証し、原出力・行座標・時間・失敗記録を保持する。
- 比較画面でOCR原文と行領域を往復し、記録者付きの校合・修訂候補を別履歴へ保存する。原OCR本文はunverifiedを維持し、既存TEIを保持する。
- 公開伊勢物語1領域・9行で実engineの実行とimportを確認。資料別の品質評価とVLM比較は継続する。個人の日常利用の頻度より、前近代資料を読む一般利用者を設計の基準とする。
- 開発checkoutで利用できる。package version0.17.0、公開MCP30 tools／21 sources、新規npm依存0を維持。通常利用はNode-only、OCR実行は任意Python環境、画像の外部OCR送信0。導入と操作は[利用ガイド](iiif-workbench.md#ローカルくずし字ocrを使う開発版)を参照。

## 2026-10-05: 次期開発版のTEI・IIIF往復

- 任意CLI `link_tei`で固定したローカルXMLの明示facsをworkspaceへ対応付ける。surfaceのsameAs宣言・全域の明示指定・zone矩形の座標変換を扱い、候補と未解決を残す。
- 比較画面からTEI本文と領域を往復し、手動対応と原画像との本文校合を別々に保存する。読解資料は原構造・locator・校合履歴を併読用JSONへ保存する。
- 開発checkoutで利用できる段階。npm公開版0.17.0の機能範囲は従来どおり。公開MCP30 tools／21 sources、新規npm依存0、外部OCR・モデル送信0。詳細は[利用ガイド](iiif-workbench.md#tei本文と画像領域を往復する開発版)。
- 第3段階は資料別のくずし字OCR・VLM・画像併用補正評価と任意provider接続、第4段階は類似図版・整列差分の候補評価へ進む。
- 次のバージョンアップは、TEI往復・くずし字OCR・モデル接続・類似図版検索／整列差分を実資料で利用・検証できる状態に揃えてから行う。開発中は0.17.0を維持し、完了条件は[IIIFガイド](iiif-workbench.md#ocrモデル接続画像解析への進め方)へ集約する。

## 2026-10-05: v0.17.0 IIIF比較画面と画像読解

- 任意CLI `jp-lit-iiif`で公開IIIF 2/3 manifestを読み、ローカルの1〜4窓で資料・ページを比較する。
- 矩形、タグ、選択理由、原テキストを保存し、Canvas ID・座標・出典hashを保った読解資料を作成する。既存AIアプリで画像を開いて候補を作り、元領域へ戻って確認する。
- `jp-lit-iiif` Skillを4つ目の同梱Skillとして追加する。公開MCPは30 tools / 21 sourcesを維持し、通常起動は比較画面・OCR・Pythonを要求しない。
- Mirador4.2.6を固定してbundleと許諾文を同梱する。利用方法・対応範囲は[IIIFガイド](iiif-workbench.md)、変更と互換性は[リリースノート](releases/v0.17.0.md)を参照する。

## 2026-10-05: ドキュメントと現行仕様の整合

- TEI通常導入を0.16.0へ揃え、installerが既存の同名3 Skillsを更新することを明記した。
- README・技術リファレンス・使い方ガイドの呼び出し例へ必須の `session_id` を補い、調査開始時に取得する `SID` を説明した。
- session exportの `allow_external_path` / `overwrite`、Skill詳細の `methods`、TEIの `unsupported_runtime` と終了値を現行実装に合わせた。
- package versionは0.16.0、機能・依存関係は継続する。文書更新はGitHubへ反映し、npm同梱文書への反映は次回リリースで行う。

## 2026-10-03: v0.16.0 検索条件・調査方法export

- `jp_lit_search` に取得時contextとsource別件数根拠を追加。NDL・CiNii・J-STAGEの実送信builderと記録条件を共有する。
- sessionごとの `method_snapshot` を保存し、共有cacheのrefreshと過去sessionの取得時情報を分ける。
- `jp_lit_export_session(profile="methods")` でMarkdown/JSONを出力。検索条件ごとの最新entry、未記録情報、agentの申告、対象外toolと限界を示す。
- 補助漢字を含む検索語の文字種判定を修正。MCP 30 tools、21 sources、既存検索/旧export/TEI契約を維持する。package versionは0.16.0。[リリースノート](releases/v0.16.0.md)に変更と互換性の範囲を記載する。

## 2026-10-03: TEI利用ガイドのAI依頼中心への整理

- [TEI利用ガイド](tei-reader.md)を、導入、AIへの読解依頼、結果の確認と研究記録の流れに整理した。通常の読解ではAIがreaderの呼び出しを担当することを明記した。
- 手動PowerShell例、要求JSON、応答と上限・エラーの詳細を[CLI技術資料](../packages/tei-reader/README.md)へ移した。TEIの研究例、公開資料、文献調査と再読の往復を保持した。
- この改稿自体は文書の更新であり、MCP・readerの操作と依存関係を維持する。v0.16.0の配布物に同梱する。

## 2026-10-03: v0.15.2

- TEIの基本、XMLとタグ、データ作成者の判断を、漱石・古典・歴史史料の具体例とともに[利用ガイド](tei-reader.md)へ追加した。
- 『こころ』と廣瀬本万葉集を例に、本文の語・主題から関連文献を探し、先行研究を確かめて同じ箇所を再読する手順とAIへの依頼文を示した。
- デジタル漱石、廣瀬本万葉集、校異源氏物語、延喜式の公開入口と、書誌検索・公開TEI探索・保存XML読解の役割を説明した。
- READMEと使い方ガイドの入口を更新。MCP 30 tools、21 sources、TEI readerの4操作と利用条件を維持する。[リリースノート](releases/v0.15.2.md)に変更範囲を記載する。
- 公開状態は[GitHub Release](https://github.com/itarunnn/jp-lit-mcp/releases/tag/v0.15.2)と[npm](https://www.npmjs.com/package/jp-lit-mcp)で確認できる。

## 2026-10-03: v0.15.1

- 日本文学・日本史の研究者向けに、TEIの用途、依頼例、導入、4操作のPowerShell例、出力の読み方、エラー対応を[利用ガイド](tei-reader.md)へ追加した。
- READMEと使い方ガイドからTEIの入口を整え、利用文書をnpm配布物に含める。
- MCP 30 tools、21 sources、TEI readerの操作と利用条件を維持する。[リリースノート](releases/v0.15.1.md)に変更範囲を記載する。
- 公開状態は[GitHub Release](https://github.com/itarunnn/jp-lit-mcp/releases/tag/v0.15.1)と[npm](https://www.npmjs.com/package/jp-lit-mcp)で確認できる。

## 2026-10-03: v0.15.0

- 任意CLI `jp-lit-tei-reader` と `jp-lit-tei` Skillを同梱。MCPの公開tool 30種・source 21種は維持する。
- Python readerの4操作、hash付きlocator、原構造の保持、scope付き参照点検を提供する。[導入・契約](tei-reader.md)を参照。
- Node.jsのみのMCPと、uv/Python3.13を使うTEI読解を別々に起動できる。
- [リリースノート](releases/v0.15.0.md)に変更・検証範囲を記載する。公開状態は[GitHub Release](https://github.com/itarunnn/jp-lit-mcp/releases/tag/v0.15.0)と[npm](https://www.npmjs.com/package/jp-lit-mcp)で確認できる。
- Windowsの最終検証でNode24は85 files / 912 tests、Pythonは49 tests、build / scripts typecheck / offline MCP smoke、audit 0件。配布tarballからreaderとSkillを実行し、独立レビューの索引容量の指摘を修正した。Windowsのpipe encodingに依存するヘルプ表示も回帰検証を追加した。

## 過去の検証記録

2026-09-06 時点の状態:

- 公開ツール 30 種。対応 source 21 種（`ndl_reference_books` を含む）。`0.14.0` の変更と最終レビュー修正を含む fresh `npm test` は 83 files / 904 tests で通過
- `npm run build` / `npm run typecheck:scripts` / `npm run smoke:mcp:offline` は fresh 実行で通過
- 2026-08-25 10:04 JST に `ndl_reference_books` を adapter 直結（cache bypass、`force_refresh=true` 相当）で live 確認した。`query="哲学"`、`limit=2`、`page=1` の検索は1回だけ成功し、total 197、取得2件、抽出2件で、全件が `source_metadata.reference_book=true`、`reference_ndc=["103.3"]` だった。紹介文あり候補は1件だけ選び、detailも1回だけ成功した（`R100000002-I000002972211`、`summary` / `introduction` = 「第4版(1985年刊)と同内容。」、公式 URL: `https://ndlsearch.ndl.go.jp/books/R100000002-I000002972211`）。この確認は候補メタデータと詳細経路に限り、本文・現物・所蔵・閲覧可否は未確認である。
- `ndl_digital` の詳細取得では `pids` は1〜10件を受け付ける。運用上は1件なら `jp_lit_get_record` の `pid`、2〜10件なら `jp_lit_get_records` の `pids` を使い、canonical な `R100000039-I<PID>` source ID と同じ cache を共有する。PID と source ID は排他的で、他 source の PID 入力は拒否する
- PID 詳細取得では、`content_access.manual_viewing`（公式画面での手動閲覧導線）と `source_metadata.next_digital_library.available`（MCP の OCR 系 tool 利用可否）を独立して返す。本文・画像の自動取得可否や手動閲覧の現在性を、どちらか一方から推定しない
- カーリル図書館MCP用の `npm run smoke:calil-mcp` を追加済み。これは Codex の MCP 設定とは別の Node smoke script。Codex CLI では `codex mcp add calil --url https://mcp-beta.calil.jp/mcp` と `codex mcp login calil` による直結を確認済み。初回 OAuth 認可後、新しい Codex セッションから `mcp__calil__.search_libraries` を呼べる
- live smoke matrix は `jdcat` の上流メンテ時を除き通過実績あり。`nijl_articles` / `kokusho` / `ninjal_bibliography` の明示 live smoke も 2026-05-11 に通過
- GitHub リポジトリ公開済み: `https://github.com/itarunnn/jp-lit-mcp`
- `npx -y jp-lit-mcp` による MCP 起動導線を整備済み
- `npx -y jp-lit-mcp install-skills <app>` による Skills インストール導線を整備済み
- `npx -y jp-lit-mcp doctor` による軽量診断を整備済み
- README / install docs / usage guide / source-usage-conditions を整備済み
- ライセンスは `MIT`

デジコレ全文候補の現在の能力境界は、[デジコレ全文検索ガイド](ndl-digital-collections.md)にまとめています。`jp_lit_search_fulltext` は次世代デジタルライブラリー API の範囲、`jp_lit_record_ndl_browser_search` は許可済みブラウザで観測したデジコレ本体の候補を扱います。両者と書誌検索の候補は、同じ調査 session で一つの候補リストへ統合できます。

## 実装済み

- 書誌検索・所蔵確認・デジコレ OCR / 全文 / 図版検索は実装済み
- NDL「参考図書紹介」を `ndl_reference_books` として明示検索できる。レファ協／NDL リサーチ・ナビ → 参考図書候補検索 → detail → `cinii_books` / カーリル / 各館 OPAC の所蔵確認を Skill と公開文書に固定し、候補一覧から所蔵・閲覧可否を推定しない。既定横断外で、sort / 期間 / `filters.ndl` は未対応
- 同じ source の選別済み候補1〜10件を、順序を保った部分成功と単件 cache/session 共有で詳細取得する `jp_lit_get_records` を実装済み
- レファレンス協同データベース（CRD）は `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases` として実装済み
- ローカルキャッシュ、明示的な調査セッション開始（`jp_lit_start_session`）、調査セッション保存（`jp_lit_annotate_session`）、Markdown / JSON / CSL JSON エクスポート（`jp_lit_export_session`）に対応済み
- 検索・取得・照合・典拠補助などの cached tool と annotation / trace / session export は、調査案件を指す `session_id` を必須入力として明示 routing する。`session_id` は MCP transport の `Mcp-Session-Id` や結果保存用 `cache_key` とは別で、`current.json` はローカル互換用 mirror に限定する
- 過去セッション一覧（`jp_lit_list_sessions`）、過去セッション検索（`jp_lit_find_sessions`）、`session_id` 指定 export に対応済み
- 保存済み検索結果の一覧・検索・再整理・view export・削除・古い cache の pruning（`jp_lit_list_cache` / `jp_lit_search_cache_index` / `jp_lit_refine_results` / `jp_lit_export_view` / `jp_lit_delete_cache` / `jp_lit_prune_cache`）に対応済み
- デジコレ公式画面の browser 観測を strict schema で検証し、MCP 自身はブラウザ・ログイン・外部通信を行わず local cache/session へ保存する `jp_lit_record_ndl_browser_search` を追加済み。API / browser / fulltext の三 candidate result を tool-aware な `result_refs` で扱い、同一 PID の provenance を保って統合・注釈・export できる
- Web NDL Authorities から典拠候補・別名義・分類由来の件名標目候補・安全な検索ヒントを返す補助 tools（`jp_lit_resolve_authority` / `jp_lit_find_authority_terms_by_classification`）を追加済み
- Web NDL Authorities の件名語から NDC / NDLC 分類記号を提案し、CiNii Books `category` filter に渡せる `jp_lit_suggest_classification_codes` を追加済み。`jp_lit_search` は CiNii 系検索の 0 件・ローマ字 query と、source を問わない広い結果集合に `diagnostics` を返す
- KAKEN から研究課題・研究成果報告書 PDF・成果リストの手がかりを返す補助 tool（`jp_lit_search_kaken_projects`）を追加済み。KAKEN は `jp_lit_search` の source ではなく、文献確定前の検索語展開・報告書確認の入口として扱う
- Crossref / OpenAlex で単一文献候補を DOI・タイトル・著者・刊行年から照合する補助 tool（`jp_lit_enrich_record`）を追加済み。外部 provider は `jp_lit_search` の source ではなく、既存候補の書誌確認を補強する用途に限定する
- `jp_lit_refine_results` は、保存済み `jp_lit_enrich_record` cache を任意で重複クラスタへ重ね、DOI・provider status・match confidence を表示できる。これは外部 API の再照会ではなく、本文確認や重要度評価でもない
- `cinii_dissertations` を CiNii Research 統合後の博士論文・学位論文 source として追加済み。既定横断には含めず、学位論文を探す意図があるときに明示指定する
- Skill の調査行動に関する feedback を受け取るための issue templates と feedback guide を整備済み
- 既存Web補助確認に、速報性が高く消えやすい投稿を `agent_web` / `ephemeral` evidenceとして同じ調査 `session_id` へ保存する契約を追加。投稿は調査の発端として扱い、出版社・雑誌・NDL・CiNii等で正式確認する。新しいMCP tool、Yahoo専用adapter、スクレイパーは追加していない

## 最近の更新

- `0.14.0`: デジコレ公式画面で観測した候補の local-write tool、三 candidate result の adapter、tool-aware cache index/refine、browser provenance を保つ Markdown / JSON / CSL JSON export を追加。Skill と公開文書では、明示許可済みの既存ログイン session、`ndl_onsite_only`、検索ヒット・資料詳細・本文画像・資料内全文検索・印刷/PDF状態の境界を実 enum に合わせた。最終 review では offset 付き観測日時を実時刻順へ修正し、三経路の NDL URL / PID / source ID と制御文字境界を厳格化した
- `0.13.0`: `ndl_digital` の既知 PID を `jp_lit_get_record` / `jp_lit_get_records` へ直接渡せるようにし、canonical source ID と単件 cache を共有した。`ndl_reference_books` を追加し、参考図書・レファ本・事典・辞典・書誌・索引・年鑑の自然言語 routing を `jp_lit_search` と `jp-lit-research` に追加。検索結果・detail の `source_metadata.reference_book` / `reference_ndc` / `introduction` / `has_introduction` を公開し、紹介文なしのレコードを区別する。NDL オープンデータセットの runtime 一括取り込みは行わず、公開検索エンドポイントを都度使う候補探索に限定する
- `0.12.0`: 既存 `EvidenceRef` を後方互換のまま拡張し、速報Web投稿の検索サービス、検索語、投稿URL、投稿者、投稿日時、確認日時、リンク先を構造化保存・Markdown exportできるようにした。Skillでは既存Web補助確認の条件付き分岐としてrunbookへ案内し、投稿だけで書誌的事実・真偽・学術的評価を確定しない境界を追加した。公開ツール数とsource数は変更なし
- `0.11.0`: jp-lit の `session_id` を MCP transport の `Mcp-Session-Id` や結果保存用 `cache_key` と分離し、調査案件を指す明示的なアプリケーション側 handle として確定した。検索・取得・照合・典拠補助などの cached tool と annotation / trace / session export は `session_id` 必須となり、同じ cache を複数セッションで共有しながら利用記録を指定先へ分離する。非 current session の更新で `current.json` を切り替えず、`jp_lit_refine_results` は `cache_key` / `cache_keys` / `session_id` のいずれか1つを必須 selector として暗黙の current fallback を削除した。Skill、README、reference、offline smoke も明示 handle workflow へ移行した
- `0.10.0`: 検索後に選別した同じ source の1〜10件をまとめて詳細取得する `jp_lit_get_records` を追加。入力順を保つ部分成功、重複 ID の外部照会抑制、`jp_lit_get_record` と共通の単件 cache / session を実装した。これは上流の全件収集 API ではなく、生の検索結果全件を自動詳細化しない。`ndl_digital` 候補では、OCR やブラウザ確認の前に `content_access.manual_viewing` と `source_metadata.next_digital_library.available` を候補ごとに確認する既定手順を Skill とガイドへ追加した。デジコレ本体の公式検索画面を Browser / Chrome で操作する場合は、利用可能なブラウザとアクセス範囲を説明してユーザーの明示確認を得てから実行し、ログイン済み Chrome はその閲覧権限内だけで利用する。公開 API のないデジコレ本体全文検索をブラウザで補う利点と、再現性・自動化・網羅性の制約を明記した
- `0.9.1`: 発掘調査報告書・遺跡・埋蔵文化財・出土遺物は、明示指定した `irdb` を最初に使い、`ndl_search` で広域の書誌・所蔵候補を確認し、NDL 所蔵だけが必要な場合に `ndl_catalog` を使う routing を追加。全国文化財総覧の一部レコードを既存 IRDB / NDL Search 連携メタデータから間接 discovery する境界であり、全国の発掘調査報告書を完全収録するという主張ではない。IRDB search / detail では安全な HTTP(S) provenance URL、DOI・HDL・URI、複数ファイル URL、全国文化財総覧 record metadata を保持し、NDL Search では空の abstract が description fallback を妨げないようにした。全国文化財総覧本体の OAI-PMH harvest、endpoint 呼び出し、リンク先 PDF・画像・Excel・報告書本文の取得は実装していない。MCP SDK と XML parser を修正版へ更新し、production / development dependency の audit 0件を確認した
- `0.9.0`: 全体レビューを反映し、cache / export の path containment と上書き境界、junction / symlink と書込失敗時の復旧、明示的な `jp_lit_start_session`、session 更新の直列化、28 tool の実副作用に沿った annotations を整備した。J-STAGE pagination を現行 `start` contractへ修正し、CiNii appid 未設定時は検索を継続しつつ公式必須の警告を返す。横断検索は一部 source 障害時も成功結果と `source_errors` を返し、全 source 失敗時だけ全体 error とする。Node.js 22以上、Windows / Ubuntu × Node 22 / 24 CI、deterministic offline smoke、audit 0件、publish tag identity検証を追加し、デジコレ本体の画面内部 endpointは公開MCP・公開文書・npm packageへ含めない境界を維持した
- `0.8.0`: `jp_lit_suggest_classification_codes` を追加。Web NDL Authorities の件名語から NDC / NDLC 分類記号を抽出し、CiNii Books `category` filter に渡せる `suggested_category_param` と `jp_lit_search` 呼び出し例を返す。`jp_lit_search` は `filters.cinii.category` を `source=cinii_books` のときだけ受け付け、CiNii 系検索の 0 件・ローマ字 query と、source を問わない広い結果集合に `interpretation` / `diagnostics` を返す
- `0.7.10`: 次世代デジタルライブラリー Book API の `f-ndc` filter について、`f_ndc: "9"` のような短い上位分類指定を `9*` に正規化し、`f_ndc: ""` や空白だけの値は未指定と同じ cache entry に畳むようにした。adapter test では公式パラメータ `f-ndc` / `fc-isClassic` と、非採用 alias（`field` / `ndc` / `isClassic`、Illustration API の `q-contents` / `graphictag`）が URL に混入しないことを固定した
- `0.7.9`: デジコレ OCR 系ツールの検索範囲を明確化。`jp_lit_search_fulltext` は次世代デジタルライブラリー API の OCR 検索であり、デジコレ本体の全文検索画面/API ではなく、「ログインなしで閲覧可能」資料全体の検索でもないことを README / usage guide / reference / tool description に明記した。デジコレ本体の公式検索画面では、ログインなし公開資料、館内限定資料、送信サービス限定資料を含む MCP 範囲外の全文ヒットが見える場合がある。網羅性が必要な調査では、MCP の結果だけで「デジコレ全文にヒットなし」と断定せず、公式画面でのブラウザ検索・手動確認を併用する運用にした。次世代デジタルライブラリー Book API の NDC 上位分類 filter は `9*` のような前方一致で扱い、`f_ndc: "9"` のような短い数字は MCP 側で `9*` に正規化する
- `0.7.8`: NDL デジタルコレクション detail に `content_access.manual_viewing` を追加。`source_metadata.next_digital_library` は MCP が自動 OCR / 全文 API を使えるかの判定として維持し、個人送信対象・図書館送信対象・国立国会図書館内限定のような手動閲覧導線を分けて返す。MCP から全文を自動取得できなくても、NDL の登録利用者ログインや参加館・館内端末で読める可能性をエージェントが説明できるようにした
- `0.7.7`: Gitleaks / Timeahead の repository history scan で JDCat の public schema field ID が `generic-api-key` として検出される偽陽性を確認し、該当 fingerprint だけを `.gitleaksignore` に登録。現行コードでは mapper 内の引数名を `langField` / `textField` に変更し、credential 風の命名を避けた。実 credential の流出ではなく、MCP tool / source の追加・削除もない
- `0.7.6`: `jp_lit_enrich_record` を追加。Crossref は無認証 REST + 任意 `CROSSREF_MAILTO`、OpenAlex は `OPENALEX_API_KEY` 前提で、未設定時は `providers.openalex.status="skipped"` として扱う。`jp_lit_refine_results(include_enrichment=true)` では保存済み照合 cache を重複クラスタに付与できる。`cinii_dissertations` を明示 source として追加し、CiNii Research OpenSearch の `dissertations` search type を使う。既定横断・live smoke matrix には含めず、CSL JSON export では博士論文候補を `type="thesis"` として出力する。未収録・低引用を日本語人文系文献の低重要度とは扱わない
- `0.7.5`: README / install docs / GitHub Skills 導線を整理。Skill-first の導入説明、カーリル図書館MCP、CiNii Research API の `appid` を `CINII_RESEARCH_APP_ID` として MCP server env に渡す説明を初見向けに明文化。MCP tool の追加・削除はなし
- `0.7.4`: `jp-lit-research` の確認ラベルを `候補確度` / `確認` / `本文` に分離。NDL Search 等のヒットのみを関連文献や本文確認済みとして扱わない契約、デジコレ OCR 複合語 0 件の扱い、長期調査の rolling checkpoint / 分担契約を明文化
- `nijl_articles` / `kokusho` / `ninjal_bibliography`: 国文学論文、国書・古典籍、日本語研究・日本語教育文献の専門 DB を明示 source として追加。既定横断には含めず、manifest 本体・画像本体・本文一括取得をしない確認導線として運用
- `jp_lit_search_kokusho_fulltext` / `jp_lit_search_kokusho_image_tags`: 国書DBの本文スニペット検索と画像タグ検索を、書誌 source とは分けた専用 tool として追加。本文全体・画像本体・manifest 本体は取得しない
- 検索・取得系 cached tool の挙動を統一。`force_refresh=true` を明示しない限り cache を優先し、cache hit 時は保存日時と「上流APIへは再検索していません」という導線を返す
- `jp_lit_list_sessions`: 過去の調査セッションを新しい順に一覧し、trace / 採用候補 / source / 作成・更新日時で再開候補を棚卸しできる tool を追加
- `0.3.0`: `national_archives` / `jacar` を明示 source として追加。国立公文書館DA・JACAR の目録確認に対応し、既定横断には含めない慎重な導線として運用
- 保存済み検索結果の refined export で、重複候補クラスタと `search_result_readiness` を確認できる導線を追加
- `jp_lit_search_kaken_projects`: KAKEN の研究課題・研究成果報告書 PDF・成果リスト preview を、文献確定前の補助 tool として追加
- `jp_lit_resolve_authority` / `jp_lit_find_authority_terms_by_classification`: Web NDL Authorities から典拠候補・別名義・分類由来の件名標目候補・安全な検索ヒントを返す補助 tools を追加
- `0.1.3`: `doctor` コマンドを追加。Node.js、package version、同梱 Skills、cache / exports 書き込み、`CINII_RESEARCH_APP_ID` の有無を live API なしで診断
- `jp_lit_prune_cache`: 古いローカル cache を dry-run で確認してから削除できる MCP tool を追加
- `0.1.2`: `--help` / `--version` を追加
- `0.1.1`: Windows で `npx -y jp-lit-mcp install-skills <app>` が使える導線を修正
- `irdb`: HTML の `&#039;` エンティティが `'` に正しくデコードされない問題を修正（`alternative_titles` 等）
- 各 source の資料詳細 URL を拡充済み
  - `jp_lit_search_fulltext` / `jp_lit_search_illustrations` に `viewer_url` を追加
  - `japan_search` / `nihu_bridge` に fallback URL を追加
- 全 source の search 結果で `issued_at`（発行年）を取得できるよう修正済み
  - `japan_search`: `common.datePublished` を使用
  - `nihu_bridge`: `dateCreated[刊行年月]` を優先、登録日（`datePublished`）は除外
  - `jdcat`: JDCat 登録日ではなく調査対象年（Time P フィールド）を使用
- `filters.jdcat` を追加（`source=jdcat` のときのみ有効）
  - `subject` / `geographic` / `contributor` / `title`: Elasticsearch フィールド指定で `q` に AND 結合
  - `temporal` / `creator`: JDCat 独立パラメータとして渡す
- Codex の Skills 配置を公式導線に合わせ、`~/.agents/skills/` へ変更
- Cursor の Skills は repo 内 mirror ではなく、`~/.cursor/skills/` へインストールする導線に整理
- npm package の `bin` / `files` / `prepack` を整備し、通常利用では clone/build せず `npx` から使える導線に変更

## 同梱 Skills

### jp-lit-research

- Claude Code / Codex / Cursor 対応
- 起動語「文献DBで」「文献DBを始めます」で発火。一度発火したらセッション中継続
- 全モードで調査計画を提示してユーザーの確認を取ってから実行する（plan-first）
- 未知の文献・資料・調べ方を探索する調査では、実検索前に調査前情報収集（CRD・NDL リサーチ・ナビ）を行い、結果を計画に反映する
- source の選択は語尾ベースの深度判定ではなく、計画確認の対話を通じてユーザーと決める設計
- 検索 MCP（`jp_lit_search` / `jp_lit_get_record` 等）はユーザー確認後のみ実行
- 全報告テンプレートに source（DB名）を付記
- `jp_lit_search` の description にユーザーの自然言語表現→source の読み替えを追記

### jp-lit-verification

- 起動語「文献検証で」「資料検証で」「実在するか確認して」「存在確認して」等で発火
- 他サービスや他セッションの貼り付け文章を対象に、日本語文献・資料の実在性・存在を検証できる
- `ndl_search` を第一関門にして `実在確認済み` / `部分一致` / `非実在の疑い` / `混線の疑い` を表で返す
- 各候補について、判定理由・一致根拠・不一致点を文章で説明する

## 公開後メモ

- npm package 公開済み。公開前は `npm publish --dry-run` と tarball smoke を確認する
- GitHub About / topics / release note は整備済み
- 検討中 source: `nihonbungaku_metadata`。日本文学研究メタデータ検索は有望な日本文学論文メタデータ source だが、個人運営サービスで外部連携 API は連絡前提と読めるため、未許諾の adapter 実装は行わない。将来実装する場合は、利用者ごとの `NIHONBUNGAKU_METADATA_API_KEY` とローカル個人調査用途のキャッシュ境界を前提にする。
- 次の改善候補は `jp_lit_enrich_results` による複数候補の重複統合・証拠 ranking、検索品質 eval
