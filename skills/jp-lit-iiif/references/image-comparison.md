# 保存済み図版の類似候補・整列・差分を確かめる

0.18.0の要求実行は
```powershell
npx --yes --package=jp-lit-mcp@0.18.0 jp-lit-iiif --request 'J:/research/request.json'
```
を使える。開発checkoutでは下記のコマンドで実行する。

## 対象版とローカル環境

実行するCLIの`--help`に`compare_images`と`import_comparison`がある場合に使う。新しい操作は0.18.0以降の機能。開発checkoutでは`npm ci`・`npm run build`後、`node scripts/iiif-workbench.mjs --request <要求JSON>`を使う。

画像解析は任意のuv・Python3.13環境を必要とする。開発checkoutで`node scripts/iiif-images.mjs --setup`を実行し、固定したOpenCV-headless/numpyを利用者cacheへ準備する。初回setupは依存取得を伴う。環境を指定する場合はsetupとCLI／画面起動の前に`JP_LIT_IMAGE_ENVIRONMENT`へ専用directoryの絶対pathを設定する。実行は保存済みJPEG/PNGだけを読み、画像取得・外部OCR／モデル送信を行わない。通常MCPと画像表示・書き出しはNode-only。

## 比較画像と出典を指定する

同じworkspaceに両本の資料・対象領域を保存し、利用条件を確認して`export_evidence`で画像と出典を新しいdirectoryへ保存する。見開き全体には枠線・文字・撮影スケールの反復があるので、図そのものを矩形で選ぶ。基準1件、候補1〜20件を指定し、同じ領域IDの重複を避ける。別workspaceのevidenceをそのまま混ぜず、同じ作業内で選択・書き出す。

```json
{
  "api_version": "0.1", "operation": "compare_images",
  "workspace_path": "J:/research/workspace.json",
  "query": {"evidence_path":"J:/research/figures-a/evidence.json","evidence_id":"r1"},
  "candidates": [
    {"evidence_path":"J:/research/figures-b/evidence.json","evidence_id":"r2"},
    {"evidence_path":"J:/research/figures-b/evidence.json","evidence_id":"r3"}
  ],
  "output_dir": "J:/research/comparison-01"
}
```

要求JSONのpath・IDを実測値へ置き換える。新しいdirectoryに`report.json`、入力画像コピー、解析PNGを保存する。弱い・局所的な対応や共通範囲が狭いものは`held`となり、差分生成を保留する。`aligned`も図版対応の確認待ち。処理終了値と`ok`を読み、失敗時に原画像・reportを上書きしない。

## workspaceへ登録して原領域へ戻る

```json
{
  "api_version": "0.1", "operation": "import_comparison",
  "workspace_path": "J:/research/workspace.json",
  "report_path": "J:/research/comparison-01/report.json",
  "output_path": "J:/research/workspace-with-comparison.json",
  "overwrite": false
}
```

終了値0と`ok=true`を確認する。取込は原report・出典JSON・原画像・解析PNGのhash、manifest取得版・Canvas・矩形・寸法を再検証する。原資料とreportの保存先を一緒に保持する。

出力workspaceを比較画面で開き、「図版を探して比較する」の候補と比較画像を確認する。画面から計算する場合は保存済み`evidence.json`の絶対pathを1行1件、基準領域、新しい保存先を指定する。含まれる他の領域を最大20件比較する。「保存済みの比較結果を取り込む」も使える。

「比較画像」は基準・整列・重ね合わせ・原濃淡の差・濃淡調整差を切り替える。調整差の赤は閾値を超えた画素、灰は共通範囲の外。紙色・彩色・照明・縮小・補間・位置合わせの誤差も含まれる。透視・湾曲・非線形変形は扱わない。

両側の「原領域へ」で実画像を開く。「図版対応の確認」に記録者、対応／非対応／判断保留、確認内容を記録し「作業を保存」。候補順位・整列成立・図版対応・同版木の認定・TEI文字校合はそれぞれ区別する。AIの視覚的な仮対応は記録者と注記へ明示する。図版確認はTEI校合へ変換されない。

同report再取込は履歴を保持する。領域の移動・削除後も当時のsnapshotを保持し、現在領域への移動・確認追加・読解書き出しを制限する。exportの`image_comparison_evidence`は`figure_candidate`で、両側出典と関係する確認を持つ。原差・調整差を画像へ戻って検討し、少数の成功例から全資料の精度を推定しない。

## npm導入先で画像環境を準備する

任意のtoolchain先へpackageを導入し、同じ導入先からsetupとCLIを使う。

```powershell
npm install --prefix 'J:/toolchains/jp-lit-iiif' --omit=dev jp-lit-mcp@0.18.0
node 'J:/toolchains/jp-lit-iiif/node_modules/jp-lit-mcp/scripts/iiif-images.mjs' --setup
node 'J:/toolchains/jp-lit-iiif/node_modules/jp-lit-mcp/scripts/iiif-workbench.mjs' --request 'J:/research/request.json'
```

setup先とnpxの導入先が異なる場合はJP_LIT_IMAGE_ENVIRONMENTへ同じ専用cacheの絶対pathを指定し、setup・解析・画面起動に共通適用する。原画像や作業directoryを環境保存先にしない。
