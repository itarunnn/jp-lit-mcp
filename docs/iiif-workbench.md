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

開発版ではTEIのfacs/surface/zone対応、任意のローカルくずし字OCR、AI読解候補の取込、保存済み画像の類似検索・整列差分を利用できます。npm公開版0.17.0は初版の比較・書き出し機能を提供します。資料別の品質評価と主要フローの統合受入を進めています。

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

改頁`pb`の対応には、直後から同じ本文内の次の改頁の直前までを`page_range`へ保存します。段落や歌の途中で改頁しても、原XPath・タグ・属性と切り出し部分の印を保持します。最後の改頁は本文の末尾までです。画面ではこの範囲を表示し、原`pb`は従来の`source_content`へ残します。[TEIの改頁と画像の慣例](https://tei-c.org/release/doc/tei-p5-doc/en/html/PH.html#PHFAX)に基づく併読範囲で、文字単位の画像対応・校合は別に確認します。

親の画像参照を使う場合は、`link_tei`要求へ`"include_inherited": true`を加えます。最も近い親の`facs`とその宣言元を`facs_origin`へ残します。子の明示`facs`を優先し、空の`facs`は親からの展開を止めます。これはアプリの任意補助で、既定は明示参照だけです。同じモードの`next_offset`を使って続けます。先行改頁の画像を後続改頁へ補完しません。

注記・異読等の中の改頁、異なる`ed/edRef`、本文範囲の不明な改頁は診断付きで保留します。大きい範囲は全体を省略したことを記録し、途中までを全文として保存しません。従来の校合・手動対応がある同IDは当時のsnapshotを保持します。`cb/lb`の後続範囲、任意のcorrespチェーン、外部XML解決は後続の対応です。

## ローカルくずし字OCRを使う（開発版）

前近代の写本・版本を読む利用者向けに、[NDL古典籍OCR-Lite](https://github.com/ndl-lab/ndlkotenocr-lite)を任意のローカルengineとして接続します。[国会図書館の案内](https://lab.ndl.go.jp/news/2025/2026-02-24/)は、古典籍と近代活字の処理系を分けて紹介しています。ここで扱うのは古典籍用です。CPUで動き、実行時は保存済みのJPEG/PNGを読みます。通常の比較画面とMCPはNodeだけで使えます。

OCR操作はCLIの`--help`に`run_ocr`がある開発checkoutで使います。OCR engine・Python環境・モデルの導入は利用者が任意に行います。公開OCRサービスへの接続、画像の外部送信、自動インストールは行いません。

### ローカルOCRと手動補助を選ぶ

標準の任意OCRは古典籍用のNDL古典籍OCR-Liteです。GPU環境を持つ利用者は、導入済みDocker imageの[NDL古典籍OCR ver.3](https://github.com/ndl-lab/ndlkotenocr_cli)も任意providerとして選べます。近代活字用のNDLOCR-Liteは別の処理系として扱います。

PCで別方式の候補を得る補助経路には[KuroNetの公式ビューア](https://codh.rois.ac.jp/kuronet/iiif-curation-viewer/)を使います。[公式利用案内](https://mp.ex.nii.ac.jp/kuronet/)に従い、利用者がログイン・OCR・本文の取り出しを行います。サービス上のOCR結果は公開されるため、公開IIIF資料と利用条件を確認した範囲を対象にします。

ログインはビューアとダッシュボードの両方で同じアカウントを使います。ビューア右上に「ログイン」が表示されている場合は、画像が開いていてもビューア側の認証が必要です。

### KuroNetの本文を領域へ保存する

開発版の比較画面で対象のページ・矩形を領域コレクションへ保存し、その領域の「KuroNetで補助OCR」を押します。補助パネルのマニフェストURLをコピーし、「KuroNetを開く」から公式画面へ手動入力します。ページと矩形、回転を見比べて同じ範囲を指定してください。ページ全体の本文を扱う場合は比較室にもページ全体の領域を作ります。

公式ビューア右上の「■」で領域を囲み、囲んだ領域をクリックして「KuroNetくずし字認識サービス」へ進みます。ダッシュボードで対象の領域画像を確認して「予約：実行」を押し、再読み込み後の「成功：閲覧」で認識結果を確認します。本文の取得には、自動テキスト化の「処理：実行」から「テキスト化を実行する」へ進みます。読み順の確認・修正にはKuroNet Text Editorを使います。[公式利用案内](https://mp.ex.nii.ac.jp/kuronet/)

取り出した原文を補助パネルへ貼り付け、記録者・任意の結果URLを入力し、ページ・領域の対応を確認して「OCR候補を保存」を押します。外部リンクは固定の公式URLを使い、作業JSON・起動token・画像を自動で送信しません。

保存する本文は`ocr_candidate / unverified`です。改行と空白を含む貼付原文のhash、対象workspace・document・manifest hash・Canvas・領域座標、取込日時・記録者・結果URLを`manual_ocr_provenance`へ残します。利用者の範囲確認は`user_declared`で、文字単位の原画像校合と区別します。未取得のモデル版とサービス処理画像hashはnullです。原領域を削除しても出典snapshotを保持し、現在領域へ戻る操作を停止します。

候補は作業JSONと領域の読解資料へ含めて保存できます。修訂は別IDの本文候補として保持し、原TEIへ自動統合しません。`evaluate_ocr`にもこの手動候補の`text_id`を指定できます。貼付本文hash・候補ID・出典snapshot・現在領域の整合性を確認し、参照翻刻との一致度を計算します。サービス側の原出力・画像同一性の独立検証は、この手動記録からは行えません。

手動OCR候補を含む作業JSONは、この機能がある開発版で保存・再開します。旧版での再保存は新しいprovenanceを保持する保証がありません。領域を移動した場合は候補を履歴に残し、現在領域の読解exportから除外して診断を付けます。取込中の作業JSON・Annotation・テキストの読み込みは、保存完了後に行います。

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

### 任意のGPU版を固定する

GPU版はDockerからNVIDIA GPUを使える環境と、公式source・モデルを含むローカルimageを用意します。上流の導入手順で準備し、`/root/kotenocr_cli/main.py`・`config.yml`・レイアウトver.3・文字認識モデルを含む構成を使います。検証したsource commitは`939cbfaf617eb8fd7e54cf1daeb66fb5a92749ec`、Dockerfileは`docker/Dockerfile`です。導入時のdownloadとbuildは利用者が行い、アプリはimageを取得・更新しません。

`docker image inspect <導入済みimage名> --format '{{.Id}}'`で取得したimmutable IDを使い、次の要求を保存します。例のIDは合成値なので実測値へ置き換えます。

```json
{
  "api_version": "0.1", "operation": "inspect_ocr_provider",
  "provider": "ndlkotenocr-ver3",
  "docker_path": "C:/Program Files/Docker/Docker/resources/bin/docker.exe",
  "image_id": "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
}
```

Liteと同じ方法で返る`result.config`を別のprovider JSONへ保存します。設定は`provider`・`docker_path`・`image_id`・`expected_engine_sha256`・`timeout_ms`です。検査と各runの開始時にimage ID、code・設定・重みのhash、Python・PyTorch・CUDA・GPUを確認します。GPU検査には最大60秒、各領域には設定の実行上限を使います。

接続先はローカルDocker engineに固定します。Windowsは`npipe:////./pipe/docker_engine`、Linuxは`unix:///var/run/docker.sock`を使い、remote contextや独自socketには対応しません。実containerは`--pull never --network none`で動かし、選択画像1件をread-only mountし、出力を新しいrun directoryへ保存します。[Dockerの実行オプション](https://docs.docker.com/reference/cli/docker/container/run/)

GPU版にも次の`run_ocr`・`import_ocr`を使います。原TXT/JSON、行座標、固定image ID、engineのhashを保持し、認識行数の欠落とTXT/JSONの不一致を検出します。失敗時は候補化を止めて部分出力とログを残し、タイムアウト時はこの処理が起動したcontainerだけを停止します。行のconfidenceは未取得としてnullです。旧Lite runとworkspaceは引き続き読み込めます。

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

開発版の`evaluate_ocr`は、保存済みworkspaceと評価JSONから出典付きreportを作ります。Lite/GPUの原run・出力・画像のhashを再検証し、原OCRと任意の画像直接読解／画像併用修訂を比較します。KuroNetの手動候補は貼付記録の整合性を検査して同じ形式で参照翻刻との一致度を保存します。評価操作はNodeだけで動き、OCRや外部モデルを起動しません。

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

KuroNet手動候補は`variants:[]`で評価します。reportの`image_identity="service_bytes_unknown"`・`provenance_validation="manual_copy_consistency"`と、nullのモデル版・処理画像hashを保持します。同一画像hashを確認できるLite/GPUは`verified_local_bytes / raw_run_verified`です。サービス入力画像hashが不明な手動候補へ同一画像条件のVLM variantを追加すると停止します。AI候補との画像比較にはローカルOCRのcaseを使います。

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

公開翻刻が未校合の数値は`reference_agreement`です。`pending_reference`、校合宣言、学習重複、実行していない読解方法を別々に記録します。Canvas数と領域数を区別し、候補種別・生成者・OCR engine hash・画像同一性の確認状態・校合状態・学習重複ごとにmicro CERを集計します。手動サービス結果の実行時間と金銭費用は未計測としてnullを保持します。図中ラベル・編集記号・行の欠落・読み順・表記変更は数値だけで原因を決めず、`observations`に記録者・日時・注記と各項目の`unknown/observed/not_observed`を残します。

## 利用中のAIアプリで領域を読み、疑義を取り込む

`prepare_reading`はローカルOCRの原run・画像・本文と現在の領域を再検証し、読解用の画像、依頼文、応答template、出典taskを新しいdirectoryへ保存します。画像を同じbytesで複製するため、原OCRと同じ表示条件で比較できます。`image_reading`は画像のみ、`image_assisted_correction`は画像と原OCRの併用です。画像のみの依頼文にはOCRやTEIの本文を含めません。KuroNetの手動候補はサービスへ渡した画像hashが不明なため、この同画像課題の基準には使えません。

```json
{
  "api_version": "0.1", "operation": "prepare_reading",
  "workspace_path": "J:/ResearchLibrary/My Project/workspace.json",
  "text_id": "対象のローカルOCR候補ID",
  "kind": "image_assisted_correction",
  "output_dir": "J:/ResearchLibrary/My Project/reading-task"
}
```

requestをUTF-8 JSONで保存し、`jp-lit-iiif --request <request.jsonのpath>`で実行します。利用中のAIアプリで`image.jpg`または`image.png`を実際に開き、`prompt.md`と`response-template.json`を渡してください。画像のみを比較試験する場合、他条件のOCR、翻刻、TEI、過去の読解結果をその文脈へ渡さず、モデル・画像表示・共通指示を揃えます。画像の自動送信や新しいモデル/APIの起動は行いません。

応答はtemplateと同じJSON形式で別fileへ保存します。`generator`へ実際のモデル名、`executed_at`へ読解日時、`image_opened=true`へ実見の自己申告を記録し、確認できないモデル版・時間はnullとします。`monetary_cost`は未計測のnullです。領域全体を覆えた場合は`scope="full_region"`、部分的な読解は`partial_region`と申告します。判読不能を〓として保持し、`doubts`へ候補本文からの`quote`、`alternatives`、`note`を記録します。templateの未読状態のままの応答は取り込めません。

```json
{
  "api_version": "0.1", "operation": "import_reading",
  "workspace_path": "J:/ResearchLibrary/My Project/workspace.json",
  "task_path": "J:/ResearchLibrary/My Project/reading-task/task.json",
  "response_path": "J:/ResearchLibrary/My Project/reading-response.json",
  "output_path": "J:/ResearchLibrary/My Project/workspace-with-reading.json"
}
```

取込はtask・指示・画像・原OCR・応答の整合を確認し、`ai_candidate/unverified`として領域へ保存します。画像実見や全領域の申告は記録者の宣言であり、機械的な文字校合の認定ではありません。原OCRとTEIを保持し、同じ応答の再取込でも確認履歴を保持します。応答を修正する場合は別fileへ保存し、別候補として取り込んでください。新しいAI候補は`import_reading`から取り込み、汎用テキストJSON読込は既存OCR・AI候補の同ID本文と確認履歴の上書きを拒否します。

取込後のworkspaceを比較画面の「作業を読み込む」で開くと、「AI読解と原画像の確認」に候補と疑義が表示されます。「原画像の領域へ」で出典画像へ戻り、「人による確認」または「AIによる確認」、記録者、結果、確認内容、任意の修訂候補を別履歴へ保存できます。確認追加後は「作業を保存」を実行します。AIの確認を人の校合済み参照へ自動昇格しません。領域が移動・削除された候補は履歴として保持し、現在の領域への移動と読解書き出しを制限します。

`evaluate_ocr`のcaseに`reading_text_ids`を指定すると、取り込んだ同じ原OCR・画像の全領域候補を再検証して比較に含めます。画像のみと画像併用が各1件で、inline `variants`と合わせて同じ条件を重複指定できません。部分読解は全文評価から除外し、疑義箇所を小領域として別のOCR/読解課題へ分けます。参照翻刻がない場合は引き続き`pending_reference`です。

## 保存した図版を探して整列差分を確認する（開発版）

図版比較は、保存済みの基準画像1件と候補画像1〜20件の形を比べ、位置合わせ候補・重ね合わせ・濃淡の差を保存します。[Oxford VISE](https://www.robots.ox.ac.uk/~vgg/software/vise/)と[15世紀印刷図版の研究](https://www.robots.ox.ac.uk/~vgg/projects/seebibyte/case_studies/15cillustration/index.html)の領域検索と人による対応確認を参考に、まず手元の小さい画像集合を扱います。実装は[OpenCVのORB](https://docs.opencv.org/4.13.0/d1/d89/tutorial_py_orb.html)と回転・縮尺・平行移動の推定を使います。題材の意味や画風を認識する検索、公開DB全体の探索は後続の範囲です。

解析には任意のuv・Python3.13環境を使います。開発checkoutで次を実行し、固定したOpenCV-headlessとnumpyを準備します。初回の準備では依存packageを取得します。実行時は保存済みJPEG/PNGだけを読み、画像・OCR・モデルへの外部送信を行いません。

```powershell
node scripts/iiif-images.mjs --setup
npm run test:images
```

Python環境は利用者のcacheに作ります。研究用の場所へ揃える場合は、setupと比較画面の起動前に`$env:JP_LIT_IMAGE_ENVIRONMENT='J:/Caches/jp-lit-images'`を設定します。packageの中に仮想環境を作りません。通常MCPと画像の比較表示・書き出しはNodeだけで使えます。

「画像と出典を保存」で取得・利用条件を確認し、比較したい領域の画像を先に保存します。見開き全体には枠線・文字・撮影スケールの繰り返しがあるため、図版を矩形で選ぶと候補を確認しやすくなります。比較画面の「図版を探して比較する」で、保存した`evidence.json`の絶対pathを1行1件で入力し、基準領域と新しい保存先を指定して「似た図版を探す」を押します。JSONに含まれる他の領域を最大20件比較します。

位置合わせは長辺1024px以下で行い、対応点が少ない、小部分に偏る、共通範囲が狭い画像は保留します。成立した場合も図版の一致は確認待ちです。枠線・文字・定規だけが似た別ページや別図版が候補に上がることがあります。原画像へ戻って確かめ、候補順位から資料間の関係を確定しません。

「比較画像」は基準画像・整列画像・重ね合わせ・原濃淡の差・濃淡調整後の差を切り替えます。調整差の赤は閾値を超えた画素、灰は共通比較範囲の外です。紙色・照明・縮小・補間・位置合わせの誤差も差に含まれます。赤い部分だけで改版や加筆と認定せず、原差と調整差を原画像に戻って確認します。透視変形、ページの湾曲、非線形変形は扱いません。

両側の「原領域へ」から出典の場所へ戻れます。「図版対応の確認」に記録者・対応／非対応／判断保留・確認内容を入力し、「作業を保存」で保存します。最新の確認結果・記録者・日時は候補cardに表示します。図版対応とTEI本文校合は別履歴です。同じreportの再取込は確認履歴を保持します。解析中に領域を削除した場合も、開始時に検証した結果を同じworkspaceの履歴へ保存し、最新の注記を保持します。移動・削除した領域は当時のsnapshotを残し、現在の領域への移動・確認追加・読解書き出しを制限し、除外した候補IDを診断へ記録します。

CLIの比較要求も同じ処理を使います。次の例のpathと領域IDを保存済みの資料へ置き換え、UTF-8 JSONとして保存します。

```json
{
  "api_version": "0.1", "operation": "compare_images",
  "workspace_path": "J:/ResearchLibrary/My Project/workspace.json",
  "query": {"evidence_path": "J:/ResearchLibrary/My Project/evidence-a/evidence.json", "evidence_id": "region-a"},
  "candidates": [{"evidence_path": "J:/ResearchLibrary/My Project/evidence-b/evidence.json", "evidence_id": "region-b"}],
  "output_dir": "J:/ResearchLibrary/My Project/image-comparison-1"
}
```

```powershell
node scripts/iiif-workbench.mjs --request 'J:/ResearchLibrary/My Project/compare.json'
```

比較要求は新しいdirectoryへ`report.json`・入力画像のコピー・解析PNGを保存します。workspaceへの登録は次の要求、または画面の「保存済みの比較結果を取り込む」で行います。

```json
{
  "api_version": "0.1", "operation": "import_comparison",
  "workspace_path": "J:/ResearchLibrary/My Project/workspace.json",
  "report_path": "J:/ResearchLibrary/My Project/image-comparison-1/report.json",
  "output_path": "J:/ResearchLibrary/My Project/workspace-with-comparison.json"
}
```

reportは両側の出典JSONと画像hash・manifest取得版・Canvas・領域・画像座標変換、candidate→queryの行列、Python/OpenCV/numpy版とengine hash、固定設定・処理時間を保持します。取込と読解書き出しは原report・出典JSON・原画像・解析PNGを再検証します。関係する履歴は`evidence.json`の`image_comparison_evidence`へ`figure_candidate`として保存されます。比較結果と原資料の保存先を一緒に保持してください。

受入試験では古典籍3資料の保存済み12画像、同一画像の対照、既知の回転・濃淡変更・追加印を使いました。別所蔵本の限定試験には、[国文研本『人倫訓蒙図彙』](https://codh.rois.ac.jp/pmjt/book/200016830/)と[NDL本の巻1](https://ndlsearch.ndl.go.jp/books/R100000039-I2592439)を使いました。図版領域を実見して解析前にAIの仮対応を固定し、基準2領域を候補6領域ずつと比較したところ、対応候補2組は各1位で整列し、別図版との10組は整列保留でした。基準は同じCanvasの2図、候補は5 Canvasです。少数例の順位を一般精度として扱わず、人の図版校合と同版木の認定は未実施として保持します。

両本の対応候補では、調整差が比較範囲の約27〜29%に出ました。原画像の彩色の差と、重ね合わせで見える線のずれ・紙の状態を実見しています。差分の各画素の原因は確定していません。原濃淡差を併記し、濃淡調整で一律に改善するとは扱いません。撮影・彩色・印刷・位置合わせの差を、改版や加筆の証拠へ自動変換しない用途で使ってください。人による対応確認を持つ評価集合と統合レビューを揃えてから、次版の公開を判断します。

主要フローの統合受入では、伊勢物語のOCR3候補・AI2候補、廣瀬本万葉集のTEI20参照、両本の図版比較1件を同じ4窓の作業で保存しました。本文と画像、OCR行、AI疑義、図版の両側原領域への移動、保存・再読込を確認しています。元workspaceのIDと原候補を保持し、新しい図版出典をその作業から書き出して比較します。別workspaceのreportはそのまま取り込めません。単に作業ファイルを同じfolderへ置いて出典を統合する方法は使わないでください。

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

第4段階の類似図版・整列差分は、保存済み画像を使う任意のローカル機能として実装しています。手動で対応を定めた別本の図版集合で検索順位と誤検出を評価し、撮影条件に由来する差と史料上の差を区別する検証を続けます。

## 取得と利用条件

検索MCPは従来どおり書誌・リンク・metadataを返します。manifest・選択画像の取得は利用者が任意CLIで指定した範囲に限定します。資料のlicense／attribution／rights／requiredStatementの原記述を残し、URLの存在から取得許可や校合完了を推定しません。[source利用条件](source-usage-conditions.md)と元機関の条件を参照してください。

比較画面の127.0.0.1 serverは起動tokenとOrigin/Hostを確認し、指定workspaceと同梱assetを扱います。起動tokenはURLのfragmentに保持するため、同じタブの再読み込みで保存済み作業を再開できます。外部へのReferrerは送信しません。AIへの送信は利用中のAIアプリと資料別の許可に従います。初版アプリは外部モデルやOCRへ自動送信しません。
