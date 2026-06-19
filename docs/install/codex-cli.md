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

CiNii Research の API 利用登録で取得した `appid` を渡す場合は、環境変数 `CINII_RESEARCH_APP_ID` として設定します。Codex CLI では `--env` フラグを使います。

```bash
codex mcp add jpLit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- npx -y jp-lit-mcp
```

`CINII_RESEARCH_APP_ID` は、MCP サーバーへ渡す環境変数です。値には CiNii Research の API 利用登録で取得する `appid` を入れます。CiNii 系 source の安定利用に推奨し、KAKEN API tool では必要です。未設定でも、NDL、J-STAGE、IRDB など他の source は追加設定なしで使えます（[CiNii API 利用登録](https://support.nii.ac.jp/ja/cinii/api/developer)）。

`jp_lit_enrich_record` で OpenAlex / Crossref の照合を使う場合は、同じ MCP server の環境変数として `OPENALEX_API_KEY` と `CROSSREF_MAILTO` も渡せます。どちらも任意で、OpenAlex は未設定なら `skipped`、Crossref の `mailto` は polite pool 用の連絡先として扱います。

Codex の MCP 設定は通常 `~/.codex/config.toml` に保存され、trusted project では `.codex/config.toml` に project scoped な設定も置けます。`--env` は `npx -y jp-lit-mcp` のような stdio server に渡す環境変数です。

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

導入環境の基本チェックには `doctor` コマンドを使えます。

```bash
npx -y jp-lit-mcp doctor
```

`doctor` は Node.js、パッケージバージョン、同梱 Skills、cache / exports への書き込み、環境変数 `CINII_RESEARCH_APP_ID` の有無を確認します。外部 DB への live API チェックは行いません。

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

## カーリル図書館MCPを併用する場合

地域資料・地方人物・地方紙・地方雑誌の調査で公共図書館蔵書まで確認したい場合は、`jpLit` とは別に[カーリル図書館MCP](https://calil.jp/ai/)を Codex CLI に登録します。カーリル公式の対応表・設定ガイドには、現時点では Codex は載っていませんが、Codex CLI では Streamable HTTP MCP と OAuth を使って追加できます。初回のみブラウザでカーリルにログインし、OAuth 認可が必要です。認可後は通常、新しい Codex セッションで再利用されます。

```bash
codex mcp add calil --url https://mcp-beta.calil.jp/mcp
codex mcp login calil
codex mcp get calil
```

環境によっては `~/.codex/config.toml` で OAuth resource や callback を明示する必要があります。手で書く場合は、`oauth_resource` は `calil` server の設定に置き、callback 設定は top-level に置きます。

```toml
mcp_oauth_callback_port = 5555

[mcp_servers.calil]
url = "https://mcp-beta.calil.jp/mcp"
oauth_resource = "https://mcp-beta.calil.jp"
```

Codex を SSH 先やコンテナ上で動かす場合は、`localhost` の指す先が手元ブラウザとずれないようにしてください。

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
