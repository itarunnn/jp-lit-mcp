# Claude Code で使う

このページは、`Claude Code` で `ndl-jp-lit-mcp` を使うための手順です。

## 手順

1. このリポジトリを clone します。
2. ターミナルで次を実行します。

```bash
npm install
npm run build
```

3. `Claude Code` の `MCP` 設定に server を追加します。

```json
{
  "mcpServers": {
    "ndl-jp-lit": {
      "command": "node",
      "args": ["J:\\apps\\ndl-jp-lit-mcp\\dist\\src\\index.js"],
      "cwd": "J:\\apps\\ndl-jp-lit-mcp"
    }
  }
}
```

4. `Skills` をインストールします。

**Windows (PowerShell)**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-skills.ps1 -Platform claude
```

**macOS / Linux**

```bash
bash scripts/install-skills.sh claude
```

5. `Claude Code` を再起動して、このリポジトリで対話を始めます。

## つまずきやすい点

- `Skills` をインストールしたあとに `Claude Code` を再起動していない
- `dist/src/index.js` を作る前に MCP 設定だけしている
- Windows で `ExecutionPolicy` に止められている

## 最初の確認

```bash
npm run smoke:mcp
```
