# ローカル古典籍OCRの導入・実行・参照評価

## CLIを固定して使う

この手順は0.18.0向けです。Node.js22以上・npm・git・uvを用意し、要求JSONを次のように実行します。開発checkoutではbuildしたCLIを使います。

```powershell
npx --yes --package=jp-lit-mcp@0.18.0 jp-lit-iiif --request 'J:/research/request.json'
```

以下のcheckout向け`node scripts/iiif-workbench.mjs`は、この固定版npx起動へ置き換えられます。保存先は自分のtoolchain・研究directoryへ変更します。原画像・原出力・providerはrepo外で保管します。
## ローカルくずし字OCRを使う

前近代の写本・版本を読む利用者向けに、[NDL古典籍OCR-Lite](https://github.com/ndl-lab/ndlkotenocr-lite)を任意のローカルengineとして接続します。[国会図書館の案内](https://lab.ndl.go.jp/news/2025/2026-02-24/)は、古典籍と近代活字の処理系を分けて紹介しています。ここで扱うのは古典籍用です。CPUで動き、実行時は保存済みのJPEG/PNGを読みます。通常の比較画面とMCPはNodeだけで使えます。

OCR操作はCLIの`--help`に`run_ocr`がある開発checkoutで使います。OCR engine・Python環境・モデルの導入は利用者が任意に行います。公開OCRサービスへの接続、画像の外部送信、自動インストールは行いません。

### ローカルOCRと手動補助を選ぶ

標準の任意OCRは古典籍用のNDL古典籍OCR-Liteです。GPU環境を持つ利用者は、導入済みDocker imageの[NDL古典籍OCR ver.3](https://github.com/ndl-lab/ndlkotenocr_cli)も任意providerとして選べます。近代活字用のNDLOCR-Liteは別の処理系として扱います。

PCで別方式の候補を得る補助経路には[KuroNetの公式ビューア](https://codh.rois.ac.jp/kuronet/iiif-curation-viewer/)を使います。[公式利用案内](https://mp.ex.nii.ac.jp/kuronet/)に従い、利用者がログイン・OCR・本文の取り出しを行います。サービス上のOCR結果は公開されるため、公開IIIF資料と利用条件を確認した範囲を対象にします。

ログインはビューアとダッシュボードの両方で同じアカウントを使います。ビューア右上に「ログイン」が表示されている場合は、画像が開いていてもビューア側の認証が必要です。

### KuroNetの本文を領域へ保存する

本版の比較画面で対象のページ・矩形を領域コレクションへ保存し、その領域の「KuroNetで補助OCR」を押します。補助パネルのマニフェストURLをコピーし、「KuroNetを開く」から公式画面へ手動入力します。ページと矩形、回転を見比べて同じ範囲を指定してください。ページ全体の本文を扱う場合は比較室にもページ全体の領域を作ります。

公式ビューア右上の「■」で領域を囲み、囲んだ領域をクリックして「KuroNetくずし字認識サービス」へ進みます。ダッシュボードで対象の領域画像を確認して「予約：実行」を押し、再読み込み後の「成功：閲覧」で認識結果を確認します。本文の取得には、自動テキスト化の「処理：実行」から「テキスト化を実行する」へ進みます。読み順の確認・修正にはKuroNet Text Editorを使います。[公式利用案内](https://mp.ex.nii.ac.jp/kuronet/)

取り出した原文を補助パネルへ貼り付け、記録者・任意の結果URLを入力し、ページ・領域の対応を確認して「OCR候補を保存」を押します。外部リンクは固定の公式URLを使い、作業JSON・起動token・画像を自動で送信しません。

保存する本文は`ocr_candidate / unverified`です。改行と空白を含む貼付原文のhash、対象workspace・document・manifest hash・Canvas・領域座標、取込日時・記録者・結果URLを`manual_ocr_provenance`へ残します。利用者の範囲確認は`user_declared`で、文字単位の原画像校合と区別します。未取得のモデル版とサービス処理画像hashはnullです。原領域を削除しても出典snapshotを保持し、現在領域へ戻る操作を停止します。

候補は作業JSONと領域の読解資料へ含めて保存できます。修訂は別IDの本文候補として保持し、原TEIへ自動統合しません。`evaluate_ocr`にもこの手動候補の`text_id`を指定できます。貼付本文hash・候補ID・出典snapshot・現在領域の整合性を確認し、参照翻刻との一致度を計算します。サービス側の原出力・画像同一性の独立検証は、この手動記録からは行えません。

手動OCR候補を含む作業JSONは、この機能がある開発版で保存・再開します。旧版での再保存は新しいprovenanceを保持する保証がありません。領域を移動した場合は候補を履歴に残し、現在領域の読解exportから除外して診断を付けます。取込中の作業JSON・Annotation・テキストの読み込みは、保存完了後に行います。

### 任意のengineを導入する

Windowsで検証した例はuvとPython3.12.12を使います。保存先を自分のtoolchain directoryへ変更してください。engineのcodeと重みは上流のCC BY 4.0に従い、研究画像の利用条件は資料ごとに確認します。

```powershell
git clone --no-checkout https://github.com/ndl-lab/ndlkotenocr-lite.git 'J:/toolchains/iiif-koten-ocr/engine'
git -C 'J:/toolchains/iiif-koten-ocr/engine' checkout --detach ede4283845cdc0ba2bda8b7ebfc3dc80b33c92c8
git -C 'J:/toolchains/iiif-koten-ocr/engine' rev-parse HEAD
uv init --bare --no-workspace --python 3.12.12 --name jp-lit-local-koten-ocr 'J:/toolchains/iiif-koten-ocr'
uv python pin --directory 'J:/toolchains/iiif-koten-ocr' 3.12.12
uv add --directory 'J:/toolchains/iiif-koten-ocr' --python 3.12.12 -r 'J:/toolchains/iiif-koten-ocr/engine/requirements.txt'
```

2026-10-05の検証commitは`ede4283845cdc0ba2bda8b7ebfc3dc80b33c92c8`です。採用したcommitと生成された`pyproject.toml`・`uv.lock`・`.python-version`を保管します。上の例は検証済みcommitへ固定します。更新する場合は別の導入先で依存とCLIを再確認し、provider設定を再生成してください。`--bare`はPython固定fileを作らないので、`uv python pin`も実行します。準備にはengine・重み・依存packageのdownloadが伴います。画像を送信する処理はありません。

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

本版の`evaluate_ocr`は、保存済みworkspaceと評価JSONから出典付きreportを作ります。Lite/GPUの原run・出力・画像のhashを再検証し、原OCRと任意の画像直接読解／画像併用修訂を比較します。KuroNetの手動候補は貼付記録の整合性を検査して同じ形式で参照翻刻との一致度を保存します。評価操作はNodeだけで動き、OCRや外部モデルを起動しません。

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


### 人手参照と観察の記録

人が領域全体を翻刻した参照は`origin="human_transcription"`とします。原画像を実際に校合した場合に限り`verification="source_collated"`とし、`review`に`author`・`recorded_at`（ISO日時）・`note`を残します。未校合なら`verification="unreviewed"`、`review=null`です。

`observations`は未登録ならnull、登録する場合は次の形です。各項目は`unknown`・`observed`・`not_observed`のいずれかです。本文・記録者・日時は実際の観察へ置き換えます。

```json
{"author":"記録者","recorded_at":"2026-10-08T00:00:00.000Z","note":"選択領域を確認した内容","line_omission":"unknown","reading_order":"unknown","orthographic_change":"unknown"}
```

人の回答とAIの判断を分け、未確認の条件はunknownまたはnullで保ちます。画像を開いただけの確認を人手の文字校合へ変換しません。
## 前提ツールと本文hash

Windowsの前提ツールは[Node.js公式](https://nodejs.org/en/download)、[Git公式](https://git-scm.com/downloads/win)、[uv公式](https://docs.astral.sh/uv/getting-started/installation/)の案内で導入する。Node/npmはprojectのmise管理を優先し、既存環境の版を確認してから準備する。通常は上の0.18.0固定CLIを使う。開発checkoutは`https://github.com/itarunnn/jp-lit-mcp`から取得してbuildする。

参照本文のhashはファイル全体のhashと区別する。JSONの`text`そのものをUTF-8へ変換し、改行・空白を保持したbytesから求める。次は評価JSONの第1caseの本文hashを設定する例で、原翻刻や原画像を変更しない。

```powershell
$evaluationPath = 'J:/research/work/ocr/evaluation.json'
$evaluation = Get-Content -Raw $evaluationPath | ConvertFrom-Json
$bytes = [Text.Encoding]::UTF8.GetBytes($evaluation.cases[0].reference.text)
$evaluation.cases[0].reference.text_sha256 = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
$evaluation | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $evaluationPath
```
