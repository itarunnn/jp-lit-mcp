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

## 既存テキストと再開

## TEI本文と画像領域を結び付ける（開発版）

CLIの`--help`に`link_tei`がある場合に使う。npm公開版0.17.0は初版の比較・書き出し機能を提供する。開発checkoutでは`npm ci`・`npm run build`の後、次の要求を`node scripts/iiif-workbench.mjs --request <request.json>`で実行する。uv／Python3.13はTEI操作で必要。

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

`node scripts/iiif-workbench.mjs serve --workspace J:/research/linked.json`を起動する。「TEI本文と画像」の「対応する画像へ」で画像へ移動し、領域の「関連TEI本文」で戻る。手動対応は選択checkbox1件と記録者・理由を要求する。原画像との校合は実施後に結果・確認内容を別履歴へ追加する。未実施ならcollations=[]を保ち、resolvedを校合済みと解釈しない。

exportのtei_evidence/tei_pathsはXML構造とlocatorを持つ併読用のoverlap_context。全頁や部分重なりも含み、選択矩形の翻刻を示さない。pb/cb/lbの後続本文範囲やfacsの継承は今回展開しない。画像を実際に開いてから観察し、AI候補を原TEIへ書き戻さない。

## 既存テキストを読む

画面の「表示ページの既存テキストを読む」はv3の単純なTextualBodyと明示された外部AnnotationPage最大1件を対象にする。取得後に「テキストを関連付ける」で同じCanvasの原テキストを領域へ結び付ける。

手動テキストのJSONは`text_id`、`canvas_id`、`target_xywh`（全頁はnull）、`source_ref`（元path等）、`source_sha256`、`text`、`origin="manual_transcription"`、`verification_state="unverified"`を指定する。校訂済みの状態は実際の照合記録に従って指定する。

workspace JSONとAnnotationPageのimportは初版profileを検査する。AnnotationPageは`profile="jp-lit-rectangle-0.1"`で、CanvasとFragmentSelectorの矩形を持つ。外部の任意Annotationを完全互換として取り込む機能は後続の範囲になる。
