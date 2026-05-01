# Codex CLI で使う

このページは、`Codex CLI` を使って `jp-lit-mcp` を導入するための手順です。

## 手順

コマンド例のパスは、自分が clone した実際のパスに置き換えてください。
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

**Windows (PowerShell)**

```powershell
codex mcp add jpLit -- node C:\path\to\jp-lit-mcp\dist\src\index.js
```

**macOS / Linux (bash / zsh)**

```bash
codex mcp add jpLit -- node /path/to/jp-lit-mcp/dist/src/index.js
```

`CINII_RESEARCH_APP_ID` を設定する場合は `--env` フラグを使います。

**Windows (PowerShell)**

```powershell
codex mcp add jpLit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- node C:\path\to\jp-lit-mcp\dist\src\index.js
```

**macOS / Linux (bash / zsh)**

```bash
codex mcp add jpLit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- node /path/to/jp-lit-mcp/dist/src/index.js
```

CiNii の安定利用には `CINII_RESEARCH_APP_ID` の設定を推奨します（[CiNii API 利用登録](https://support.nii.ac.jp/ja/cinii/api/developer)）。未設定でも動作します。NDL、J-STAGE、IRDB など他の source は追加設定なしで使えます。

補足:

- 現在の設定確認は `codex mcp list`
- 詳細確認は `codex mcp get jpLit`
- 設定ファイルで管理したい場合は `~/.codex/config.toml` も使えます

各 source の base URL を明示・上書きしたい場合は [技術リファレンス](../reference.md#環境変数) を参照してください。

5. `Skills` をインストールします。

この手順で、文献探索用の `jp-lit-research` と文献実在性確認用の `jp-lit-verification` の両方がインストールされます。

```bash
npm run skills:install -- codex
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

## 設定反映の確認

まず次で MCP server が見えているか確認します。

```bash
codex mcp list
```

必要なら詳細も確認できます。

```bash
codex mcp get jpLit
```

そのうえで、このリポジトリで `codex` を起動し、新しいセッションで次を試します。

```text
文献DBで、近代日本の労働文化について、論文と図書を探してください。
```

## つまずきやすい点と対処

- `codex mcp add` の前に `npm run build` をしていない
- パスを相対パスで書いて別ディレクトリから起動している
- `codex login` をしていない
- `codex mcp list` には出るが、古い Codex セッションを使い続けている

よくある見分け方:

- `codex mcp list` に `jpLit` が出ない
  - 登録コマンドをやり直す
- `jpLit` は出るが対話中に使われない
  - `codex` を起動し直して新しいセッションで試す
- MCP 登録はできるが実行時に失敗する
  - `npm install` と `npm run build` をやり直し、`dist/src/index.js` があるか確認する

## 最初の確認

```bash
npm run smoke:mcp
```
