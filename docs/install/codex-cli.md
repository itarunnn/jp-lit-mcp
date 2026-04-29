# Codex CLI で使う

このページは、`Codex CLI` を使って `ndl-jp-lit-mcp` を導入するための手順です。

## 手順

1. `Codex CLI` をインストールします。

```bash
npm install -g @openai/codex
```

2. ログインします。

```bash
codex login
```

3. このリポジトリで依存関係を入れてビルドします。

```bash
npm install
npm run build
```

4. `MCP` を追加します。

```bash
codex mcp add ndlJpLit --command node --args J:/apps/ndl-jp-lit-mcp/dist/src/index.js
```

5. `Skills` をインストールします。

```bash
npm run skills:install
```

6. `Codex` をこのリポジトリで起動します。

```bash
codex
```

## つまずきやすい点

- `codex mcp add` の前に `npm run build` をしていない
- パスを相対パスで書いて別ディレクトリから起動している
- `codex login` をしていない

## 最初の確認

```bash
npm run smoke:mcp
```
