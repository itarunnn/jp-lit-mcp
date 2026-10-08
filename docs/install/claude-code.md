# Claude Code で使う

このページは、`Claude Code` で `jp-lit-mcp` を使うための手順です。通常利用では、このリポジトリを clone する必要はありません。

## 前提

- `Node.js 22` 以上と `npm` が使えること
- `Claude Code` が使えること

TEI読解にはuvとPython 3.13.15、IIIF比較画面にはWebブラウザを用意します。両機能をAIへ依頼する場合は、ローカルコマンドを実行できる環境も必要です。[機能別の必要環境と準備手順](runtime-requirements.md)を参照してください。

## 手順

1. `Claude Code` に MCP server を追加します。

```bash
claude mcp add jp-lit -- npx -y jp-lit-mcp
```

CiNii Research の公式 API 仕様では `appid` が必須です。API 利用登録で取得した値を環境変数 `CINII_RESEARCH_APP_ID` として設定します。Claude Code では `--env` を使います。

```bash
claude mcp add --env CINII_RESEARCH_APP_ID=your-cinii-app-id --transport stdio jp-lit -- npx -y jp-lit-mcp
```

`CINII_RESEARCH_APP_ID` は、MCP サーバーへ渡す環境変数です。CiNii Research の公式 API 仕様では `appid` が必須です。現在は未設定でも応答する場合がありますが、正式な利用では設定してください。未設定時も互換性のため CiNii 系 source の検索を続行し、結果に `CINII_APP_ID_REQUIRED` 警告を付けます。KAKEN API tool は未設定では実行できません。NDL、J-STAGE、IRDB など他の source は追加設定なしで使えます（[CiNii API 利用登録](https://support.nii.ac.jp/ja/cinii/api/developer)）。

`jp_lit_enrich_record` で OpenAlex / Crossref の照合を使う場合は、同じ MCP server の環境変数として `OPENALEX_API_KEY` と `CROSSREF_MAILTO` も渡せます。どちらも任意で、OpenAlex は未設定なら `skipped`、Crossref の `mailto` は polite pool 用の連絡先として扱います。

Claude Code の `--env` は複数の `KEY=value` を受け取れるため、上の例では server name の前に `--transport stdio` を明示しています。

補足:

- 既定の `local` scope は、現在の project だけで自分に有効な private 設定です。MCP server の local 設定は `~/.claude.json` に project ごとの情報として保存されます
- どの project でも自分だけで使いたい場合は `--scope user` を付けます
- チームで共有したい場合は `--scope project` を付けると、リポジトリ直下に `.mcp.json` が作られます
- 現在の設定確認は `claude mcp list`、個別確認は `claude mcp get jp-lit` でできます

2. `Skills` をインストールします。

この手順で、文献探索用の `jp-lit-research`、文献実在性確認用の `jp-lit-verification`、TEI構造読解用の `jp-lit-tei`、IIIF資料比較・画像読解用の `jp-lit-iiif`が個人用の `~/.claude/skills/` に入ります。個別に編集した同名Skillsは、導入・更新の前に編集内容を退避してください。IIIFの起動と読解は[IIIFガイド](../iiif-workbench.md)を参照してください。

Skillsの導入・更新には、次のどちらか一方を選びます。GitHub CLIを既に使っている人や、取得元・版・更新を管理したい人にはGitHub経由をおすすめします。利用には `gh 2.90.0` 以上が必要で、`gh skill`はpublic previewです。版固定と更新手順は[GitHub Skillsガイド](github-skills.md)を参照してください。

```bash
gh skill install itarunnn/jp-lit-mcp --all --agent claude-code --scope user
```

追加ツールを減らしたい人や、npm同梱版を使いたい人には次のコマンドをおすすめします。npm経由の更新もこのコマンドで行います。既存の同名Skillsは置き換わるため、GitHub経由で管理するSkillsへの重ねての実行は避けてください。

```bash
npx -y jp-lit-mcp install-skills claude
```

TEIを読む場合は、[readerの環境を準備する](runtime-requirements.md#tei-readerの環境を準備する)手順でPythonを導入し、readerのヘルプが表示されることを確認します。Skillsの配置と実行環境の準備を済ませてから、アプリを開き直します。

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
claude mcp get jp-lit
```

導入環境の基本チェックには `doctor` コマンドを使えます。

```bash
npx -y jp-lit-mcp doctor
```

`doctor` は Node.js、パッケージバージョン、同梱 Skills、cache / exports への書き込み、環境変数 `CINII_RESEARCH_APP_ID` の有無を確認します。外部 DB への live API チェックは行いません。

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
  - 手順2で選んだ導入方法と `~/.claude/skills/` の配置を確認してください。導入し直す場合も同じ方法を使います

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
