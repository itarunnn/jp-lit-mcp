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

### MCP smoke check

```bash
npm run smoke:mcp
```

- `jp_lit_search` と `jp_lit_get_record` が MCP ツールとして公開されているかをローカルで確認します。
- この確認は in-memory transport を使うため、外部 API への疎通は見ません。

## MCP 登録例

Codex / ChatGPT 系の MCP 設定では、stdio でこのサーバーを起動します。例:

```json
{
  "mcpServers": {
    "ndl-jp-lit": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "J:\\apps\\ndl-jp-lit-mcp",
      "env": {
        "NDL_SEARCH_BASE_URL": "https://ndlsearch.ndl.go.jp/api/opensearch",
        "NDL_DIGITAL_BASE_URL": "https://ndlsearch.ndl.go.jp/api/opensearch"
      }
    }
  }
}
```

ローカルに `npm` パスの問題がある場合は、`command` を `node` に変えて `tsx` 経由で `src/index.ts` を起動する形でも構いません。
同内容のサンプルは [mcp-config.example.json](J:/apps/ndl-jp-lit-mcp/mcp-config.example.json:1) に置いてあります。

## 公開ツール

- `jp_lit_search`
  - 引数: `query`, `source?`, `limit?`, `page?`
- `jp_lit_get_record`
  - 引数: `source`, `source_id`

補足:

- `source` は `ndl_search` または `ndl_digital` を取ります。
- `ndl_digital` は内部的には `dpid=ndl-dl` を付けた NDL Search API を利用します。

## ツール利用例

### 1. NDL Search を検索する

```json
{
  "query": "国立国会図書館年報",
  "source": "ndl_search",
  "limit": 5,
  "page": 1
}
```

### 2. デジタルコレクションを検索する

```json
{
  "query": "国立国会図書館年報",
  "source": "ndl_digital",
  "limit": 5,
  "page": 1
}
```

### 3. レコード詳細を取得する

```json
{
  "source": "ndl_digital",
  "source_id": "R100000039-I1000732"
}
```

### 4. 横断検索する

```json
{
  "query": "夏目漱石",
  "limit": 10,
  "page": 1
}
```

補足:

- 横断検索は v1 では `page=1` のみ対応です。
- `page>1` は明示的にエラーになります。

## fixture について

- `tests/fixtures/ndl-search/*.json`
  - NDL Search の compatibility projection と live 応答抜粋を同居させています。
- `tests/fixtures/ndl-digital/*.json`
  - `dpid=ndl-dl` 前提の compatibility projection と live 応答抜粋を同居させています。
- OpenSearch XML の live parse は本体未実装なので、fixture の `_fixture.liveResponseExtract` に raw 構造の要点を残し、top-level には既存 mapper が扱う JSON-compatible 形を置いています。

## 既知の制約

- NDL Search OpenSearch XML の live parse は未実装です。
- 現在の adapter は fixture と JSON-compatible projection を前提に安定化しています。
- `ndl_digital` は独立 API 実装ではなく、現時点では `NDL Search API + dpid=ndl-dl` を使います。
- 次世代デジタルライブラリー API の本文座標・OCR 系は未実装です。
