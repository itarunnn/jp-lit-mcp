# GitHub CLI で Skills を入れる

このページは、`gh skill install` を使って `jp-lit-mcp` の Skills を入れたい人向けの別手順です。

通常は、各アプリ向け install guide にある `npx -y -p jp-lit-mcp jp-lit-mcp-install-skills <app>` をおすすめします。こちらは

- GitHub CLI で Skills をまとめて管理したい
- `gh skill preview` や `gh skill update` も使いたい
- GitHub 上の公開 repo から直接 Skills を入れたい

ときのための補助的な導線です。

## 前提

- `GitHub CLI` (`gh`) が必要です
- `gh skill` は public preview です
- GitHub Docs では `gh` **2.90.0 以降**が案内されています
- 先に `gh auth login` を済ませておくと確実です

参考:

- GitHub CLI manual: <https://cli.github.com/manual/gh_skill_install>
- GitHub Docs: <https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills>

## 先にやること

`gh skill install` は Skills を入れるための別ルートですが、`MCP` の登録までは行いません。

そのため、先に各アプリ向け install guide のうち次の部分は済ませてください。

1. `npx -y jp-lit-mcp` での `MCP` 登録
2. 必要なら `CINII_RESEARCH_APP_ID` の設定

Skills だけを GitHub CLI 経由に置き換えるイメージです。

## 使い方

この repo を GitHub に公開したら、基本形は `itarunnn/jp-lit-mcp` です。repo 名を変更して公開する場合だけ、その部分を読み替えてください。

### 対話的に選ぶ

```bash
gh skill install itarunnn/jp-lit-mcp
```

この形だと、repo 内の Skills を対話的に選べます。

### `jp-lit-research` を直接入れる

```bash
gh skill install itarunnn/jp-lit-mcp jp-lit-research
```

### `jp-lit-verification` を直接入れる

```bash
gh skill install itarunnn/jp-lit-mcp jp-lit-verification
```

### 中身を先に確認する

公開 repo から Skills を入れる前に、内容を確認することもできます。

```bash
gh skill preview itarunnn/jp-lit-mcp jp-lit-research
gh skill preview itarunnn/jp-lit-mcp jp-lit-verification
```

### 更新確認

```bash
gh skill update
```

特定の Skill だけ更新したい場合:

```bash
gh skill update jp-lit-research
gh skill update jp-lit-verification
```

## この repo での位置づけ

この repo では、`gh skill install` は主導線ではありません。

- 主導線:
  - 各アプリ向け install guide
  - `npx -y -p jp-lit-mcp jp-lit-mcp-install-skills <app>`
- 別ルート:
  - `gh skill install`

理由は次のとおりです。

- `gh` の追加インストールが必要
- preview 機能なので将来の仕様変更がありうる
- `MCP` の登録は別途必要

そのため、一般的には既存の install guide の方が分かりやすく、再現もしやすいです。

## 向いているケース

- GitHub CLI に慣れている
- Skills の preview / update を `gh` でまとめて扱いたい
- 公開 GitHub repo から直接 Skills を入れたい

## 向いていないケース

- `MCP` も含めて最短で導入したい
- `gh` を追加したくない
- まずは一度動かしてみたい

その場合は、各アプリ向け install guide を使ってください。
