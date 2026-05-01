# Cursor で使う

このページは、`Cursor` で `jp-lit-mcp` を使うための手順です。

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
    "jp-lit": {
      "command": "node",
      "args": ["C:\\path\\to\\jp-lit-mcp\\dist\\src\\index.js"],
      "cwd": "C:\\path\\to\\jp-lit-mcp",
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
    "jp-lit": {
      "command": "node",
      "args": ["/path/to/jp-lit-mcp/dist/src/index.js"],
      "cwd": "/path/to/jp-lit-mcp",
      "env": {
        "CINII_RESEARCH_APP_ID": "your-cinii-app-id"
      }
    }
  }
}
```

`CINII_RESEARCH_APP_ID` は CiNii の安定利用に推奨します。NDL、J-STAGE、IRDB など他の source は追加設定なしで使えます。

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

## 設定反映の確認

まず `.cursor/mcp.json` の保存内容を見直し、`dist/src/index.js` と `cwd` のパスが実在することを確認します。

そのうえで `Cursor` を再読込し、このリポジトリで新しい対話を開いて次を試します。

```text
文献DBで、近代日本の労働文化について、論文と図書を探してください。
```

## つまずきやすい点と対処

- `dist/src/index.js` ではなく TypeScript の source を指定している
- `cwd` を設定していない
- `.cursor/skills/` を別の場所へ移してしまっている
- `.cursor/mcp.json` ではなく別の JSON に書いている
- `.cursor/mcp.json` を書き換えたあとに `Cursor` を再読込していない

よくある見分け方:

- 文献DBモードが起動しない
  - `.cursor/skills/jp-lit-research/` と `.cursor/skills/jp-lit-verification/` が残っているか確認する
- MCP が使われない
  - `.cursor/mcp.json` の `command` / `args` / `cwd` が正しいか確認する
- `node .../dist/src/index.js` の実行で失敗する
  - リポジトリで `npm install` と `npm run build` をやり直す

## 最初の確認

```bash
npm run smoke:mcp
```
