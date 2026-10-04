# IIIF資料の比較とAI読解

IIIF比較画面は、複数の機関が公開する資料を同じ操作で並べ、必要なページや矩形を出典付きで保存するローカルアプリです。「この2資料を並べて」「選んだ部分を画像と翻刻で比べて」とAIへ依頼できます。選択した画像と出典を既存AIアプリに渡して読み、元の場所へ戻って確認する流れを支えます。

## 導入してAIへ依頼する

v0.17.0からCLIと比較画面を同梱します。Node.js22以上とnpm、ローカルコマンド・画像読解を使えるAIアプリを用意します。repoの外に研究用directoryを作り、そこで導入と起動確認を行います。

```powershell
npx --yes --package=jp-lit-mcp@0.17.0 jp-lit-iiif --help
npx --yes jp-lit-mcp@0.17.0 install-skills codex
```

`codex`はCodex CLI / App向けです。Cursorは`cursor`、Claude Codeは`claude`に置き換えます。installerはjp-lit-research、jp-lit-verification、jp-lit-tei、jp-lit-iiifの4種を導入し、既存の同名Skillsを置き換えます。個別に編集した内容は導入前に退避してください。導入後はAIアプリで新しい対話を開き、資料URLと保存先を渡します。

```text
jp-lit-iiifを使って、次の公開資料をローカル比較画面に並べてください。
https://kokusho.nijl.ac.jp/biblio/100335909
https://dl.ndl.go.jp/pid/3048007
保存先はJ:\Research\iiif-comparisonです。manifestと利用条件を確認し、起動URLを教えてください。
選択後は、2つの画像を実際に開き、見える特徴と翻刻候補を出典付きで示してください。
```

AIはSkillの[呼び出し資料](../skills/jp-lit-iiif/references/workflow.md)に従って公開manifestを確認し、workspaceを準備します。画像・テキスト・読解候補の保存先は利用者の研究directoryです。比較と書き出しにPython、OCRモデル、外部モデルのAPI keyは必要ありません。AI読解には利用中のアプリの画像読解機能を使います。

## 自分で比較画面を起動する

手動起動では、次のUTF-8 JSONを`prepare.json`に保存します。`output_dir`は自分の研究directoryの絶対pathへ変更してください。例の2件は動作確認に使った公開資料で、資料間の研究上の関係を示す組み合わせではありません。

```json
{
  "api_version": "0.1",
  "operation": "prepare_workspace",
  "output_dir": "J:/Research/iiif-comparison",
  "candidates": [
    {
      "source": "kokusho",
      "source_id": "100335909",
      "record_url": "https://kokusho.nijl.ac.jp/biblio/100335909",
      "manifest_url": "https://kokusho.nijl.ac.jp/biblio/100335909/manifest",
      "acquisition": "provider_metadata",
      "verification_state": "candidate"
    },
    {
      "source": "ndl_search",
      "source_id": "3048007",
      "record_url": "https://dl.ndl.go.jp/pid/3048007",
      "manifest_url": "https://dl.ndl.go.jp/api/iiif/3048007/manifest.json",
      "acquisition": "derived_from_pid",
      "verification_state": "candidate"
    }
  ]
}
```

workspaceを作成した後、比較画面を起動します。表示された起動URLをブラウザで開きます。再起動時は新しいURLを使います。終了はターミナルのCtrl+Cです。

```powershell
npx --yes --package=jp-lit-mcp@0.17.0 jp-lit-iiif --request .\prepare.json
npx --yes --package=jp-lit-mcp@0.17.0 jp-lit-iiif serve --workspace "J:/Research/iiif-comparison/workspace.json"
```

最初の要求はmanifestを取得し、画像は比較画面で提供元から表示します。返された`workspace_path`が上の起動pathと一致することを確認してください。既存のworkspaceがある場合は保存先を変えるか、そのworkspaceを再開します。初回にはnpm packageがダウンロードされることがあります。

開発checkoutでは`npm ci` / `npm run build`後、同じ引数を`node scripts/iiif-workbench.mjs`へ渡します。global/local install済みの配布packageでは`jp-lit-iiif`を使えます。

## ページと領域を比べる

各窓のページ一覧でCanvasを選びます。同じ資料の別ページは「別窓で比較」で開けます。最大4窓です。拡大・移動・回転は各窓で操作します。保存したworkspaceを再開すると同じCanvasと表示位置へ戻れます。

