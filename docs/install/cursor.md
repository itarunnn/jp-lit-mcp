# Cursor で使う

このページは、`Cursor` で `ndl-jp-lit-mcp` を使うための手順です。

## 先に知っておくこと

- `Cursor` では、このリポジトリ内の `.cursor/skills/jp-lit-research/` と `.cursor/skills/jp-lit-verification/` が自動検出されます
- そのため `Skills` の追加インストールは不要です
- `MCP` は通常 `.cursor/mcp.json` に追加します
- パスは、自分が clone した実際のパスに置き換えてください
- どのプロジェクトでも使いたい場合は `~/.cursor/mcp.json` に書く方法もあります

## 手順

1. このリポジトリを clone して開きます。
2. ターミナルで次を実行します。

```bash
npm install
npm run build
```

3. プロジェクトルートに `.cursor/mcp.json` が無ければ作り、次を追加します。

**Windows**

```json
{
  "mcpServers": {
    "ndl-jp-lit": {
      "command": "node",
      "args": ["C:\\path\\to\\ndl-jp-lit-mcp\\dist\\src\\index.js"],
      "cwd": "C:\\path\\to\\ndl-jp-lit-mcp",
      "env": {
        "CINII_RESEARCH_APP_ID": "your-cinii-app-id"
      }
    }
  }
}
```

**macOS / Linux**

```json
{
  "mcpServers": {
    "ndl-jp-lit": {
      "command": "node",
      "args": ["/path/to/ndl-jp-lit-mcp/dist/src/index.js"],
      "cwd": "/path/to/ndl-jp-lit-mcp",
      "env": {
        "CINII_RESEARCH_APP_ID": "your-cinii-app-id"
      }
    }
  }
}
```

`CINII_RESEARCH_APP_ID` は CiNii の安定利用に推奨します。その他の環境変数と完全な設定例は [README](../../README.md#mcp-登録例) を参照してください。

補足:

- この設定は Cursor の project configuration です
- グローバルに使いたい場合は `~/.cursor/mcp.json` に同様の形式で書けます
- editor と `cursor-agent` CLI は同じ MCP 設定を使います

4. `Cursor` を再読込して、このリポジトリで対話を始めます。

最初の一言は、次のどちらかがおすすめです。

```text
文献DBで、近代日本の労働文化について、論文と図書を探してください。
```

```text
文献DBを始めます。『源氏物語』について調査を始めたいです。最初に見るべき資料と、使うべき DB を教えてください。
```

```text
文献検証で、この文章に出てくる文献の実在性を確認してください。
```

## つまずきやすい点

- `dist/src/index.js` ではなく TypeScript の source を指定している
- `cwd` を設定していない
- `.cursor/skills/` を別の場所へ移してしまっている
- `.cursor/mcp.json` ではなく別の JSON に書いている

## 最初の確認

```bash
npm run smoke:mcp
```
