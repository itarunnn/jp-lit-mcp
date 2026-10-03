# jp-lit TEI reader

固定したローカルTEI/XMLの情報・単位一覧・構造抽出・参照点検をJSONで返すPython CLI。本文、異読、訂正、注記の枝と位置を保持する。Python 3.13.15・uv・標準ライブラリを使う。

repositoryのこのdirectoryで次を実行する。

```sh
uv run --frozen python -m tei_reader --help
uv run --frozen python -m unittest discover -s tests -v
```

npmからは任意の `jp-lit-tei-reader` launcherで起動できる。[導入と要求JSON](../../docs/tei-reader.md)を参照する。MCPの書誌検索はNode.jsだけで利用できる。

examples/sample.xmlは操作説明用の自作合成資料。実際の文学作品や底本を配布するものではない。ソフトウェアとこの例はrepositoryの[MIT License](../../LICENSE)で配布する。
