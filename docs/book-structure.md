# 書籍構造の共通基盤

位置付きOCRから、文字行・図版・表・説明文の領域、読む順序、図版との対応関係を保存します。`general`は原行と領域、`dictionary`は見出し・語義・用例、`illustrated`は図版と説明文・本文参照の候補を追加します。0.19.1の任意CLI `jp-lit-iiif`で利用できます。

## 現在の利用範囲

| 段階 | 操作と保存されるもの |
| --- | --- |
| 構造化 | `build_book_structure`で1回1〜4 OCR候補を処理し、原行・座標・原layoutとprofileごとの論理候補を保存 |
| 確認 | `review_book_structure`で領域・文字・説明文対応などの採用・却下・要確認を、確認主体別に記録 |
| 出力 | `export_book_structure`でSQLiteまたはTEIを新規保存。図群・部分図、複数の原領域、確認・訂正履歴を保持 |
| 原画像の確認 | SQLiteの頁・領域へのjoinと、TEIの`link_tei`・比較画面から元Canvasの位置へ移動 |

20ページをまとめた実資料試験では、研究用helperで小さい処理単位を集約し、検索用HTMLも作成しました。通常APIの入力上限は1〜4候補です。試験範囲と確認結果は[図版資料での検証例](#図版資料での検証例)にまとめています。

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

要求JSONをUTF-8で保存し、`npx --yes --package=jp-lit-mcp@0.19.1 jp-lit-iiif --request <request.json>`で実行します。開発checkoutでは`npm run build`後に`node scripts/iiif-workbench.mjs --request <request.json>`を使います。1回の対象は1〜4 OCR候補です。出力先は新規directoryを指定します。

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

説明文から図版の画像位置を検索する場合は、`caption_of`関係を経由して図版の領域と頁を結びます。次の例は対応候補と、その確認者別の状態を返します。

```sql
SELECT f.text AS caption, p.canvas_id, r.canvas_xywh,
  (SELECT group_concat(actor_kind || ':' || result, ', ')
   FROM current_reviews
   WHERE subject_id = rel.relation_id AND aspect = 'association')
  AS association_reviews
FROM fields AS f
JOIN relations AS rel
  ON rel.from_id = f.unit_id AND rel.kind = 'caption_of'
JOIN unit_regions AS ur ON ur.unit_id = rel.to_id
JOIN regions AS r USING (region_id)
JOIN pages AS p USING (page_id)
WHERE f.normalized_text LIKE '%第六十八%';
```

図版番号・説明文の対応確認と、図版領域の確認は別の記録です。`association_reviews`には採用・却下・要確認が含まれます。複数の確認者がいる場合の採用判断は、後述の人の確認優先・競合保留の規則に従います。

このSQLは原領域ごとに1行を返します。同じ図版unitが複数regionを参照する場合の図数は`COUNT(DISTINCT rel.to_id)`などで数え、図群に含まれる部分図は`contains`関係とその確認記録で扱います。

TEIの`link`は関係の確認結果と確認記録への参照を持ちます。図の`head`にはassociationがacceptedの説明文を出し、未確認・却下・競合の関係はstandOffへ保持します。人のassociation確認がある場合はその記録を優先し、同じ層の確認者間で結果が一致しない場合はheadへの表示を保留します。各headから説明文と根拠linkを参照できます。

頁・原行・領域・文字範囲・unit・field・関係・確認・訂正履歴にXML IDを付け、関係先を参照できます。文字範囲は`spanGrp`へ保存し、`from`で原行、`n="開始:終了"`でcode point範囲を示します。画像参照は元の行領域を使います。欠落頁と無座標領域は状態を保持し、座標属性を省略して保存します。

文字がない図版頁と空白頁もTEIへ出力できます。図版内の印刷キャプションfieldは`head`、ほかの転記fieldは本文blockへ写します。図番号は「一〇」「十」「１０」のような表記を対応付け、元のOCR表記も保持します。

図版の検出と、説明文・本文との対応付けは別の候補です。図番号や位置の根拠と競合する候補を保持し、確認記録を追加して利用します。原出力とsnapshotのhashを照合し、既存出力と原資料を保護します。日本語のOCR誤認・見出し境界・図番号は原画像に戻って確認してください。

`illustrated`では、同頁・同種で矩形のIoUが0.9以上の再検出を一つのunitにまとめ、元のregionをすべて保持します。TEIの`facs`とSQLiteの`unit_regions`から各原領域を参照できます。部分図は独立した領域として保存し、確認した図群との関係を`contains`で表せます。

複数`facs`を持つunitからの比較画面への移動は、先頭の代表領域へ戻ります。ほかの原領域のzoneと座標もTEIへ保持します。原画像で追加した領域は`origin: "manual_region"`として区別します。

説明文の対応は、図との軸方向の重なり、辺の間隔、中心距離から候補を絞ります。明示captionと図番号だけの縦ラベルを保持し、図番号を含む長い縦本文は`refers_to`の対象にします。図の外側で一つの図に定まる別番号の説明文を根拠に隣図への二重対応を整理し、図内の別番号ラベルと近距離の競合は確認候補として保持します。

## 図版資料での検証例

2026-10-19の再検証では、同じ印刷20〜29頁・170〜179頁の20ページを使いました。下表は現在の結果です。図番号・図名の検索索引、分類図の範囲選択、部分図との関係と採否はagentの画像照合による記録です。

| 対象 | 再検証の結果 |
| --- | --- |
| 原OCR・原領域 | 284行・526領域を保持。分類図のmanual_regionを1件追加 |
| 図版 | 主図18＋番号のない分類図1。部分図4を親図へ関連付け |
| 説明文対応 | 自動64候補→21候補。画像照合で2候補を補い、17採用・5却下・1要確認 |
| 画像参照 | TEI 1,173件が解決、未解決0件。検索14項目と画像移動7回を確認 |
| 継続する確認 | 第21図の図番号・凡例ブロックの分割、図番号の転記疑義5箇所 |

説明文対応の17採用は、図番号ブロックと主図・図群の対応です。凡例全体の転記や各部位記号の分離は今後の確認対象です。今回の再検証は保存済みOCRを使い、追加OCR・外部処理は0件でした。

### 初回3ページの試験

2026-10-19、公開資料[『普通植物学教科書』](https://ndlsearch.ndl.go.jp/books/R100000039-I832615)のCanvas 15・20の右頁と30の左頁を使い、NDLOCR-Liteの文字行と原layout XMLから構造化しました。3頁・39行・109領域・図版候補16件をSQLiteへ出力し、全図版候補のCanvasと矩形がTEIの画像参照と一致することを確認しました。TEIの画像参照172件は全件解決し、TEI P5の固定Relax NGにも適合しました。

図版領域はagentによる画像照合で10件採用・6件要確認、説明文との対応は14件採用・34件却下・19件要確認です。図群と部分図の重複、本文の欧文誤認、二つの図の説明が同じOCR行へ連結する例を保持しています。検索一覧で図番号から画像へ移動し、比較画面では第六十八図→第二十九図→第六十八図の移動と保存後の表示中心を検査しました。対象頁を絞った追加試験を、次の20頁で実施しました。

### 前半・後半各10ページの初回処理

同日、印刷20〜29頁と170〜179頁の各10頁でも部分処理を検証しました。4頁以下の処理単位から研究用helperで物理構造を集約し、全20頁へ`illustrated`を適用して、一つのSQLiteとTEIへ出力しました。284行・526領域・図版候補36件を保存し、主図・図群18件をagentが画像で照合しました。綴じ・小口の縁など6件を却下、重複・部分図・分類領域12件を要確認として記録しました。全284行・36図版候補の画像座標と、TEIの1,172画像参照を検査しました。図番号の誤認・未分離5箇所は原OCRに確認記録を付け、主図番号は画像照合の注記から補助索引を作りました。

### 同じ20ページの図版・説明文レビュー

同じ20頁のレビューでは、自動caption対応を64件から21件へ絞り、原画像の確認で17件を採用しました。第21図は図番号と凡例のOCRブロックが未分離のため1件を要確認として保持しています。図番号を持つ18図と番号のない分類図1件を一覧の主対象とし、部分図4件を親図へ結び付けました。分類図はagentが範囲を選んだ`manual_region`として追加しています。元の284行・526領域を保持した再出力のTEI画像参照1,173件が全件解決し、主図・部分図の切替と7回の原画像移動をbrowserで確認しました。
