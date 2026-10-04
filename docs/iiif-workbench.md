# IIIF資料の比較とAI読解

IIIF比較画面は、複数の機関が公開する資料を同じ操作で並べ、必要なページや矩形を出典付きで保存するローカルアプリです。「この2資料を並べて」「選んだ部分を画像と翻刻で比べて」とAIへ依頼できます。選択した画像と出典を既存AIアプリに渡して読み、元の場所へ戻って確認する流れを支えます。

## 開発版を起動する

初版は開発版です。公開npm 0.16.0への搭載は次回リリースで扱います。Node22以上でcheckoutを準備します。

```powershell
npm ci
npm run build
node scripts/iiif-workbench.mjs --help
```

AIには「jp-lit-iiifを使って、選んだ公開資料を比較してください」と依頼します。Skillの[呼び出し資料](../skills/jp-lit-iiif/references/workflow.md)にmanifest指定と保存先の契約があります。画像・テキスト・読解候補の保存先は利用者の研究project directoryを指定します。

workspaceを作成した後、比較画面を起動します。表示された起動URLをブラウザで開きます。再起動時は新しいURLを使います。終了はターミナルのCtrl+Cです。

```powershell
node scripts/iiif-workbench.mjs --request .\prepare.json
node scripts/iiif-workbench.mjs serve --workspace <workspace.jsonの絶対path>
```

配布済みpackageを導入した環境では`jp-lit-iiif`が同じCLIになります。Python、OCRモデル、外部モデルのAPI keyは初版の比較・書き出しに必要ありません。

## ページと領域を比べる

各窓のページ一覧でCanvasを選びます。同じ資料の別ページは「別窓で比較」で開けます。最大4窓です。拡大・移動・回転は各窓で操作します。保存したworkspaceを再開すると同じCanvasと表示位置へ戻れます。

対象窓を選び、「矩形を選ぶ」で画像上をドラッグします。Escまたは取消ボタンで終了できます。座標指定と「ページ全体」も使えます。選択理由・タグ・注記を記入し、コレクションへ追加します。元資料へ戻る操作は領域ごとの「元の場所へ戻る」です。

共通の操作は比較を助けます。撮影の色・照明・解像度・実寸は資料ごとに異なります。画面の拡大率を実物の縮尺と見なさず、印刷頁とCanvasの順序を別に記録します。

## 原テキストと画像をAIへ渡す

v3の既存テキストがあるページは「表示ページの既存テキストを読む」で取り出し、領域へ関連付けられます。手動翻刻のJSONも、出典path/hashとCanvasを付けてimportできます。原テキストとAIの補正候補を別に保存します。

コレクションから1〜4領域を選び、新しい保存先を指定します。選択資料の取得・利用条件を確認したらcheckboxを入れて書き出します。取得確認を保留した場合は出典とテキストが保存され、画像の取得状態が明示されます。

書き出す資料は画像、原テキスト、`evidence.json`、`prompt.md`、`analysis-template.json`です。画像を実際に開いてから、観察・翻刻候補・解釈・疑義を領域IDごとに記録します。AIの候補は`analysis.json` / `analysis.md`へ保存し、原資料との校合を別に行います。画像のURLと取得hashは`evidence.json`に残ります。

## 保存と対応範囲

「作業を保存」は起動時に指定したworkspaceを書き換えます。作業JSONのdownloadとfile import、矩形AnnotationPageのexport/importも使えます。AnnotationはCanvasとW3C FragmentSelectorを持つ`jp-lit-rectangle-0.1` profileです。独自workspaceはIIIF Curation API全体の互換形式を表しません。

- Presentation2/3の静止画像manifest。v2複数sequenceは準備要求の`sequence_ids`で明示選択する。
- crop取得は単一の全Canvas painting、明示寸法、Image API2/3 level1/2があるもの。複合画像・部分配置・SVG・未知serviceは領域記録と対応診断を残す。
- 初版のテキストはv3の単純なtext/plain TextualBody、明示された外部AnnotationPage最大1件／Canvas、手動import。
- 画像の取得形式はJPEG/PNG。1件10MiB、16百万pixel、表示画像長辺2048pixel以内。縮小に伴う細字の疑義は必要な領域を選び直して確認する。
- manifestは10MiB・選択sequence2000Canvas、timeout15秒・redirect3回・取得同時1件。全冊画像取得、認証・館内限定・送信限定資料の取得は対象外。
- 公開HTTPSを限定取得し、画像表示は提供元へ直接アクセスする。CORSや閲覧権限の失敗は提供元の状態として扱う。失敗した窓があっても他の資料は操作できる。

TEIのfacs/surface/zone対応、くずし字OCR、モデル接続、類似図版検索・整列差分は後続段階です。初版のID・座標・出典をその足場として使います。

## 取得と利用条件

検索MCPは従来どおり書誌・リンク・metadataを返します。manifest・選択画像の取得は利用者が任意CLIで指定した範囲に限定します。資料のlicense／attribution／rights／requiredStatementの原記述を残し、URLの存在から取得許可や校合完了を推定しません。[source利用条件](source-usage-conditions.md)と元機関の条件を参照してください。

比較画面の127.0.0.1 serverは起動tokenとOrigin/Hostを確認し、指定workspaceと同梱assetを扱います。AIへの送信は利用中のAIアプリと資料別の許可に従います。初版アプリは外部モデルやOCRへ自動送信しません。