対象窓を選び、「矩形を選ぶ」で画像上をドラッグします。Escまたは取消ボタンで終了できます。座標指定と「ページ全体」も使えます。選択理由・タグ・注記を記入し、コレクションへ追加します。元資料へ戻る操作は領域ごとの「元の場所へ戻る」です。

共通の操作は比較を助けます。撮影の色・照明・解像度・実寸は資料ごとに異なります。画面の拡大率を実物の縮尺と見なさず、印刷頁とCanvasの順序を別に記録します。

## 原テキストと画像をAIへ渡す

v3の既存テキストがあるページは「表示ページの既存テキストを読む」で取り出し、領域へ関連付けられます。手動翻刻のJSONも、出典path/hashとCanvasを付けてimportできます。原テキストとAIの補正候補を別に保存します。

コレクションから1〜4領域を選び、新しい保存先を指定します。選択資料の取得・利用条件を確認したらcheckboxを入れて書き出します。取得確認を保留した場合は出典とテキストが保存され、画像の取得状態が明示されます。

書き出す資料は画像、原テキスト、`evidence.json`、`prompt.md`、`analysis-template.json`です。切り出し前に選択したImage Serviceの`info.json`を取得し、原画像寸法・API版・対応levelを確認します。このJSONも保存し、要求URL・最終URL・hashとCanvasからの変換を`evidence.json`へ残します。painting bodyの縮小画像寸法を原画像寸法として使いません。

画像を実際に開いてから、観察・翻刻候補・解釈・疑義を領域IDごとに記録します。AIの候補は`analysis.json` / `analysis.md`へ保存し、原資料との校合を別に行います。画像のURLと取得hashは`evidence.json`に残ります。

## 保存と対応範囲

「作業を保存」は起動時に指定したworkspaceを書き換えます。作業JSONのdownloadとfile import、矩形AnnotationPageのexport/importも使えます。AnnotationはCanvasとW3C FragmentSelectorを持つ`jp-lit-rectangle-0.1` profileです。独自workspaceはIIIF Curation API全体の互換形式を表しません。

- Presentation2/3の静止画像manifest。v2複数sequenceは準備要求の`sequence_ids`で明示選択する。
- crop取得は単一の全Canvas painting、取得したinfo.jsonで確認できる原画像寸法、Image API2/3 level1/2があるもの。level1にも対応する幅または高さ指定で縦横比を保持する。複合画像・部分配置・SVG・未知serviceは領域記録と対応診断を残す。
- 初版のテキストはv3の単純なtext/plain TextualBody、明示された外部AnnotationPage最大1件／Canvas、手動import。Canvas全体またはpixel矩形FragmentSelectorを保持し、未知selectorは原targetを診断に残して取り込みを保留する。
- 画像の取得形式はJPEG/PNG。1件10MiB、16百万pixel、表示画像長辺2048pixel以内。縮小に伴う細字の疑義は必要な領域を選び直して確認する。
- manifestは10MiB・選択sequence2000Canvas、Image Service info.jsonは2MiB、timeout15秒・redirect3回・取得同時1件。全冊画像取得、認証・館内限定・送信限定資料の取得は対象外。
- 公開HTTPSを限定取得し、画像表示は提供元へ直接アクセスする。CORSや閲覧権限の失敗は提供元の状態として扱う。失敗した窓があっても他の資料は操作できる。

TEIのfacs/surface/zone対応、くずし字OCR、モデル接続、類似図版検索・整列差分は後続段階です。初版のID・座標・出典をその足場として使います。

## 取得と利用条件

検索MCPは従来どおり書誌・リンク・metadataを返します。manifest・選択画像の取得は利用者が任意CLIで指定した範囲に限定します。資料のlicense／attribution／rights／requiredStatementの原記述を残し、URLの存在から取得許可や校合完了を推定しません。[source利用条件](source-usage-conditions.md)と元機関の条件を参照してください。

比較画面の127.0.0.1 serverは起動tokenとOrigin/Hostを確認し、指定workspaceと同梱assetを扱います。起動tokenはURLのfragmentに保持するため、同じタブの再読み込みで保存済み作業を再開できます。外部へのReferrerは送信しません。AIへの送信は利用中のAIアプリと資料別の許可に従います。初版アプリは外部モデルやOCRへ自動送信しません。
