# Modal古典籍OCR bridge

`jp-lit-iiif`の任意provider `ndlkotenocr-modal`が使うPython package。通常のMCP・比較室・ローカルOCRはこの依存関係を使わない。

公式NDL古典籍OCR ver.3のcode commit `939cbfaf617eb8fd7e54cf1daeb66fb5a92749ec`を固定し、A10一台・リトライなし・一時Appで処理する。起動したAppは処理後に閉じる。公開endpointとVolumeは作らない。推論時は外部通信を遮断し、build時に公式code・モデル・依存を取得する。

モデル版の同定は初回probeの実体hashで行い、各画像の処理前に再確認する。既存GPU wrapperで行batchの脱落を検査し、原TXT/JSON、実行ID、時間、入力hashを保存する。認証は利用者の既存Modal設定をSDKが読む。認証情報は要求・結果・logへ出力しない。

SDKのpollを2秒ごとに区切り、hostの停止要求では所有callをcancelする。build後もdispatch前に停止要求を検査する。Node側は原応答とstderrを上限付きで保持し、SDKの通常終了を待ってから、応答しない所有helperのprocess treeを回収する。

開発テスト: `uv run --directory packages/iiif-ocr-modal --frozen python -m unittest discover -s tests -v`。

実行方法は[CLIリファレンス](../../docs/iiif-cli-reference.md)に記載する。外部送信対象の画像hashをconfigへ明示する。実資料のrawと比較結果はResearchLibraryのworkへ保存し、repoへ含めない。
