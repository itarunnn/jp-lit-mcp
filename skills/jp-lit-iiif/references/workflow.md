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
3. run_ocrにevidence_path、重複しないevidence_ids（1〜4件）、provider_config_path、新規output_dirを指定する。既存翻刻がある場合は既定で停止。比較を明示依頼された場合だけallow_existing_text=trueを指定する。
4. 終了値とstatusを確認する。completedは成功。partial/failedは終了値4、ok=falseでresult.run_pathに原出力・ログ・失敗記録を残す。partialは正常な領域だけimportできる。再試行は新しいdirectoryを使う。
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

## 既存テキストを読む

画面の「表示ページの既存テキストを読む」はv3の単純なTextualBodyと明示された外部AnnotationPage最大1件を対象にする。取得後に「テキストを関連付ける」で同じCanvasの原テキストを領域へ結び付ける。

手動テキストのJSONは`text_id`、`canvas_id`、`target_xywh`（全頁はnull）、`source_ref`（元path等）、`source_sha256`、`text`、`origin="manual_transcription"`、`verification_state="unverified"`を指定する。校訂済みの状態は実際の照合記録に従って指定する。

workspace JSONとAnnotationPageのimportは初版profileを検査する。AnnotationPageは`profile="jp-lit-rectangle-0.1"`で、CanvasとFragmentSelectorの矩形を持つ。外部の任意Annotationを完全互換として取り込む機能は後続の範囲になる。
