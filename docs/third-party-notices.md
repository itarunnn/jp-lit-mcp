# 同梱ビューアの許諾

書籍構造の開発テストはTEI ConsortiumのP5 4.12.0 Relax NG schemaを使用します。`packages/book-structure/tests/fixtures/`へ原文・出典・hashと[上流の許諾](https://github.com/TEIC/TEI/blob/dev/LICENSE.md)を保持し、BSD-2-Clauseの条件に従います。schemaと開発テストはnpm配布へ含めません。

IIIF比較画面は[Mirador](https://github.com/ProjectMirador/mirador)4.2.6の配布UMD bundleを同梱します。MiradorはApache-2.0です。`dist/iiif/web/vendor/MIRADOR-LICENSE.txt`と`NOTICE.txt`を配布物に含めます。上流bundleの許諾commentを保持し、依存の許諾を`THIRD-PARTY-LICENSES.txt`へ保存します。

このrepoのコードはLICENSEに示すMITです。資料画像・manifest・原テキストの権利は提供元の条件に従い、ソフトウェアの許諾と別に扱います。

NDL古典籍OCR-Liteは利用者が任意に導入する外部engineです。code・重みの許諾は[上流のCC BY 4.0](https://github.com/ndl-lab/ndlkotenocr-lite)を参照してください。このpackageはengine・重みを同梱せず、ローカル呼び出し用のadapterを提供します。原出力にはengineとモデルのhashを残します。

## 0.19.2の依存監査

2026-11-16の公開前監査では、依存lockを0.19.1から維持した状態で、high 1件・moderate 2件・low 3件（影響package数）が報告されました。今回の文書・Skill更新に伴う依存の追加・更新はありません。

| package / lock版 | 重要度 | 監査結果と後続確認 |
| --- | --- | --- |
| Zod 3.25.76 | high | [資源消費advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)。下記の継続事項を引き継ぐ |
| @hono/node-server 2.1.5 | moderate | [WebSocket処理](https://github.com/advisories/GHSA-qv5m-9pm6-hqp3)と[HTTP pathの扱い](https://github.com/advisories/GHSA-jpvv-r467-5p4w)に関する報告。SDKの推移依存として更新候補を確認する |
| Hono 4.13.12 | moderate | [mountのmiddleware適用](https://github.com/advisories/GHSA-4m76-xfj5-7975)などHTTP経路に関する報告。SDKの推移依存として更新候補を確認する |
| fast-xml-parser 5.10.1 | low | [閉じていないstop-nodeタグの走査](https://github.com/advisories/GHSA-474x-hrwr-fgx4)に関する報告。XML解析の互換性と修正版を後続で確認する |
| Mirador 4.2.6 / deepmerge 4.3.1 | low（各1件） | [deepmergeのadvisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)。配布bundleと依存packageを分けて確認する |

現行MCP serverはstdio transportを使い、repoのXMLParser生成箇所は `stopNodes` を設定していません。これは今回確認した利用経路の記録です。各advisoryの到達可能性と修正の検証は後続作業とし、監査報告の解消を今回のリリースに含めていません。

## 0.19.0の依存監査

2026-10-31にSDKを1.32.2、Vitestを4.1.12へ更新し、互換範囲の依存修正版をlockへ反映しました。更新後のnpm auditはZod 3のhigh 1件と、Mirador／deepmergeのlow 2件を報告しています。production依存の報告はZodの1件です。

[Zodの資源消費advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)は、大きい不正な配列の検証でissueが増える問題です。本projectのMCPはstdioを使い、IIIFのHTTP操作はHost・Origin・tokenと入力容量を検査します。CLIは要求1MiB、manifest取得は10MiB・Canvas 2,000件を上限にしています。悪意ある資料や作業ファイルによる検証時のメモリ増幅は継続する確認事項です。Zod 4への移行と、検証前の配列・node数制限を後続の対応として扱います。

[deepmergeのadvisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)には修正版がありません。Miradorには固定configと内部pluginを渡し、manifestと保存stateを再構成して使っています。同梱Mirador 4.2.6の配布bundleは固定し、依存packageの更新とbundle内容の更新を分けて管理します。
