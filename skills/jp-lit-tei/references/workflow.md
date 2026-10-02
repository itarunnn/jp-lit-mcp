# 探索・取得版・構造読解の手順

## 資料候補と公開TEI

作品・著者・底本・収録範囲・研究上の問いを出発点にする。jp-litが利用可能なら適用するjp-lit-researchの契約に従い、新規調査をjp_lit_start_sessionで開始してsession_idをstateful toolへ渡す。書誌レコードとTEIの公開先は別に確認する。

公開機関・編者の公式案内からrepository/datasetへ進み、公開者、対象作品、底本・範囲、版ID、XML実体、利用条件を確認する。書誌とTEIの対応根拠を、作品名・編者・底本・収録範囲の一致/相違として記録する。

toolが未公開・無効ならjp-lit探索を未実行と記す。利用可能な公開一次情報と取得済みXMLの読解を進める。MCP設定変更や架空のsession/tool結果を作ることはこのSkillの仕事に含めない。

探索記録には実query、source/record ID、公式URL、確認日、版候補、対応根拠、未確認事項を残す。

## 版固定と取得台帳

公開の通常経路から単一XMLを取得する。Git repositoryは完全commit IDとrepository内path、datasetは不変の版IDを使う。版IDがない場合は取得日時とhashでsnapshotを区別する。既存snapshotを保持して新しい版を別保存先に置く。

取得した元bytesからbytes数とSHA-256を計算する。取得URL・日時・公開説明と権利の保存版を対応づける。認証・閲覧制限・画像取得は利用環境の許可範囲に従う。

reader用manifestはJSON array。各recordの必須fieldはlocal_path/sha256/bytes。local_pathは台帳parentを基準に解決し、指定XMLに一致するrecordはちょうど1件とする。sha256は小文字hex64桁、bytesは非負整数。任意fieldはurl/repository/commit/path/retrieved_atのstring。探索・権利・利用条件の説明は別の研究ノートへ保存する。

## 4操作の呼出し

CLIはUTF-8要求JSONを1件受け、stdoutへJSON1件とLFを返す。XMLとmanifestのfile_pathは絶対ローカルpath。要求fileはcallerの相対pathまたはstdinを使える。

1. inspect_documentにXMLと任意provenance_manifest_pathを渡す。実測hash、structure_warnings、headerの原記述、manifest_claimsの一致を確認する。
2. 同じhashでbody/header locatorをscopeにlist_unitsする。elementは`{http://www.tei-c.org/ns/1.0}div`などexpanded name、属性は完全一致で指定する。scope自身はitemsへ含まれない。
3. listのlocatorをそのままextract_unitへ渡す。本文・訓・訂正・注記を各要素の原順序で保存する。大きい章は小単位へ分割する。
4. check_referencesのscope_xpathへ抽出対象のxpathを渡す。複数候補は個別に点検する。itemsはoffset/limitのページ、summaryは選択範囲全体。全件確認はnext_offset=nullまで進める。

scope省略/nullのcheckは全文書点検。選択範囲の参照先は全文書のIDに解決する。xml:baseが祖先にある場合もそのchainを保持し、解釈を保留する。XML空白以外でtokenを区切らず、コンマ・Unicode・percent表記を補正しない。

上限はXML10MiB、深度256、10万要素、XPath索引の全文字列累計16,777,216文字、要求/manifest64KiB、一覧最大100件、抽出2,000要素/4,000node/20,000 payload文字、応答1MiB。document_too_complexは文書構造または索引の上限超過。詳細はCLIに同梱された公開repositoryの `docs/tei-reader.md` を参照する。

## 実行とJSONの消費

```sh
npx --yes --package=jp-lit-mcp jp-lit-tei-reader --request /absolute/path/request.json
```

Python json.loadsで読むか、PowerShell 7ではConvertFrom-Json -AsHashtable -ErrorAction Stopを使う。default namespaceの空keyを保持し、通常のPSCustomObject変換だけで成功を判定しない。CLI直後のLASTEXITCODEとJSONのokも確認する。

成功は終了0、要求エラー2、XML/hash/上限/locatorエラー3、内部/launcherエラー4。runtime_launch_failedはuv/Python、hash_mismatchは対象版、unit_too_large/output_too_largeは選択単位・ページを確認する。stdoutの保存もUTF-8で行う。

## 根拠付き報告

| 欄 | 必須の根拠と限定 |
| --- | --- |
| 対象と版 | XML path・実測hash/bytes・manifest対応状態 |
| 候補と採用 | 全一致数、候補locator、選択根拠 |
| 原構造と解釈 | choice/subst/noteの原枝、こちらの解釈を別欄へ |
| 参照 | scope、属性、集計、ページ範囲、未解決/保留token |
| 書誌と権利 | headerとREADME/LICENSEの原記述・位置、記述差 |
| 画像 | XML内対応、到達、実見、校合を個別に |
| 確認状態 | schema、外部取得、人物同定、底本照合の実施範囲 |
| 保存先 | 取得台帳、要求JSON、生応答、研究ノート |

XMLの校合宣言は編者の申告として保持し、今回こちらが行った校合とは分ける。readerのwell-formed確認からTEI schema適合を推定しない。研究本文や認証情報を公開成果物へ自動転送しない。
