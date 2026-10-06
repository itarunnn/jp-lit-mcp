# IIIF比較・読解の呼び出し

Node22以上を使う。v0.17.0から配布する。通常導入はrepo外から`npx --yes --package=jp-lit-mcp@0.17.0 jp-lit-iiif`を呼ぶ。global/local install済みなら`jp-lit-iiif`を呼ぶ。source checkoutは`npm ci` / `npm run build`後に`node scripts/iiif-workbench.mjs`を呼ぶ。

要求JSONはUTF-8、`api_version="0.1"`、JSON内の保存先pathは絶対pathにする。`--request`のpathだけはcaller cwdからの相対指定も使える。stdoutにJSON1件、終了値は0成功／2入力不正／3未対応／4取得・起動失敗。

## ページを調べる

`inspect_manifest`に`manifest_url`を渡す。必要に応じて`source`、`source_id`、`record_url`、`sequence_id`を追加する。返るCanvas順序は1始まりで、印刷頁とは別の情報である。

## 比較画面を準備する

`prepare_workspace`に1〜4件の`candidates`と`output_dir`を渡す。candidateは`source`、`source_id`、`record_url`（不明はnull）、`manifest_url`、`acquisition`、`verification_state="candidate"`を持つ。acquisitionは`provider_metadata`／`derived_from_pid`／`manual_url`。v2のsequence指定は`sequence_ids`のmanifest URLをkeyにする。

```json
{
  "api_version": "0.1",
  "operation": "prepare_workspace",
  "output_dir": "/absolute/project/iiif-workspace",
  "candidates": [{
    "source": "manual", "source_id": "selected-book", "record_url": null,
    "manifest_url": "https://provider.example/manifest.json",
    "acquisition": "manual_url", "verification_state": "candidate"
  }]
}
```

返った`workspace_path`で`jp-lit-iiif serve --workspace <absolute path>`を起動し、表示された起動URLを利用者へ渡す。終了はCtrl+C。同じ資料の別ページは画面の「別窓で比較」で追加できる。起動URLのtokenは、その起動中だけのlocal secretとして扱う。

## 選択した画像を保存する

画面で矩形、タグ、選択理由を記録して保存する。`export_evidence`には`workspace_path`、1〜4個の`region_ids`、新しい`output_dir`を渡す。`image_permission_confirmed`は、選択資料の画像取得・利用条件が確認済みの場合にtrueへ設定する。利用条件の原記述はworkspaceに残る。

`output_dir`は未作成のdirectoryにする。初版のexportは`overwrite=true`でも既存directoryを拒否する。再exportは別の保存先を使い、旧画像・出典・利用者のanalysisを保全する。`prepare_workspace`のoverwriteによる作業更新とは別の契約である。

返った`image_paths`の画像を実際に開いてから観察する。`evidence.json`はmanifest hash、Canvas ID、矩形、画像URL、取得画像hash、縮小寸法、テキストの出典を持つ。`image_service`は限定取得したinfo.jsonの原画像寸法、receipt、保存pathと原利用条件を持つ。painting bodyの寸法が縮小表現である場合も、この原画像寸法で座標を変換する。`original_image.sha256=null`は原画像本体を取得していない状態で、取得したcropのhashは`display_image.receipt.sha256`にある。

`analysis-template.json`をコピーし、生成者・実行時刻、evidence_idごとの観察、翻刻候補、解釈、疑義を記入する。原テキストのtxtをAI候補で上書きしない。`analysis.json`を検査するときはpackageの`dist/src/iiif/evidence.js`がexportする`validateAnalysis(value, evidenceIds)`を使える。

## TEI本文と画像領域を結び付ける（開発版）

CLIの`--help`に`link_tei`がある場合に使う。npm公開版0.17.0は初版の比較・書き出し機能を提供する。開発checkoutでは`npm ci`・`npm run build`の後、次の要求を`node scripts/iiif-workbench.mjs --request <request.json>`で実行する。uv／Python3.13はTEI操作で必要。

link_teiは指定したローカルXMLとworkspaceを読み、manifestや画像の取得、外部OCR／モデルへの送信を行わない。初回のuv環境準備ではPython runtimeを取得する場合がある。比較画面での画像表示は提供元へのアクセスとして別に扱う。

```json
{
  "api_version": "0.1",
  "operation": "link_tei",
  "workspace_path": "J:/research/workspace.json",
  "output_path": "J:/research/linked.json",
  "file_path": "J:/research/source.xml",
  "expected_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "document_id": "d1",
  "surface_bindings": [{
    "surface_xpath": "/t:TEI[1]/t:facsimile[1]/t:surface[1]",
    "canvas_id": "https://example.org/c1"
  }],
  "limit": 20,
  "offset": 0,
  "overwrite": false
}
```

