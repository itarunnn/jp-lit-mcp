# Claude Code で使う

このページは、`Claude Code` で `jp-lit-mcp` を使うための手順です。通常利用では、このリポジトリを clone する必要はありません。

## 前提

- `Node.js 18` 以上と `npm` が使えること
- `Claude Code` が使えること

## 手順

1. `Claude Code` に MCP server を追加します。

```bash
claude mcp add jp-lit -- npx -y jp-lit-mcp
```

`CINII_RESEARCH_APP_ID` を設定する場合は `--env` を使います。

```bash
claude mcp add jp-lit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- npx -y jp-lit-mcp
```

`CINII_RESEARCH_APP_ID` は CiNii の安定利用に推奨します。未設定でも動作しますが、公式仕様では `appid` が必要なため、継続利用では設定してください（[CiNii API 利用登録](https://support.nii.ac.jp/ja/cinii/api/developer)）。NDL、J-STAGE、IRDB など他の source は追加設定なしで使えます。

補足:

- 既定の `local` scope では、ユーザー設定として `~/.claude.json` に保存されます
- チームで共有したい場合は `--scope project` を付けると、リポジトリ直下に `.mcp.json` が作られます
- 現在の設定確認は `claude mcp list` でできます

2. `Skills` をインストールします。

この手順で、文献探索用の `jp-lit-research` と文献実在性確認用の `jp-lit-verification` の両方が Claude Code の Skills ディレクトリに入ります。

```bash
npx -y jp-lit-mcp install-skills claude
```

3. `Claude Code` を再起動するか、新しいセッションを開いて文献調査を依頼します。

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
claude mcp list
```

`jp-lit` が表示されれば、登録自体は成功しています。そのうえで、新しいセッションを開いて次を試します。

```text
文献DBで、近代日本の労働文化について、論文と図書を探してください。
```

## つまずきやすい点と対処

- `Skills` をインストールしたあとに `Claude Code` を再起動していない
- `claude mcp list` で server が見えていない
- `claude mcp add ...` で登録したあとも古いセッションを開きっぱなしにしている

よくある見分け方:

- `claude mcp list` に `jp-lit` が出ない
  - 登録コマンドをやり直してください
- `jp-lit` は出るが、対話で反応しない
  - 新しいセッションを開くか、Claude Code を再起動してください
- 文献DBモードが起動しない
  - `npx -y jp-lit-mcp install-skills claude` を実行してください

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
