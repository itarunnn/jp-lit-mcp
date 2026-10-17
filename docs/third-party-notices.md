# 同梱ビューアの許諾

書籍構造の開発テストはTEI ConsortiumのP5 4.12.0 Relax NG schemaを使用します。`packages/book-structure/tests/fixtures/`へ原文・出典・hashと[上流の許諾](https://github.com/TEIC/TEI/blob/dev/LICENSE.md)を保持し、BSD-2-Clauseの条件に従います。schemaと開発テストはnpm配布へ含めません。

IIIF比較画面は[Mirador](https://github.com/ProjectMirador/mirador)4.2.6の配布UMD bundleを同梱します。MiradorはApache-2.0です。`dist/iiif/web/vendor/MIRADOR-LICENSE.txt`と`NOTICE.txt`を配布物に含めます。上流bundleの許諾commentを保持し、依存の許諾を`THIRD-PARTY-LICENSES.txt`へ保存します。

このrepoのコードはLICENSEに示すMITです。資料画像・manifest・原テキストの権利は提供元の条件に従い、ソフトウェアの許諾と別に扱います。

NDL古典籍OCR-Liteは利用者が任意に導入する外部engineです。code・重みの許諾は[上流のCC BY 4.0](https://github.com/ndl-lab/ndlkotenocr-lite)を参照してください。このpackageはengine・重みを同梱せず、ローカル呼び出し用のadapterを提供します。原出力にはengineとモデルのhashを残します。
