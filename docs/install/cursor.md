# Cursor で使う

このページは、`Cursor` で `jp-lit-mcp` を使うための手順です。通常利用では、このリポジトリを clone する必要はありません。

## 前提

- `Node.js 22` 以上と `npm` が使えること
- `Cursor` が起動できること

TEI読解にはuvとPython 3.13.15、IIIF比較画面にはWebブラウザを用意します。両機能をAIへ依頼する場合は、ローカルコマンドを実行できる環境も必要です。[機能別の必要環境と準備手順](runtime-requirements.md)を参照してください。

## 手順

1. プロジェクトルートに `.cursor/mcp.json` が無ければ作り、次を追加します。

```json
{
  "mcpServers": {
    "jp-lit": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "jp-lit-mcp"],
      "env": {
        "CINII_RESEARCH_APP_ID": "your-cinii-app-id"
      }
    }
  }
}
```

`CINII_RESEARCH_APP_ID` は、MCP サーバーへ渡す環境変数です。CiNii Research の公式 API 仕様では `appid` が必須です。現在は未設定でも応答する場合がありますが、正式な利用では設定してください。未設定時も互換性のため CiNii 系 source の検索を続行し、結果に `CINII_APP_ID_REQUIRED` 警告を付けます。KAKEN API tool は未設定では実行できません。NDL、J-STAGE、IRDB など他の source は追加設定なしで使えます。

`jp_lit_enrich_record` で OpenAlex / Crossref の照合を使う場合は、同じ `mcpServers.<server>.env` に `OPENALEX_API_KEY` と `CROSSREF_MAILTO` も追加できます。どちらも任意で、OpenAlex は未設定なら `skipped`、Crossref の `mailto` は polite pool 用の連絡先として扱います。

実値を JSON に直書きしたくない場合は、Cursor の config interpolation を使って `"CINII_RESEARCH_APP_ID": "${env:CINII_RESEARCH_APP_ID}"` と書き、OS / shell 側の環境変数から渡すこともできます。

補足:

- `.cursor/mcp.json` は Cursor の project configuration です
- グローバルに使いたい場合は `~/.cursor/mcp.json` に同様の形式で書けます
- editor と `cursor-agent` CLI は同じ MCP 設定を使います

2. `Skills` をインストールします。

この手順で、文献探索用の `jp-lit-research`、文献実在性確認用の `jp-lit-verification`、TEI構造読解用の `jp-lit-tei`、IIIF資料比較・画像読解用の `jp-lit-iiif`を user-level の `~/.cursor/skills/` に配置します。個別に編集した同名Skillsは、導入・更新の前に編集内容を退避してください。IIIFの起動と読解は[IIIFガイド](../iiif-workbench.md)を参照してください。

Skillsの導入・更新には、次のどちらか一方を選びます。GitHub CLIを既に使っている人や、取得元・版・更新を管理したい人にはGitHub経由をおすすめします。利用には `gh 2.90.0` 以上が必要で、`gh skill`はpublic previewです。版固定と更新手順は[GitHub Skillsガイド](github-skills.md)を参照してください。

```bash
gh skill install itarunnn/jp-lit-mcp --all --agent cursor --scope user
```

追加ツールを減らしたい人や、npm同梱版を使いたい人には次のコマンドをおすすめします。npm経由の更新もこのコマンドで行います。既存の同名Skillsは置き換わるため、GitHub経由で管理するSkillsへの重ねての実行は避けてください。

```bash
npx -y jp-lit-mcp install-skills cursor
```

このページの両コマンドはuser-levelへの導入です。Cursorではproject-levelのSkillディレクトリも使えます。作業repository内だけで管理する場合は、GitHub Skillsガイドの `--scope project` を参照してください。

TEIを読む場合は、[readerの環境を準備する](runtime-requirements.md#tei-readerの環境を準備する)手順でPythonを導入し、readerのヘルプが表示されることを確認します。Skillsの配置と実行環境の準備を済ませてから、アプリを開き直します。

3. `Cursor` を再読込して、このリポジトリまたは調査したい作業フォルダで対話を始めます。

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

`.cursor/mcp.json` の保存内容を見直し、`type` が `stdio`、`command` が `npx`、`args` が `["-y", "jp-lit-mcp"]` になっていることを確認します。

導入環境の基本チェックには `doctor` コマンドを使えます。

```bash
npx -y jp-lit-mcp doctor
```

`doctor` は Node.js、パッケージバージョン、同梱 Skills、cache / exports への書き込み、環境変数 `CINII_RESEARCH_APP_ID` の有無を確認します。外部 DB への live API チェックは行いません。

そのうえで `Cursor` を再読込し、新しい対話で次を試します。

```text
文献DBで、近代日本の労働文化について、論文と図書を探してください。
```

## つまずきやすい点と対処

- `.cursor/mcp.json` ではなく別の JSON に書いている
- `.cursor/mcp.json` を書き換えたあとに `Cursor` を再読込していない
- 手順2で選んだ方法によるSkillsの導入が完了していない

よくある見分け方:

- 文献DBモードが起動しない
  - `~/.cursor/skills/` に `jp-lit-research`、`jp-lit-verification`、`jp-lit-tei`、`jp-lit-iiif` が入っているか確認してください
- MCP が使われない
  - `.cursor/mcp.json` の `type` / `command` / `args` が正しいか確認してください

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
