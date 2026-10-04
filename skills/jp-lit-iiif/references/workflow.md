# IIIF比較・読解の呼び出し

Node22以上を使う。source checkoutは`npm ci` / `npm run build`後に`node scripts/iiif-workbench.mjs`を呼ぶ。配布packageは`jp-lit-iiif`を呼ぶ。現在の公開npm版にこの機能が含まれるかは導入先の`--help`で確認する。

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

返った`image_paths`の画像を実際に開いてから観察する。`evidence.json`はmanifest hash、Canvas ID、矩形、画像URL、取得画像hash、縮小寸法、テキストの出典を持つ。`image_service`は限定取得したinfo.jsonの原画像寸法、receipt、保存pathと原利用条件を持つ。painting bodyの寸法が縮小表現である場合も、この原画像寸法で座標を変換する。`original_image.sha256=null`は原画像本体を取得していない状態で、取得したcropのhashは`display_image.receipt.sha256`にある。

`analysis-template.json`をコピーし、生成者・実行時刻、evidence_idごとの観察、翻刻候補、解釈、疑義を記入する。原テキストのtxtをAI候補で上書きしない。`analysis.json`を検査するときはpackageの`dist/src/iiif/evidence.js`がexportする`validateAnalysis(value, evidenceIds)`を使える。

## 既存テキストと再開

画面の「表示ページの既存テキストを読む」はv3の単純なTextualBodyと明示された外部AnnotationPage最大1件を対象にする。取得後に「テキストを関連付ける」で同じCanvasの原テキストを領域へ結び付ける。

手動テキストのJSONは`text_id`、`canvas_id`、`target_xywh`（全頁はnull）、`source_ref`（元path等）、`source_sha256`、`text`、`origin="manual_transcription"`、`verification_state="unverified"`を指定する。校訂済みの状態は実際の照合記録に従って指定する。

workspace JSONとAnnotationPageのimportは初版profileを検査する。AnnotationPageは`profile="jp-lit-rectangle-0.1"`で、CanvasとFragmentSelectorの矩形を持つ。外部の任意Annotationを完全互換として取り込む機能は後続の範囲になる。
