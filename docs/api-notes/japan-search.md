# Japan Search API メモ

## 採用方針

- `japan_search` は Japan Search の簡易 Web API を使う。
- 検索は `https://jpsearch.go.jp/api/item/search/jps-cross` を使う。
- 詳細取得は `https://jpsearch.go.jp/api/item/{itemId}` を使う。

## 2026-04-26 時点の実装メモ

- 検索パラメータは `keyword`, `size`, `from` を利用。
- search / record とも JSON を返す。
- 共通フィールドは `common` を優先し、不足分は provider 固有の `*-rdf:RDF` から補う。
- `portal source` なので、初版では source 未指定の横断検索には含めない。

## 注意

- Japan Search は横断ポータルであり、`ndl_catalog` / `ndl_digital` / `cinii_*` と重複しやすい。
- このため、初版では独立 source としてのみ公開し、横断既定にはまだ入れない。

