# ndl-jp-lit-mcp

NDL Search と NDLデジタルコレクションを対象にした、日本語文献探索向け MCP サーバーです。`ndl_digital` は独立 API ではなく、NDL Search API に `dpid=ndl-dl` を付けた検索と detail endpoint を利用します。

## セットアップ

```bash
npm install
```

## 環境変数

- `NDL_SEARCH_BASE_URL`
  - 既定値: `https://ndlsearch.ndl.go.jp/api/opensearch`
  - `ndl_search` source の検索 base URL を上書きします。
- `NDL_DIGITAL_BASE_URL`
  - 既定値: `https://ndlsearch.ndl.go.jp/api/opensearch`
  - `ndl_digital` source の検索 base URL を上書きします。

補足:

- どちらの環境変数も、`/api/opensearch` か `/api/bib/external/search` のどちらを渡しても、実装側で検索 URL と record URL を組み直します。
- `NDL_DIGITAL_BASE_URL` を設定しても `dpid=ndl-dl` は adapter 側で付与されます。
- detail endpoint は最終的に `/api/bib/external/search?cs=bib&f-token=...` を使います。

## 実行方法

### 開発実行

```bash
npm run dev
```

- `src/index.ts` から stdio transport で MCP サーバーを起動します。

### テスト

```bash
npm test
```

### 型ビルド

```bash
npm run build
```

## fixture について

- `tests/fixtures/ndl-search/*.json`
  - NDL Search の compatibility projection と live 応答抜粋を同居させています。
- `tests/fixtures/ndl-digital/*.json`
  - `dpid=ndl-dl` 前提の compatibility projection と live 応答抜粋を同居させています。
- OpenSearch XML の live parse は本体未実装なので、fixture の `_fixture.liveResponseExtract` に raw 構造の要点を残し、top-level には既存 mapper が扱う JSON-compatible 形を置いています。
