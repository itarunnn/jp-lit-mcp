# Codex CLI で使う

このページは、`Codex CLI` で `jp-lit-mcp` を導入するための手順です。通常利用では、このリポジトリを clone する必要はありません。

## 前提

- `Node.js 18` 以上と `npm` が使えること
- `Codex CLI` にログイン済みであること

`Codex CLI` が未導入なら、先に入れてログインします。

```bash
npm install -g @openai/codex
codex login
```

## 手順

1. `MCP` を追加します。

```bash
codex mcp add jpLit -- npx -y jp-lit-mcp
```

`CINII_RESEARCH_APP_ID` を設定する場合は `--env` フラグを使います。

```bash
codex mcp add jpLit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- npx -y jp-lit-mcp
```

CiNii の安定利用には `CINII_RESEARCH_APP_ID` の設定を推奨します（[CiNii API 利用登録](https://support.nii.ac.jp/ja/cinii/api/developer)）。未設定でも動作します。NDL、J-STAGE、IRDB など他の source は追加設定なしで使えます。

2. `Skills` をインストールします。

この手順で、文献探索用の `jp-lit-research` と文献実在性確認用の `jp-lit-verification` の両方が `~/.agents/skills/` に入ります。

```bash
npx -y jp-lit-mcp install-skills codex
```

3. 設定を確認します。

```bash
codex mcp list
codex mcp get jpLit
```

4. `Codex` を起動し、新しいセッションで文献調査を依頼します。

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

## つまずきやすい点と対処

- `codex mcp list` に `jpLit` が出ない
  - `codex mcp add jpLit -- npx -y jp-lit-mcp` をやり直してください
- `jpLit` は出るが対話中に使われない
  - `codex` を起動し直して新しいセッションで試してください
- 文献DBモードが起動しない
  - `npx -y jp-lit-mcp install-skills codex` を実行し、`~/.agents/skills/` を確認してください

各 source の base URL を明示・上書きしたい場合は [技術リファレンス](../reference.md#環境変数) を参照してください。

## 開発者向け

source 追加や修正をしたい場合は、このリポジトリを clone して開発します。

```bash
git clone https://github.com/itarunnn/jp-lit-mcp.git
cd jp-lit-mcp
npm install
npm run build
npm run smoke:mcp
```
