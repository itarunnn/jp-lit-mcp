# Codex App で使う

このページは、`Codex App` で `jp-lit-mcp` を導入するための手順です。MCP の追加は `Codex App` の設定画面だけでもできます。CLI から追加する方法も、再現性が高く、設定確認やトラブルシュートがしやすい代替ルートとして併記します。通常利用では、このリポジトリを clone する必要はありません。

## 前提

- `Node.js 22` 以上と `npm` が使えること
- `Codex App` が起動できること

基本の文献検索・書誌確認・文献検証は、この環境で使えます。TEI・IIIFは任意機能で、Pythonを入れなくても基本機能を利用できます。追加環境は、下の「任意でTEI・IIIFを使う」で案内します。

CLI ルートを使う場合だけ、`Codex CLI` にログイン済みであることも必要です。`Codex CLI` が未導入なら、先に入れてログインします。

```bash
npm install -g @openai/codex
codex login
```

## 手順

1. `MCP` を追加します。

`Codex App` 単体で追加する場合は、`Settings` から `Integrations & MCP` を開き、custom MCP server として次の stdio server を追加します。

| 項目 | 値 |
| --- | --- |
| 名前 | `jpLit` |
| command | `npx` |
| args | `-y jp-lit-mcp` |

CiNii Research の公式 API 仕様では `appid` が必須です。API 利用登録で取得した値を、同じ MCP server の環境変数 `CINII_RESEARCH_APP_ID` として設定します。`jp_lit_enrich_record` で OpenAlex / Crossref の照合を使う場合は、`OPENALEX_API_KEY` と `CROSSREF_MAILTO` も同じ場所に追加できます。どれも実値は Git 管理しないでください。

CLI から追加する場合は次のコマンドを使います。

```bash
codex mcp add jpLit -- npx -y jp-lit-mcp
```

CLI から `CINII_RESEARCH_APP_ID` を渡す場合は `--env` フラグを使います。

```bash
codex mcp add jpLit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- npx -y jp-lit-mcp
```

