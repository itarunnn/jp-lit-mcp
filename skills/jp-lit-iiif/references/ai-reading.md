# 利用中AIアプリの読解を領域へ取り込む

0.18.0の要求実行は
```powershell
npx --yes --package=jp-lit-mcp@0.18.0 jp-lit-iiif --request 'J:/research/request.json'
```
を使える。開発checkoutでは下記のコマンドで実行する。

## 対象版と入力

実行するCLIの`--help`に`prepare_reading`と`import_reading`がある場合に使う。新しい操作は0.18.0以降の機能。開発checkoutでは`npm ci`・`npm run build`を行い、`node scripts/iiif-workbench.mjs --request <要求JSON>`を実行する。新旧workspaceの互換性は使用する版で確認し、古い版で新しい候補を保存し直さない。

対象はworkspaceへimport済みのローカルOCR候補の`text_id`。領域IDから「関連OCR候補」を調べる。KuroNet手動候補はサービス処理画像hashが不明なので、同じ画像の読解課題の基準に使えない。資料別の利用条件を確認し、画像・原OCR・出典runを保存した状態で始める。

## 読解用ファイルを作る

```json
{
  "api_version": "0.1", "operation": "prepare_reading",
  "workspace_path": "J:/research/workspace-with-ocr.json",
  "text_id": "対象のローカルOCR候補ID",
  "kind": "image_assisted_correction",
  "output_dir": "J:/research/reading-task-01"
}
```

`kind="image_reading"`は画像のみ、`image_assisted_correction`は画像と原OCRの併用。出力先は新しいdirectoryとし、task・原run・画像・指示を保持する。処理は原OCRと現在領域の整合を確認して画像を同じbytesで複製する。画像のみの試験にはOCR・TEI・翻刻・過去候補を渡さず、モデル・画像表示・共通指示を揃える。

利用中AIアプリで生成された`image.jpg`または`image.png`を実際に開き、`prompt.md`と`response-template.json`を使う。CLIは外部モデル/APIを起動せず、自動送信を行わない。新しい外部処理を追加する場合は送信先・対象範囲・資料別許可を具体化する。

## 疑義付き応答を保存・登録する

応答はtemplateの識別子・hash・形式を保持した別fileへ保存する。`generator`は実際のモデル名、`executed_at`には必須の読解日時を記録し、`image_opened=true`は画像実見の申告とする。確認できない`model_version`・所要時間`duration_ms`はnull、`monetary_cost`は未計測のnull。全領域を読んだ場合は`scope="full_region"`、部分は`partial_region`。判読不能を〓で残し、`doubts`へ候補本文に存在する`quote`、`alternatives`、`note`を記録する。未読templateは取込を拒否する。

```json
{
  "api_version": "0.1", "operation": "import_reading",
  "workspace_path": "J:/research/workspace-with-ocr.json",
  "task_path": "J:/research/reading-task-01/task.json",
  "response_path": "J:/research/reading-response-01.json",
  "output_path": "J:/research/workspace-with-reading.json",
  "overwrite": false
}
```

終了値0と`ok=true`を確認し、出力workspaceで比較画面を開く。「AI読解と原画像の確認」の疑義から「原画像の領域へ」戻る。人／AIの確認、記録者、結果、内容、任意の修訂候補を別履歴へ追加し、「作業を保存」を実行する。

候補は`ai_candidate/unverified`で、原OCR・TEIと別に保持する。実見・全領域の申告やAIの確認は人の文字校合と別の記録。同じ応答の再importは確認履歴を保持する。変更した応答は別file・別候補へ保存する。移動・削除領域は当時のsnapshotを残し、現在領域への操作を制限する。

`evaluate_ocr`のcaseへ`reading_text_ids`を指定すると、同じ原OCR・画像の全領域候補を比較へ含められる。画像のみ／併用は各1件でinline variantsと重複させない。部分読解は小領域の別課題に分ける。参照未登録は`pending_reference`を維持する。