例のpath・hash・IDを実測値とworkspaceのIDへ置き換える。surface_bindingsはsurface全域とCanvas全域の対応を確認した場合に指定する。直接Canvas URIを指すfacs、surfaceのsameAs宣言はworkspace内で一致するCanvasへ対応する。zone座標はsurface原点・範囲から変換する。graphic画像URL一致だけはcandidate、重複ID・base・座標不足・polygon・回転等は診断付きで保留する。

応答のokと終了値、states、next_offsetを確認する。続きはworkspace_path/output_pathを出力済みworkspaceへ揃え、offset=next_offset、overwrite=trueで追加する。limitは1〜100。XML hashが違う場合は版を点検する。同じ版の再実行は実行者付きの対応・校合記録を上書きしない。未記録の対応には後からsurface_bindingsを適用できる。

`node scripts/iiif-workbench.mjs serve --workspace J:/research/linked.json`を起動する。「TEI本文と画像」の「対応する画像へ」で画像へ移動し、領域の「関連TEI本文」で戻る。一覧は100件ずつページを送り、未解決参照も全件を操作できる。手動対応は選択checkbox1件と記録者・理由を要求する。原画像との校合は実施後に結果・確認内容を別履歴へ追加する。未実施ならcollations=[]を保ち、resolvedを校合済みと解釈しない。

exportのtei_evidence/tei_pathsはXML構造とlocatorを持つ併読用のoverlap_context。全頁や部分重なりも含み、選択矩形の翻刻を示さない。pb/cb/lbの後続本文範囲やfacsの継承は今回展開しない。画像を実際に開いてから観察し、AI候補を原TEIへ書き戻さない。

## ローカルくずし字OCR（開発版）

