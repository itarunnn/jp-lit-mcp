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

読解資料の書き出しは、存在しない新しいdirectoryを指定します。CLIの`export_evidence`も既存directoryへの書き出しを拒否し、`overwrite=true`による置換は初版では対応しません。再取得時は別の保存先を使い、以前の画像・出典・AI読解結果を一緒に保全します。

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

開発版ではTEIのfacs/surface/zone対応と、任意のローカルくずし字OCRを利用できます。npm公開版0.17.0は初版の比較・書き出し機能を提供します。モデル接続、資料別の品質評価、類似図版検索・整列差分は第3・4段階で進めます。

## TEI本文と画像領域を往復する（開発版）

TEIの対応表は、保存したXMLのSHA-256・XPath・xml:id、原属性、本文の構造とCanvas／矩形を結び付けます。本文から画像へ、領域から関連するTEI要素へ移動できます。`choice`、`app`、`del`、`add`、`note`の枝を保持し、タグ付きで表示します。

この機能には、開発checkoutでの`npm ci`・`npm run build`と、[TEI readerのuv・Python環境](tei-reader.md#導入)が必要です。通常の比較画面やMCP起動はNode.jsだけで使えます。AIへ「このTEIの画像参照を比較画面に結び付けて」と依頼するか、次の要求JSONを保存して実行します。

```json
{
  "api_version": "0.1",
  "operation": "link_tei",
  "workspace_path": "J:/ResearchLibrary/Projects/Example/workspace/workspace.json",
  "output_path": "J:/ResearchLibrary/Projects/Example/workspace/tei-workspace.json",
  "file_path": "J:/ResearchLibrary/Projects/Example/source.xml",
  "expected_sha256": "XML取得版の小文字SHA-256・64桁",
  "document_id": "workspace.documents内のdocument_id",
  "limit": 20,
  "offset": 0,
  "overwrite": false,
  "surface_bindings": []
}
```

```powershell
node scripts/iiif-workbench.mjs --request 'J:/ResearchLibrary/Projects/Example/link-tei.json'
node scripts/iiif-workbench.mjs serve --workspace 'J:/ResearchLibrary/Projects/Example/workspace/tei-workspace.json'
```

`expected_sha256`には、既存TEI readerの文書検査か`(Get-FileHash -Algorithm SHA256 -LiteralPath <XML>).Hash.ToLowerInvariant()`で確認した値を入れます。`next_offset`が数値なら次の要求の`offset`へ渡します。続きの入力`workspace_path`と`output_path`を出力済みworkspaceへ揃え、`overwrite=true`で追加します。同じXML版・要素・token・資料の再実行は手動対応と校合履歴を保持します。

| 対応の状態 | 根拠と操作 |
| --- | --- |
| 対応あり（resolved） | Canvasを直接指すfacs、surfaceのsameAs宣言、利用者のsurface対応指定、または手動領域指定。本文の校合は別に記録する。 |
| 候補（candidate） | graphic画像URLとCanvasのpainting画像が一致する。確認した領域を手動で対応付ける。 |
| 未解決（unresolved） | 欠けたID、重複ID、xml:base、未知URI、座標不足、polygon、回転・入れ子などを診断付きで残す。 |

surfaceの座標は任意の座標空間です。`surface/@sameAs`がCanvasを明示していればその宣言を使います。利用者が全surfaceとCanvas全域の対応を確認した場合は、`surface_bindings`へ`{"surface_xpath":"/t:TEI[1]/t:facsimile[1]/t:surface[1]","canvas_id":"該当Canvas ID"}`を指定できます。zone矩形はsurfaceの原点・範囲からCanvasへ変換し、原属性を保持します。複雑な形状は手動の矩形対応で扱います。

画面の「TEI本文と画像」から画像へ移動します。対応一覧は100件ずつページを送り、未解決参照も全件を操作できます。領域コレクションの「関連TEI本文」は同じ資料・ページで領域と重なる対応を表示します。手動対応ではcheckboxを1件選び、記録者と対応理由を入力します。本文校合は原画像を確認してから「一致を確認／相違あり／判断保留」と確認内容を別に追加します。「作業を保存」で保存し、校合履歴はその時点の対応先を保持します。

読解資料は、重なるresolved対応を`region-N.tei.json`と`evidence.json`に保存します。範囲は`tei_scope="overlap_context"`で、全ページ対応や部分的な重なりも含む併読用の文脈です。選択矩形だけの翻刻を意味しません。原TEI構造と機械生成候補を分けて使います。

今回の自動対応は明示的なfacsを持つ要素が対象です。`pb`・`cb`・`lb`の後続本文への範囲展開、facsを持たない本文への継承、任意のcorrespチェーン、外部XMLの参照解決は後続の対応です。大きい本文単位は省略診断を残し、TEI readerで小さい単位を取り出して併読できます。画像参照だけの要素から本文を推定しません。

## ローカルくずし字OCRを使う（開発版）

前近代の写本・版本を読む利用者向けに、[NDL古典籍OCR-Lite](https://github.com/ndl-lab/ndlkotenocr-lite)を任意のローカルengineとして接続します。[国会図書館の案内](https://lab.ndl.go.jp/news/2025/2026-02-24/)は、古典籍と近代活字の処理系を分けて紹介しています。ここで扱うのは古典籍用です。CPUで動き、実行時は保存済みのJPEG/PNGを読みます。通常の比較画面とMCPはNodeだけで使えます。

OCR操作はCLIの`--help`に`run_ocr`がある開発checkoutで使います。OCR engine・Python環境・モデルの導入は利用者が任意に行います。公開OCRサービスへの接続、画像の外部送信、自動インストールは行いません。

### 任意のengineを導入する

Windowsで検証した例はuvとPython3.12.12を使います。保存先を自分のtoolchain directoryへ変更してください。engineのcodeと重みは上流のCC BY 4.0に従い、研究画像の利用条件は資料ごとに確認します。

```powershell
git clone --depth 1 https://github.com/ndl-lab/ndlkotenocr-lite.git 'J:/toolchains/iiif-koten-ocr/engine'
git -C 'J:/toolchains/iiif-koten-ocr/engine' rev-parse HEAD
uv init --bare --no-workspace --python 3.12.12 --name jp-lit-local-koten-ocr 'J:/toolchains/iiif-koten-ocr'
uv python pin --directory 'J:/toolchains/iiif-koten-ocr' 3.12.12
uv add --directory 'J:/toolchains/iiif-koten-ocr' --python 3.12.12 -r 'J:/toolchains/iiif-koten-ocr/engine/requirements.txt'
```

2026-10-05の検証commitは`ede4283845cdc0ba2bda8b7ebfc3dc80b33c92c8`です。採用したcommitと生成された`pyproject.toml`・`uv.lock`・`.python-version`を保管します。上のcloneは実行時の上流版を取得するため、更新時は依存とCLIを再確認してください。`--bare`はPython固定fileを作らないので、`uv python pin`も実行します。準備にはengine・重み・依存packageのdownloadが伴います。画像を送信する処理はありません。

### providerを確認して固定する

次のJSONを`inspect-ocr.json`に保存し、開発checkoutで実行します。指定したPythonは実行file、engineは`src/ocr.py`を含むdirectoryです。provider設定はローカルcode実行の明示指定として扱い、採用した上流codeを確認して使います。

```json
{
  "api_version": "0.1", "operation": "inspect_ocr_provider",
  "engine_dir": "J:/toolchains/iiif-koten-ocr/engine",
  "python_path": "J:/toolchains/iiif-koten-ocr/.venv/Scripts/python.exe"
}
```

```powershell
$inspection = node scripts/iiif-workbench.mjs --request './inspect-ocr.json' | ConvertFrom-Json
if (-not $inspection.ok) { throw 'OCR providerの確認に失敗しました' }
$inspection.result.config | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 './provider.json'
```

設定には`provider="ndlkotenocr-lite"`、絶対pathの`engine_dir`・`python_path`、コード・設定・重みをまとめた`expected_engine_sha256`、`timeout_ms`が入ります。既定の上限は1領域180秒、指定範囲は1〜600秒です。engineの変更時は内容を確認して再固定します。

### 選択画像をOCRし、候補を読み込む

画面の「画像と出典を保存」で作った`evidence.json`を使います。対象領域の画像が取得済みであることを確認し、`evidence_ids`をそのIDへ置き換えます。raw成果物はrepoの外の研究directory、例えばResearchLibraryのproject配下`work/ocr`へ保存します。

```json
{
  "api_version": "0.1", "operation": "run_ocr",
  "evidence_path": "J:/ResearchLibrary/Projects/Example/reading-evidence/evidence.json",
  "evidence_ids": ["選択した領域ID"],
  "provider_config_path": "J:/ResearchLibrary/Projects/Example/provider.json",
  "output_dir": "J:/ResearchLibrary/Projects/Example/work/ocr/run-01",
  "allow_existing_text": false
}
```

1〜4領域を逐次実行します。`output_dir`は未作成のdirectoryにします。画像hash・寸法・crop・縮小率を確認し、入力のコピー、原JSON/TXT/XML/TEI、ログ、実行時間とengineのhashを残します。既存テキストやTEI併読情報がある領域は停止します。TEI本文の省略診断や空の改頁参照も、保存済み対応を使った比較として扱います。明示的に比較する場合は`allow_existing_text=true`を指定できます。

終了値と`status`を確認します。`running`は処理途中で、初回実行前から要求ID一覧と処理中IDを保存します。全対象が終わるまでimportを保留します。`completed`は全対象の実行成功、`partial`は一部失敗、`failed`は全件失敗です。失敗を含むCLI実行は終了値4と`ok=false`を返し、`result.run_path`に原出力と失敗記録を保管します。再試行は新しい保存先で行います。自動再試行や外部providerへのfallbackはありません。

```json
{
  "api_version": "0.1", "operation": "import_ocr",
  "workspace_path": "J:/ResearchLibrary/Projects/Example/workspace/workspace.json",
  "run_path": "J:/ResearchLibrary/Projects/Example/work/ocr/run-01/run.json",
  "output_path": "J:/ResearchLibrary/Projects/Example/workspace/with-ocr.json",
  "overwrite": false
}
```

各要求を`node scripts/iiif-workbench.mjs --request <要求JSON>`で実行します。importは正常な領域だけを追加し、失敗領域数を`skipped`へ返します。原出力と画像のhash、workspace・manifest・領域座標が一致することを確認します。同じrunの再importは既存候補と校合履歴を保持します。移動した領域、別workspace、変更済み原出力へ誤対応させません。

`with-ocr.json`で比較画面を再起動するか、「作業を読み込む」で読み込みます。「くずし字OCRと画像校合」の「原画像の領域へ」「この行の画像へ」で原画像を確認し、記録者・結果・確認内容・任意の修訂候補を追加して保存します。原OCR本文は`ocr_candidate / unverified`を保ち、校合履歴は別に蓄積します。領域の「関連OCR候補」でも戻れます。行のconfidenceは領域検出の信頼度で、文字認識の精度指標とは区別します。engine生成のTEIはraw成果物として保持し、原TEIへ自動統合しません。

導入経路の確認は伊勢物語の公開画像1領域・9行で行いました。続く試験では伊勢物語、版本の当世料理、写本の膳部料理抄の計12 CanvasでOCRと取り込みを確認しています。公開翻刻との一致度を計算した範囲は6画像、参照未登録は6画像、文字単位の原画像校合は0画像です。万葉集等への適合、未知資料への精度、VLMとの実比較は継続します。画像の縮小で細字が読みにくい場合は、必要な領域を選び直して取得します。

### 同じ画像の候補を比較評価する

開発版の`evaluate_ocr`は、保存済みworkspaceと評価JSONから出典付きreportを作ります。原run・出力・画像のhashを再検証し、原OCRと任意の画像直接読解／画像併用修訂を比較します。評価操作はNodeだけで動き、OCRや外部モデルを起動しません。

評価JSONの`workspace_id`と`text_id`は対象workspaceからコピーします。次の本文「甲乙」は合成例です。実資料では選択領域全体に対応する参照翻刻と、そのUTF-8本文のSHA-256へ置き換えます。頁や領域の対応が不明なcaseは`reference:null`にします。

```json
{
  "schema_version": "0.1", "evaluation_id": "premodern-pilot",
  "workspace_id": "対象workspaceのID",
  "cases": [{
    "case_id": "case-1", "text_id": "対象OCR候補のtext_id",
    "reference": {
      "scope": "full_region", "text": "甲乙",
      "text_sha256": "f73ab1f5c2b9542c9cea79597b69a5c4dc106721d7de6fa9e4303c0fe45cfe3d",
      "origin": "published_transcription", "source_ref": "公開翻刻のURLと頁",
      "verification": "unreviewed", "review": null,
      "training_overlap": "unknown", "note": "原画像との校合は未実施"
    },
    "variants": [], "observations": null
  }]
}
```

`origin`は公開翻刻の`published_transcription`または人の翻刻の`human_transcription`です。原画像との校合を行った場合だけ`verification="source_collated"`とし、`review`へ`author`・`recorded_at`（ISO日時）・`note`を記録します。学習データとの重複は`known_overlap`、除外の根拠がある`declared_held_out`、未確認の`unknown`を区別します。公開されている翻刻だけで学習からの独立性を判断しません。

`variants`へ追加できる候補は、領域全体の`image_reading`と`image_assisted_correction`が各1件です。各候補には`variant_id`・`kind`・`scope="full_region"`・`text`・`text_sha256`・原OCRと同じ`image_sha256`・`generator`・`created_at`・`duration_ms`（未計測はnull）が必要です。AIの出力は候補として保持し、参照翻刻へ自動適用しません。部分読解は全文の評価へ混ぜず、対応する小さい領域で別のcaseを作ります。

```json
{
  "api_version": "0.1", "operation": "evaluate_ocr",
  "workspace_path": "J:/ResearchLibrary/Projects/Example/workspace/with-ocr.json",
  "evaluation_path": "J:/ResearchLibrary/Projects/Example/work/ocr/evaluation.json",
  "output_path": "J:/ResearchLibrary/Projects/Example/work/ocr/evaluation-report.json",
  "overwrite": false
}
```

要求を`node scripts/iiif-workbench.mjs --request <要求JSON>`で実行します。caseは最大80件、参照・読解候補は各20,000文字、1比較4,000,000セルまでです。reportは原run・画像・evidence・engineの外へ保存します。入力と同じ保存先は`overwrite=true`でも拒否します。

原資料の保存先保護はworkspace内の全TEIリンクと全OCR候補に適用し、評価caseに含めていない原run・artifact・元evidence・画像も対象にします。`import_ocr`と`link_tei`も同じ保護を使い、`overwrite=true`でworkspace自体を更新する指定を受け付けます。保護対象は保存形式に記録されたpathから収集します。原runを読めず保護対象を収集できない場合は保存を止めるため、必要な原出力を復元してから再実行します。

reportは原文字列の`strict`と、NFC後にUnicode空白を除く`without_layout_whitespace`を併記します。CERは文字順を含む編集距離／参照文字数で、1を超える場合があります。異体字統一やNFKC変換は行いません。[NDLの評価事例](https://lab.ndl.go.jp/data_set/r4_kotenocr_en/)に基づく文字多重集合のF1も残し、文字順を評価するCERと分けます。参照が空ならCERとF1はnull、参照がありOCRが空ならCERは1、F1は0です。

公開翻刻が未校合の数値は`reference_agreement`です。`pending_reference`、校合宣言、学習重複、実行していない読解方法を別々に記録します。Canvas数と領域数を区別し、候補種別・生成者・OCR engine hash・校合状態・学習重複ごとにmicro CERを集計します。金銭費用は未計測としてnullを保持します。図中ラベル・編集記号・行の欠落・読み順・表記変更は数値だけで原因を決めず、`observations`に記録者・日時・注記と各項目の`unknown/observed/not_observed`を残します。

## OCR・モデル接続・画像解析への進め方

次のIIIFバージョンアップは、TEI本文との往復、くずし字OCR、モデル接続、類似図版検索・整列差分の主要フローを揃えてから行います。実装と検証は段階ごとに進め、開発中のpackage versionは0.17.0を維持します。

主要機能の完了は、次の操作を代表的な実資料で確認できた状態とします。

| 主要フロー | 完了条件 |
| --- | --- |
| 資料比較と出典付き書き出し | 資料・ページ・領域を比較し、取得版hash・Canvas・座標・利用条件を保存して元の場所へ戻れる。 |
| TEI本文と画像の往復 | 明示facsと改頁参照を使う代表資料で本文範囲を特定し、画像領域との往復、手動対応、別履歴の校合、保存復元ができる。改頁後の本文範囲・facs継承は、このフローに必要な範囲から実装する。 |
| くずし字OCRとモデル接続 | 評価で選んだproviderへ許可した領域を任意に渡し、原出力、生成条件、疑義、領域IDを保持して原画像と確認できる。OCR／AI候補と原TEIを別に保存する。 |
| 類似図版検索と整列差分 | 対応を確認した図版集合で検索候補・整列結果・差分を評価し、使用条件と誤検出を記録して出典領域へ戻れる。 |
| 一連の利用と配布 | 保存復元、取得・処理失敗からの復帰、旧workspace互換、実ブラウザ、新規導入、回帰テスト、配布境界を確認し、対応範囲と限界を文書へ揃える。 |

機能ごとの完了証拠を計画と引き継ぎへ残します。全主要フローの実装・評価・統合レビューを終えてから、次版の番号とリリース内容を確定します。

第3段階は、ローカルくずし字OCRの実行・校合から進め、直接VLM読解と画像を併用したOCR修正を同じ資料12〜20ページで比較します。原出力・領域ID・費用・時間・誤字・欠落・表記変更を記録し、資料別の評価からproviderを選びます。外部モデルやOCRサービスとの接続は、利用条件と送信先・対象の許可を具体化し、利用者が明示設定した場合に限る後続機能です。

第4段階は、手動で対応を定めた図版集合を使い、類似図版の検索順位と整列差分の誤検出を評価します。撮影条件に由来する差と史料上の差を区別し、TEI対応・領域ID・校合記録へ戻れる候補を保存します。

## 取得と利用条件

検索MCPは従来どおり書誌・リンク・metadataを返します。manifest・選択画像の取得は利用者が任意CLIで指定した範囲に限定します。資料のlicense／attribution／rights／requiredStatementの原記述を残し、URLの存在から取得許可や校合完了を推定しません。[source利用条件](source-usage-conditions.md)と元機関の条件を参照してください。

比較画面の127.0.0.1 serverは起動tokenとOrigin/Hostを確認し、指定workspaceと同梱assetを扱います。起動tokenはURLのfragmentに保持するため、同じタブの再読み込みで保存済み作業を再開できます。外部へのReferrerは送信しません。AIへの送信は利用中のAIアプリと資料別の許可に従います。初版アプリは外部モデルやOCRへ自動送信しません。
