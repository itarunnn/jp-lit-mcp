# Codex CLI で使う

このページは、`Codex CLI` を使って `ndl-jp-lit-mcp` を導入するための手順です。

## 手順

コマンド例の `J:/apps/ndl-jp-lit-mcp/` は、自分が clone した実際のパスに置き換えてください。

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

CiNii の安定利用には `CINII_RESEARCH_APP_ID` 環境変数の設定を推奨します（[CiNii API 利用登録](https://support.nii.ac.jp/ja/cinii/api/developer)）。その他の環境変数と完全な設定例は [README](../../README.md#mcp-登録例) を参照してください。

5. `Skills` をインストールします。

```bash
npm run skills:install
```

6. `Codex` をこのリポジトリで起動します。

```bash
codex
```

最初の一言は、次のどちらかがおすすめです。

```text
文献DBで、明治期の女学生の制服について、論文と図書を探してください。
```

```text
文献DBを始めます。『常陸国風土記』の調べ方を知りたいです。
```

```text
文献検証で、この文章に出てくる文献の実在性を確認してください。
```

## つまずきやすい点

- `codex mcp add` の前に `npm run build` をしていない
- パスを相対パスで書いて別ディレクトリから起動している
- `codex login` をしていない

## 最初の確認

```bash
npm run smoke:mcp
```
