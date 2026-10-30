# 同梱ビューアの許諾

書籍構造の開発テストはTEI ConsortiumのP5 4.12.0 Relax NG schemaを使用します。`packages/book-structure/tests/fixtures/`へ原文・出典・hashと[上流の許諾](https://github.com/TEIC/TEI/blob/dev/LICENSE.md)を保持し、BSD-2-Clauseの条件に従います。schemaと開発テストはnpm配布へ含めません。

IIIF比較画面は[Mirador](https://github.com/ProjectMirador/mirador)4.2.6の配布UMD bundleを同梱します。MiradorはApache-2.0です。`dist/iiif/web/vendor/MIRADOR-LICENSE.txt`と`NOTICE.txt`を配布物に含めます。上流bundleの許諾commentを保持し、依存の許諾を`THIRD-PARTY-LICENSES.txt`へ保存します。

このrepoのコードはLICENSEに示すMITです。資料画像・manifest・原テキストの権利は提供元の条件に従い、ソフトウェアの許諾と別に扱います。

NDL古典籍OCR-Liteは利用者が任意に導入する外部engineです。code・重みの許諾は[上流のCC BY 4.0](https://github.com/ndl-lab/ndlkotenocr-lite)を参照してください。このpackageはengine・重みを同梱せず、ローカル呼び出し用のadapterを提供します。原出力にはengineとモデルのhashを残します。

## 0.19.0の依存監査

2026-10-31にSDKを1.32.2、Vitestを4.1.12へ更新し、互換範囲の依存修正版をlockへ反映しました。更新後のnpm auditはZod 3のhigh 1件と、Mirador／deepmergeのlow 2件を報告しています。production依存の報告はZodの1件です。

[Zodの資源消費advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)は、大きい不正な配列の検証でissueが増える問題です。本projectのMCPはstdioを使い、IIIFのHTTP操作はHost・Origin・tokenと入力容量を検査します。CLIは要求1MiB、manifest取得は10MiB・Canvas 2,000件を上限にしています。悪意ある資料や作業ファイルによる検証時のメモリ増幅は継続する確認事項です。Zod 4への移行と、検証前の配列・node数制限を後続の対応として扱います。

[deepmergeのadvisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)には修正版がありません。Miradorには固定configと内部pluginを渡し、manifestと保存stateを再構成して使っています。同梱Mirador 4.2.6の配布bundleは固定し、依存packageの更新とbundle内容の更新を分けて管理します。
