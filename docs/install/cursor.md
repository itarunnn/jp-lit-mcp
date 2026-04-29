# Cursor で使う

このページは、`Cursor` で `ndl-jp-lit-mcp` を使うための手順です。

## 先に知っておくこと

- `Cursor` では、このリポジトリ内の `.cursor/skills/jp-lit-research/` が自動検出されます
- そのため `Skills` の追加インストールは不要です
- `MCP` は `Cursor` 側の設定に追加します
- 設定例の `J:\\apps\\ndl-jp-lit-mcp\\` は、自分が clone した実際のパスに置き換えてください

## 手順

1. このリポジトリを clone して開きます。
2. ターミナルで次を実行します。

```bash
npm install
npm run build
```

3. `Cursor` の `MCP` 設定に次を追加します。

```json
{
  "mcpServers": {
    "ndl-jp-lit": {
      "command": "node",
      "args": ["J:\\apps\\ndl-jp-lit-mcp\\dist\\src\\index.js"],
      "cwd": "J:\\apps\\ndl-jp-lit-mcp",
      "env": {
        "CINII_RESEARCH_APP_ID": "your-cinii-app-id"
      }
    }
  }
}
```

`CINII_RESEARCH_APP_ID` は CiNii の安定利用に推奨します。その他の環境変数と完全な設定例は [README](../../README.md#mcp-登録例) を参照してください。

4. `Cursor` を再読込して、このリポジトリで対話を始めます。

## つまずきやすい点

- `dist/src/index.js` ではなく TypeScript の source を指定している
- `cwd` を設定していない
- `.cursor/skills/` を別の場所へ移してしまっている

## 最初の確認

```bash
npm run smoke:mcp
```