`CINII_RESEARCH_APP_ID` は、MCP サーバーへ渡す環境変数です。CiNii Research の公式 API 仕様では `appid` が必須です。現在は未設定でも応答する場合がありますが、正式な利用では設定してください。未設定時も互換性のため CiNii 系 source の検索を続行し、結果に `CINII_APP_ID_REQUIRED` 警告を付けます。KAKEN API tool は未設定では実行できません。NDL、J-STAGE、IRDB など他の source は追加設定なしで使えます（[CiNii API 利用登録](https://support.nii.ac.jp/ja/cinii/api/developer)）。

`jp_lit_enrich_record` で OpenAlex / Crossref の照合を使う場合は、同じ MCP server の環境変数として `OPENALEX_API_KEY` と `CROSSREF_MAILTO` も渡せます。どちらも任意で、OpenAlex は未設定なら `skipped`、Crossref の `mailto` は polite pool 用の連絡先として扱います。

Codex の MCP 設定は通常 `~/.codex/config.toml` に保存され、Codex CLI / IDE extension / Codex App で共有されます。App 設定画面から追加しても CLI から追加しても、最終的には同じ Codex 設定として扱われます。`--env` は `npx -y jp-lit-mcp` のような stdio server に渡す環境変数です。

2. `Skills` をインストールします。

この手順で、文献探索用の `jp-lit-research`、文献実在性確認用の `jp-lit-verification`、TEI構造読解用の `jp-lit-tei`、IIIF資料比較・画像読解用の `jp-lit-iiif`が `~/.agents/skills/` に入ります。個別に編集した同名Skillsは、導入・更新の前に編集内容を退避してください。IIIFの起動と読解は[IIIFガイド](../iiif-workbench.md)を参照してください。

Skillsの導入・更新には、次のどちらか一方を選びます。GitHub CLIを既に使っている人や、取得元・版・更新を管理したい人にはGitHub経由をおすすめします。利用には `gh 2.90.0` 以上が必要で、`gh skill`はpublic previewです。Codex AppとCLIには共通の `~/.agents/skills/` を明示します。ghの版による既定配置先の違い、版固定と更新手順は[GitHub Skillsガイド](github-skills.md)を参照してください。

```bash
gh skill install itarunnn/jp-lit-mcp --all --dir "$HOME/.agents/skills"
```

追加ツールを減らしたい人や、npm同梱版を使いたい人には次のコマンドをおすすめします。npm経由の更新もこのコマンドで行います。既存の同名Skillsは置き換わるため、GitHub経由で管理するSkillsへの重ねての実行は避けてください。

```bash
npx -y jp-lit-mcp install-skills codex
```

GitHub経由の`--all`と、npm経由の`install-skills codex`は、どちらもTEI・IIIFを含む全4Skillsを配置します。全4Skillsを入れた状態で、基本機能だけを使えます。SkillsはAIへの手順書で、PythonやOCRエンジンの導入は別の準備です。

### 任意でTEI・IIIFを使う

基本機能の導入はここまでです。次の手順3でアプリを開き直し、文献調査を始められます。TEI・IIIFも使う場合は、必要なものだけを追加してください。

- **TEI読解**: [uvを導入してreaderを起動](runtime-requirements.md#tei-readerの環境を準備する)します。指定Python 3.13.15と専用環境は初回起動時に自動準備されます。Pythonだけを入れた場合はuvも必要です。
- **IIIF比較・領域選択・出典保存**: [同梱CLIの起動を確認](runtime-requirements.md#iiif比較画面を準備する)し、ブラウザで使います。Pythonの追加は不要です。
- **図版の類似検索・整列・差分、くずし字OCR**: [追加環境の準備](runtime-requirements.md#図版解析とくずし字ocrを追加する)へ進みます。図版解析は初回セットアップ、OCRはエンジン・モデルの別途導入が必要です。

Pythonの自動取得には初回のネット接続とuvのダウンロード許可が必要です。AIからTEI・IIIFを操作するにはローカルコマンドの実行、画像を読むには画像読解に対応した環境を使います。uvを追加した後も、アプリを開き直してください。

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

## カーリル図書館MCPを併用する場合

地域資料・地方人物・地方紙・地方雑誌の調査で公共図書館蔵書まで確認したい場合は、`jpLit` とは別に[カーリル図書館MCP](https://calil.jp/ai/)を追加します。`Codex App` の `Integrations & MCP` から custom Streamable HTTP server として追加する場合は、URL に `https://mcp-beta.calil.jp/mcp` を指定します。OAuth が必要な場合は App 側で認可フローが始まります。認可後は通常、新しい Codex App の対話で再利用されます。

CLI から追加する場合は次のコマンドを使います。カーリル公式の対応表・設定ガイドには、現時点では Codex は載っていませんが、Codex CLI では Streamable HTTP MCP と OAuth を使って追加できます。初回のみブラウザでカーリルにログインし、OAuth 認可が必要です。

```bash
codex mcp add calil --url https://mcp-beta.calil.jp/mcp
codex mcp login calil
codex mcp get calil
```

設定後は `Codex App` を開き直し、新しい対話で確認してください。環境によっては `~/.codex/config.toml` で OAuth resource や callback を明示する必要があります。手で書く場合は、`oauth_resource` は `calil` server の設定に置き、callback 設定は top-level に置きます。

```toml
mcp_oauth_callback_port = 5555

[mcp_servers.calil]
url = "https://mcp-beta.calil.jp/mcp"
oauth_resource = "https://mcp-beta.calil.jp"
```

## 設定反映の確認

CLI ルートを使った場合は、CLI 側で MCP 登録を確認します。

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
  - CLI 側で追加した場合は登録ができていません。`codex mcp add jpLit -- npx -y jp-lit-mcp` をやり直してください
  - App 設定画面から追加した場合は、`Settings` の `Integrations & MCP` で `jpLit` が有効になっているか確認してください
- `jpLit` は出るが App で使えない
  - `Codex App` を開き直して新しい対話を作ってください
- KAKEN で `KAKEN API requires CINII_RESEARCH_APP_ID.` が出る
  - `CINII_RESEARCH_APP_ID` がユーザー環境変数にあっても、起動済みの `Codex App` や MCP 子プロセスに渡っていない場合があります。`Codex App` を開き直して新しい対話を作るか、`codex mcp add jpLit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- npx -y jp-lit-mcp` で MCP 設定に明示してください。
  - 既存設定を手で直す場合は、利用者の `~/.codex/config.toml` にある登録名に合わせて `[mcp_servers.<登録名>.env]` を追加し、`CINII_RESEARCH_APP_ID = "your-cinii-app-id"` を置きます。実値は Git 管理しないでください。
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
