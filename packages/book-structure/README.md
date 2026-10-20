# 書籍構造の派生出力

位置付きOCRから作った共通JSONをSQLiteへ保存する、任意のローカルmoduleです。辞書項目、図版、文字範囲、読み順、対応関係、確認・訂正履歴を同じDBへ保持します。

Python 3.13系とuvを使用します。SQLiteの実行依存はPython標準ライブラリです。TEIの生成はNode.js側で行います。検証時は開発依存のlxmlと固定版TEI schemaを使います。

通常の入口は`jp-lit-iiif`の`export_book_structure`です。Node.js側が原資料とsnapshotのhash・出力先を検査してから、このmoduleを呼びます。

開発checkoutでの入力・profile選択・確認・出力の一連の操作は、[書籍構造の共通基盤](../../docs/book-structure.md)を参照してください。

```powershell
uv run --directory packages/book-structure --frozen python -m unittest discover -s tests -v
```

SQLiteは新規ファイルへtransactionで生成し、既存DBへ上書きやmigrationを行いません。`fields`から見出しや本文を検索し、`field_spans → spans → lines → pages`で元画像へ戻れます。`regions`には文字を持たない図版もあります。確認状態は`current_reviews`からaspectとactor別に取得します。

図版は`units`から`unit_regions → regions → pages`でCanvasと座標へ戻れます。一つの図版unitが重複検出の複数regionを参照するため、図の件数はunit単位、原検出の件数はregion単位で数えます。説明文との関係は`caption_of`、図群と部分図は`contains`として保存し、それぞれの確認結果を`current_reviews`で読みます。TEIでも同じ原領域と関係を保持します。

開発用fixtureのTEI schemaはTEI Consortium P5 4.12.0です。出典・hashは`tests/fixtures/tei-schema.json`、許諾は同じdirectoryの`TEI-LICENSE.md`を参照してください。schemaとtestsはnpm配布対象へ含めません。
