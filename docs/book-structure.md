# 書籍構造の共通基盤（開発checkout）

位置付きOCRから、文字行・図版・表・説明文の領域、読む順序、図版との対応関係を保存します。`general`は原行と領域、`dictionary`は見出し・語義・用例、`illustrated`は図版と説明文・本文参照の候補を追加します。この資料の操作は開発checkoutの機能です。

## 共通データを作る

```json
{
  "api_version": "0.1",
  "operation": "build_book_structure",
  "workspace_path": "J:/Research/example/workspace.json",
  "text_ids": ["ocr-candidate-id"],
  "profile": "illustrated",
  "output_dir": "J:/Research/example/book-structure"
}
```

要求JSONをUTF-8で保存し、開発checkoutから`node scripts/iiif-workbench.mjs --request <request.json>`で実行します。事前に`npm run build`を実行してください。1回の対象は1〜4 OCR候補です。出力先は新規directoryを指定します。

同じCanvasの左右頁は別の`pages`要素にし、`page_id, text_id, sequence_index, printed_label, coverage`を指定します。欠落頁は`text_id: null, coverage: "ocr_failed"`と`canvas_id`を指定して、頁を飛ばした継続判定を保留します。

各OCR候補は1つの印刷頁へ割り当てます。重複した頁ID・順序・OCR候補や、原OCRと異なるCanvasの指定は、出力を作る前にエラーとして返します。

NDLOCR 2.1の原run内にあるlayout XMLは自動で取り込みます。別保存の原XMLは`layout_sources`へ`text_id, path, expected_sha256, input_image_sha256`を指定します。原画像とXMLの寸法・hashの対応を検査し、文字のないBLOCKも領域として残します。polygonの原座標を記録し、画像への移動には外接矩形を使います。

出力は`structure.json`、`review-queue.tsv`、`provenance.json`、取込時の固定コピー`source-workspace.json`と、原出力を検証した`source/`です。作業用workspaceへTEIを追加して保存した後も、この固定コピーと原OCR・画像を検証して再出力できます。原行・文字範囲・領域・論理単位・関係をそれぞれ保存します。文字範囲はUnicode code pointの半開区間です。画像の位置精度は原OCR・layoutから引き継ぎます。

## 確認と訂正を残す

`review_book_structure`で`structure_path, expected_sha256, output_dir, decisions`を指定します。decisionは`subject_id, subject_sha256, aspect, result, actor: {kind, name}, note`です。`subject_sha256`は対象objectのkeyを再帰的にsortしたJSONのSHA-256で、Node moduleの`structureFingerprint`でも計算できます。

`actor.kind`は実際の確認主体に応じて`human/agent`を記録します。aspectは`transcription/layout/headword/boundary/continuation/sense/example/association/alignment`、resultは`accepted/rejected/needs_review`です。文字の確認と画像対応の確認を別々に記録します。

fieldの訂正は`replacement_text`と`result: "needs_review"`を指定し、訂正後のsnapshotを再確認します。原OCRと既存snapshotを保持し、変更に関係する確認をrevisionの`invalidated_review_ids`で失効させ、agentによる再確認記録を追加します。現在の確認状態はsubject・aspect・actor.kind・actor.name別に算出します。

訂正対象のfieldと原行を共有するunit・field、その関係も再確認へ移します。図版説明の訂正は、その図の番号を根拠にした本文参照の確認にも伝わります。

## SQLite・TEIから利用する

`export_book_structure`へ`structure_path, expected_sha256, format: "tei" / "sqlite", output_dir`を渡すと派生出力を新規保存します。TEIはNode.jsで生成し、`link_tei`と[比較画面](iiif-workbench.md)から複数の画像領域へ戻れます。OCR原文と構造化した本文を別のtextとして保存し、確認主体・aspect・結果を記録します。

SQLiteは任意のuv/Python 3.13系と標準sqlite3を使います。実行依存は標準ライブラリだけです。

```sql
SELECT u.unit_id, f.text
FROM units AS u JOIN fields AS f USING (unit_id)
WHERE f.role = 'headword' AND f.normalized_text LIKE 'あい%';

SELECT f.text, p.canvas_id, l.canvas_xywh
FROM fields AS f
JOIN field_spans AS fs USING (field_id)
JOIN spans AS s USING (span_id)
JOIN lines AS l USING (line_ref)
JOIN pages AS p USING (page_id);
```

図版は`regions`、説明文・本文との関係は`relations`、確認者・aspect別の有効な最新確認は`current_reviews`、訂正による失効は`review_invalidations`にあります。表は領域として保持し、セル構造が未取得の場合はTEIで`figure type="table"`として出力し診断を残します。

TEIの`link`は関係の確認結果と確認記録への参照を持ちます。図の`head`にはassociationがacceptedの説明文を出し、未確認・却下・競合の関係はstandOffへ保持します。人のassociation確認がある場合はその記録を優先し、同じ層の確認者間で結果が一致しない場合はheadへの表示を保留します。各headから説明文と根拠linkを参照できます。

頁・原行・領域・文字範囲・unit・field・関係・確認・訂正履歴にXML IDを付け、関係先を参照できます。文字範囲は`spanGrp`へ保存し、`from`で原行、`n="開始:終了"`でcode point範囲を示します。画像参照は元の行領域を使います。欠落頁と無座標領域は状態を保持し、座標属性を省略して保存します。

文字がない図版頁と空白頁もTEIへ出力できます。図版内の印刷キャプションfieldは`head`、ほかの転記fieldは本文blockへ写します。図番号は「一〇」「十」「１０」のような表記を対応付け、元のOCR表記も保持します。

図版の検出と、説明文・本文との対応付けは別の候補です。図番号や位置の根拠と競合する候補を保持し、確認記録を追加して利用します。原出力とsnapshotのhashを照合し、既存出力と原資料を保護します。日本語のOCR誤認・見出し境界・図番号は原画像に戻って確認してください。
