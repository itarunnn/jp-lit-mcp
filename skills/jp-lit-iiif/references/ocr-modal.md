# Modal A10で公開古典籍を処理する

0.19.2の`ndlkotenocr-modal`で、利用者が指定した公開画像をA10で処理する。既存のModal認証とuvを使う。通常のMCPはNode-onlyで、Python SDKは選択したproviderだけが使う。

1. 資料の利用条件、Modalへの送信範囲、画像1〜4件のSHA-256を記録する。セッション中の同じ対象・送信先の承認を引き継ぐ。
2. 次のinspect要求で、例のhashを保存画像の実測値へ置き換える。inspectは固定imageをbuildし、画像を送らずA10上でcode・モデルを検査する。buildとprobeは課金対象になる。

```json
{"api_version":"0.1","operation":"inspect_ocr_provider","provider":"ndlkotenocr-modal","approved_image_sha256":["eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"],"timeout_ms":600000}
```

3. CLI応答の`result.config`をprovider JSONへ保存する。engine snapshot、adapter hash、承認した画像hashを保持する。`run_ocr`へ既存evidence、新しい出力先、この`provider_config_path`を渡す。scope外・改変画像は送信前に停止する。固定内容が変わった場合はinspectから設定を作り直す。
4. 完了したrunを`import_ocr`で取り込み、`export_ocr_tei`で1〜4候補を出力する。`link_tei`へ生成XMLの実測hashと対象documentを渡し、本文の`seg@facs`から原Canvasの行位置へ戻る。取込とTEI出力は保存済みartifactで検証し、再送しない。

A10一枚・CPU 2 core・memory 8192 MiB・並列1・リトライ0・各画像の推論上限600秒を使う。一時Appは実行後に閉じる。原JSON/TXT、画像hash、行検査、`modal-response.json`、`modal-receipt.json`、call ID、logをResearchLibraryへ保持する。失敗時は新しいrun directoryで再試行する。hostの停止要求では所有callをcancelし、未確認の場合は保存したcall IDでModalの状態を調べる。

Liteとの比較は同じ画像bytesを使い、行位置・読み順・原画像の読める箇所を照合する。推論時間、model読込を含むworker時間、通信・起動待ちを含む所要時間を分け、worker時間による費用試算と実請求額を分けて残す。