helpに`run_ocr`がある版で使う。任意導入したNDL古典籍OCR-LiteとPythonを利用者が指定する。導入例は[IIIFガイド](../../../docs/iiif-workbench.md#ローカルくずし字ocrを使う開発版)。通常の比較・MCPはNode-only。engine・依存の準備はdownloadを伴うが、OCR実行は保存済み画像だけを読み、外部OCRサービスへ送信しない。

1. 利用条件を確認した領域をexport_evidenceで保存し、display_imageとevidence_idを確認する。raw成果物はResearchLibrary等の研究directoryのwork/ocr配下へ置く。
2. inspect_ocr_providerで絶対pathのengine_dir、python_pathを指定し、返るresult.configをprovider.jsonへ保存する。期待hashの手作業による捏造・省略を避ける。
3. run_ocrにevidence_path、重複しないevidence_ids（1〜4件）、provider_config_path、新規output_dirを指定する。既存翻刻・TEI併読情報（本文の省略診断、空の改頁参照も含む）がある場合は既定で停止。比較を明示依頼された場合だけallow_existing_text=trueを指定する。
4. 終了値とstatusを確認する。runningは処理途中で要求ID一覧と処理中IDを保存し、importを保留する。completedは全対象の成功。partial/failedは終了値4、ok=falseでresult.run_pathに原出力・ログ・失敗記録を残す。partialは正常な領域だけimportできる。再試行は新しいdirectoryを使う。
5. import_ocrにworkspace_path、run_path、output_path、overwrite（既定false）を渡す。正常候補を追加し、失敗数をskippedで返す。同じrunの再importは候補・校合履歴を保持する。hash変更、別workspace、移動領域は診断後に停止する。

```json
{"api_version":"0.1","operation":"inspect_ocr_provider","engine_dir":"J:/ocr/engine","python_path":"J:/ocr/.venv/Scripts/python.exe"}
```

```json
{"api_version":"0.1","operation":"run_ocr","evidence_path":"J:/research/evidence/evidence.json","evidence_ids":["r1"],"provider_config_path":"J:/research/provider.json","output_dir":"J:/research/work/ocr/run-01","allow_existing_text":false}
```

```json
{"api_version":"0.1","operation":"import_ocr","workspace_path":"J:/research/workspace.json","run_path":"J:/research/work/ocr/run-01/run.json","output_path":"J:/research/with-ocr.json","overwrite":false}
```

各JSONを`node scripts/iiif-workbench.mjs --request <request.json>`で実行する。with-ocr.jsonで比較画面を起動・読み込み、「原画像の領域へ」「この行の画像へ」で実見する。「関連OCR候補」は領域からの復路。OCRのtext・行boundingBox・Canvas変換・source hash・engine hash・時刻・原出力pathを保持する。confidenceは領域検出の信頼度。校合は実施後に記録者・結果・注記・任意の修訂候補を別履歴へ追加する。UI操作だけの確認はuncertainで未校合の範囲を明記する。原OCR本文はocr_candidate/unverifiedを維持し、原TEIと上流生成のraw TEIを別に保存する。

## OCRの参照一致度を評価する（開発版）

helpにevaluate_ocrがある版で、OCR候補をimportしたworkspaceと評価JSONを指定する。原run/artifact/画像を再検証し、原本文を変更せずreportをResearchLibraryへ保存する。操作はNode-onlyで、OCR・外部モデル実行や画像送信を伴わない。

```json
{"api_version":"0.1","operation":"evaluate_ocr","workspace_path":"J:/research/with-ocr.json","evaluation_path":"J:/research/work/ocr/evaluation.json","output_path":"J:/research/work/ocr/report.json","overwrite":false}
```

評価JSONはschema_version/evaluation_id/workspace_id/casesを持ち、caseごとにcase_id/text_id/reference/variants/observationsを記録する。形式の正本は[利用ガイド](../../../docs/iiif-workbench.md#同じ画像の候補を比較評価する)。参照の頁・領域対応が不明ならreference:nullとし、pending_referenceを維持する。AI候補はvariantsへ置き、参照正解や原TEIへ昇格しない。領域全体の読解候補だけ同じ画像hashで比較し、部分読解は別の小さい領域へ切り分ける。

公開翻刻との数値はreference_agreement。source_collatedは原画像と確認した記録者付きの宣言がある場合だけ設定する。学習重複known_overlap/declared_held_out/unknownを区別し、精度や学習からの独立性を推定しない。CERのstrictとNFC/空白除去、文字順を問わないF1、原文字列と修訂候補を分ける。Canvas数と領域数を区別し、未比較のimage_reading/image_assisted_correctionと金銭費用未計測を報告する。

原資料の保存先保護はworkspace全体のTEI・OCR出典へ適用する。import_ocr/link_teiのworkspace更新は明示的なoverwrite指定で行い、原XML/run/evidence/artifact/画像への保存は拒否する。原runを読めず保護集合を収集できない場合は、原出力を復元してから再実行する。

## KuroNetによる補助OCR（開発版）

標準の任意ローカルOCRはNDL古典籍OCR-Lite。GPU版の古典籍OCR ver.3は任意の追加方式で、製品provider接続は後続。近代活字用NDLOCR-Liteとは区別する。PCで公開IIIF資料の別候補を得る補助経路には[KuroNet公式ビューア](https://codh.rois.ac.jp/kuronet/iiif-curation-viewer/)と[利用案内](https://mp.ex.nii.ac.jp/kuronet/)を使う。

1. 比較画面でページ・矩形を保存し、その領域の「KuroNetで補助OCR」を開く。パネルのマニフェストURLとCanvas・ページ番号・矩形・回転を確認する。
2. 利用者が公式画面を開き、URLを手動入力してログイン・領域指定・OCR・読み順設定・テキスト変換を行う。KuroNetのOCR結果は公開されるため、公開IIIF資料と利用条件を確認した範囲で使う。アプリは自動API接続・ログイン・画像送信を持たない。
3. 対象領域だけの原文を貼り付け、記録者と任意の結果URLを入力し、領域への対応を宣言して「OCR候補を保存」を押す。ページ全体の本文は比較画面にもページ全体の領域を作って保存する。出力の改行・空白を保持する。
4. `manual_ocr_provenance`へprovider、manual_copy、取込日時、記録者、結果URL、対象workspace・document・manifest hash・Canvas・領域座標を保存し、`source_sha256`へ原文hashを残す。未取得のモデル版・サービス処理画像hashはnull。候補は`ocr_candidate / unverified`で、範囲宣言`user_declared`は文字の原画像校合と別に扱う。通常のmanual_transcriptionやLiteの原runへ偽装しない。
5. 「原画像の領域へ」で画像を実際に開き、校合した文字・未校合範囲・修訂候補を別に記録する。原文とTEIを保持し、自動昇格しない。作業JSONと領域の読解資料にもこの出典を含める。原領域削除後はsnapshotを保持し、現在領域への操作を停止する。

現行`evaluate_ocr`は原run・artifact・画像hashがあるローカルOCR候補用。この手動本文を直接渡せない。外部結果の画像同一性・行座標等を確認する共通評価形式は後続に残す。利用者から個別に依頼された実サービス試験は、その資料・範囲・送信先・日時・成果物を研究logへ残し、通常のアプリ動作と分ける。

## 既存テキストを読む

画面の「表示ページの既存テキストを読む」はv3の単純なTextualBodyと明示された外部AnnotationPage最大1件を対象にする。取得後に「テキストを関連付ける」で同じCanvasの原テキストを領域へ結び付ける。

手動テキストのJSONは`text_id`、`canvas_id`、`target_xywh`（全頁はnull）、`source_ref`（元path等）、`source_sha256`、`text`、`origin="manual_transcription"`、`verification_state="unverified"`を指定する。校訂済みの状態は実際の照合記録に従って指定する。

workspace JSONとAnnotationPageのimportは初版profileを検査する。AnnotationPageは`profile="jp-lit-rectangle-0.1"`で、CanvasとFragmentSelectorの矩形を持つ。外部の任意Annotationを完全互換として取り込む機能は後続の範囲になる。
