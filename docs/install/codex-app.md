# Codex App で使う

このページは、`Codex App` を使って `ndl-jp-lit-mcp` を導入するための手順です。

## 先に知っておくこと

- `Codex App` では `Skills` を既定で使う前提にします
- `MCP` の追加は `Codex CLI` 側で行うのがいちばん確実です
- 一度設定すれば、同じ `Codex` 環境の中で共有して使えます
- コマンド例の `J:/apps/ndl-jp-lit-mcp/` は、自分が clone した実際のパスに置き換えてください

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

```bash
codex mcp add ndlJpLit -- node J:/apps/ndl-jp-lit-mcp/dist/src/index.js
```

`CINII_RESEARCH_APP_ID` を設定する場合は `--env` フラグを使います。

```bash
codex mcp add ndlJpLit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- node J:/apps/ndl-jp-lit-mcp/dist/src/index.js
```

CiNii の安定利用には `CINII_RESEARCH_APP_ID` の設定を推奨します（[CiNii API 利用登録](https://support.nii.ac.jp/ja/cinii/api/developer)）。未設定でも動作します。その他の環境変数と完全な設定例は [README](../../README.md#mcp-登録例) を参照してください。

6. `Skills` は次でインストールできます。

```bash
npm run skills:install
```

7. `Codex App` でこのリポジトリを開き、文献調査を依頼します。

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

- `npm run build` を実行する前に `MCP` を登録している
- `dist/src/index.js` ではなく `src/index.ts` を指定している
- `Skills` を入れていないのに、Skill 前提の使い方を期待している

## 最初の確認

```bash
npm run smoke:mcp
```

これが通れば、ローカル設定は概ね正しくできています。
