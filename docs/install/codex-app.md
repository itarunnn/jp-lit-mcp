# Codex App で使う

このページは、`Codex App` を使って `jp-lit-mcp` を導入するための手順です。

## 先に知っておくこと

- `Codex App` では `Skills` を既定で使う前提にします
- このガイドでは、`MCP` の追加は `Codex CLI` 側で行う方法を案内します
- `Codex App` 単体の UI より、CLI から設定した方が再現しやすく確認もしやすいためです
- コマンド例のパスは、自分が clone した実際のパスに置き換えてください

## 前提

- `Node.js` と `npm` が使えること
- `Codex App` が起動できること
- このリポジトリをローカルに clone してあること

## 手順

1. `Codex App` をインストールして、ChatGPT アカウントでログインします。
2. このリポジトリを開きます。
3. ターミナルで次を実行します。

```bash
npm install
npm run build
```

4. `Codex CLI` が未導入なら先に入れます。

```bash
npm install -g @openai/codex
codex login
```

5. `MCP` を `Codex CLI` から追加します。

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

設定確認:

```bash
codex mcp list
```

各 source の base URL を明示・上書きしたい場合は [技術リファレンス](../reference.md#環境変数) を参照してください。

6. `Skills` は次でインストールできます。

この手順で、文献探索用の `jp-lit-research` と文献実在性確認用の `jp-lit-verification` の両方がインストールされます。
Codex 用の Skills は `~/.agents/skills/` に入ります。

```bash
npm run skills:install -- codex
```

7. `Codex App` でこのリポジトリを開き、文献調査を依頼します。

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

まず CLI 側で MCP 登録を確認します。

```bash
codex mcp list
```

必要なら詳細も確認できます。

```bash
codex mcp get jpLit
```

そのうえで `Codex App` を開き直し、このリポジトリで新しい対話を始めます。

```text
文献DBで、近代日本の労働文化について、論文と図書を探してください。
```

## つまずきやすい点と対処

- `npm run build` を実行する前に `MCP` を登録している
- `dist/src/index.js` ではなく `src/index.ts` を指定している
- `Skills` を入れていないのに、Skill 前提の使い方を期待している
- `codex mcp list` では見えるが、`Codex App` を開き直していない

よくある見分け方:

- `codex mcp list` に `jpLit` が出ない
  - CLI 側の登録ができていない
- `jpLit` は出るが App で使えない
  - `Codex App` を開き直して新しい対話を作る
- Skill だけ動いて MCP が使えない
  - `npm run build` 済みか、MCP 登録先パスが `dist/src/index.js` かを確認する

## 最初の確認

```bash
npm run smoke:mcp
```

これが通れば、ローカル設定は概ね正しくできています。
