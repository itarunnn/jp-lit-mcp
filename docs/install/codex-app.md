# Codex App で使う

このページは、`Codex App` で `jp-lit-mcp` を導入するための手順です。MCP の追加は `Codex CLI` から行うと再現しやすいため、このガイドでも CLI を使います。通常利用では、このリポジトリを clone する必要はありません。

## 前提

- `Node.js 18` 以上と `npm` が使えること
- `Codex App` が起動できること
- `Codex CLI` にログイン済みであること

`Codex CLI` が未導入なら、先に入れてログインします。

```bash
npm install -g @openai/codex
codex login
```

## 手順

1. `MCP` を `Codex CLI` から追加します。

```bash
codex mcp add jpLit -- npx -y jp-lit-mcp
```

CiNii Research の API 利用登録で取得した `appid` を渡す場合は、環境変数 `CINII_RESEARCH_APP_ID` として設定します。Codex CLI から追加する場合は `--env` フラグを使います。

```bash
codex mcp add jpLit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- npx -y jp-lit-mcp
```

`CINII_RESEARCH_APP_ID` は、MCP サーバーへ渡す環境変数です。値には CiNii Research の API 利用登録で取得する `appid` を入れます。CiNii 系 source の安定利用に推奨し、KAKEN API tool では必要です。未設定でも、NDL、J-STAGE、IRDB など他の source は追加設定なしで使えます（[CiNii API 利用登録](https://support.nii.ac.jp/ja/cinii/api/developer)）。

2. `Skills` をインストールします。

この手順で、文献探索用の `jp-lit-research` と文献実在性確認用の `jp-lit-verification` の両方が `~/.agents/skills/` に入ります。

```bash
npx -y jp-lit-mcp install-skills codex
```

3. `Codex App` を開き直し、新しい対話で文献調査を依頼します。

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
codex mcp get jpLit
```

そのうえで `Codex App` を開き直し、新しい対話を始めます。

導入環境の基本チェックには `doctor` コマンドを使えます。

```bash
npx -y jp-lit-mcp doctor
```

`doctor` は Node.js、パッケージバージョン、同梱 Skills、cache / exports への書き込み、環境変数 `CINII_RESEARCH_APP_ID` の有無を確認します。外部 DB への live API チェックは行いません。

## つまずきやすい点と対処

- `codex mcp list` に `jpLit` が出ない
  - CLI 側の登録ができていません。`codex mcp add jpLit -- npx -y jp-lit-mcp` をやり直してください
- `jpLit` は出るが App で使えない
  - `Codex App` を開き直して新しい対話を作ってください
- Skill だけ動いて MCP が使えない
  - `codex mcp get jpLit` で `npx -y jp-lit-mcp` が登録されているか確認してください

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
