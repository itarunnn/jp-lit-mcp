# Codex CLI で使う

このページは、`Codex CLI` を使って `ndl-jp-lit-mcp` を導入するための手順です。

## 手順

コマンド例の `/path/to/ndl-jp-lit-mcp/` は、自分が clone した実際のパスに置き換えてください。
Codex では、MCP 設定は `codex mcp add` で追加するのが基本です。必要なら `~/.codex/config.toml` を直接編集することもできます。

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
codex mcp add ndlJpLit -- node /path/to/ndl-jp-lit-mcp/dist/src/index.js
```

`CINII_RESEARCH_APP_ID` を設定する場合は `--env` フラグを使います。

```bash
codex mcp add ndlJpLit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- node /path/to/ndl-jp-lit-mcp/dist/src/index.js
```

CiNii の安定利用には `CINII_RESEARCH_APP_ID` の設定を推奨します（[CiNii API 利用登録](https://support.nii.ac.jp/ja/cinii/api/developer)）。未設定でも動作します。

補足:

- 現在の設定確認は `codex mcp list`
- 詳細確認は `codex mcp get ndlJpLit`
- 設定ファイルで管理したい場合は `~/.codex/config.toml` も使えます

その他の環境変数と完全な設定例は [README](../../README.md#mcp-登録例) を参照してください。

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
文献DBで、近代日本の労働文化について、論文と図書を探してください。
```

```text
文献DBを始めます。『源氏物語』について調査を始めたいです。最初に見るべき資料と、使うべき DB を教えてください。
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
