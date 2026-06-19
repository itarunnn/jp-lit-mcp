# GitHub CLI で Skills を入れる

`gh skill install` は public preview の二次導線です。利用には `GitHub CLI` (`gh`) **2.90.0 以降**が必要です。このページは `gh 2.94.0` で動作確認しています。

通常は、各アプリ向け install guide にある `npx -y jp-lit-mcp install-skills <app>` をおすすめします。このページの `gh skill install` ルートは、

- GitHub CLI で Skills をまとめて管理したい
- `gh skill preview` や `gh skill update` も使いたい
- GitHub 上の公開 repo から直接 Skills を入れたい

ときのための補助的な導線です。

## 前提

- `GitHub CLI` (`gh`) **2.90.0 以降**が必要です
- `gh skill` は public preview です
- `gh skills` は `gh skill` の alias として使えます
- GitHub Docs では `gh` **2.90.0 以降**が案内されています
- `gh skill --help` が `unknown command "skill"` になる場合は、GitHub CLI を 2.90.0 以降へ更新してください
- 先に `gh auth login` を済ませておくと確実です

参考:

- GitHub CLI manual: <https://cli.github.com/manual/gh_skill_install>
- GitHub Docs: <https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills>

## 先にやること

`gh skill install` は Skills を入れるための別ルートですが、`MCP` の登録までは行いません。

そのため、先に各アプリ向け install guide のうち次の部分は済ませてください。

1. `npx -y jp-lit-mcp` での `MCP` 登録
2. 必要なら環境変数 `CINII_RESEARCH_APP_ID` の設定

Skills だけを GitHub CLI 経由に置き換えるイメージです。`gh skill install` は target agent と install scope を指定できます。通常利用では、使うアプリに合わせて `--agent codex` / `--agent claude-code` / `--agent cursor` を明示し、個人用に入れるなら `--scope user` を付けるのが安全です。`--scope project` は現在の git repository 側へ入れる上級者向けの使い方です。

`gh skill install` で version を指定しない場合、GitHub CLI は次の順で install 元を解決します。

1. repository の最新タグ付き release
2. default branch の HEAD

そのため、この repo で `main` に変更を push しただけでは、`gh skill install itarunnn/jp-lit-mcp ...` がすぐ最新 `main` を読むとは限りません。通常利用では release 済みの安定版を入れる前提にし、公開直後の `main` を確認したい場合だけ `jp-lit-research@main` のように version を明示してください。再現性を固定したい場合は、`jp-lit-research@v0.7.6` のようにタグを付けるか、`--pin v0.7.6` を使います。

## 使い方

この repo を GitHub に公開したら、基本形は `itarunnn/jp-lit-mcp` です。repo 名を変更して公開する場合だけ、その部分を読み替えてください。

### agent / scope を指定してまとめて入れる

```bash
gh skill install itarunnn/jp-lit-mcp --all --agent codex --scope user
gh skill install itarunnn/jp-lit-mcp --all --agent cursor --scope user
gh skill install itarunnn/jp-lit-mcp --all --agent claude-code --scope user
```

使う agent に合わせて 1 行だけ実行します。

### 対話的に選ぶ

```bash
gh skill install itarunnn/jp-lit-mcp --agent codex --scope user
```

この形だと、repo 内の Skills を対話的に選べます。

### 個別の Skill を入れる

```bash
gh skill install itarunnn/jp-lit-mcp jp-lit-research --agent codex --scope user
gh skill install itarunnn/jp-lit-mcp jp-lit-verification --agent codex --scope user
```

ここでは Codex の user scope に入れる例を示しています。Cursor や Claude Code に入れる場合は `--agent` を読み替えてください。

### version を明示して入れる

最新 release ではなく特定の version を入れたい場合は、Skill 名に `@VERSION` を付けます。

```bash
gh skill install itarunnn/jp-lit-mcp jp-lit-research@v0.7.6 --agent codex --scope user
gh skill install itarunnn/jp-lit-mcp jp-lit-verification@v0.7.6 --agent codex --scope user
```

開発中の default branch を一時的に確認したい場合は `@main` も使えます。ただし、通常利用では release tag をおすすめします。

### 中身を先に確認する

公開 repo から Skills を入れる前に、内容を確認することもできます。

```bash
gh skill preview itarunnn/jp-lit-mcp jp-lit-research
gh skill preview itarunnn/jp-lit-mcp jp-lit-verification
```

`preview` は内容確認用のコマンドです。インストール先の agent / scope を指定するのは `install` 側です。

version を指定して表示することもできます。

```bash
gh skill preview itarunnn/jp-lit-mcp jp-lit-research@main
gh skill preview itarunnn/jp-lit-mcp jp-lit-research@v0.7.6
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

変更内容を適用せずに確認したい場合:

```bash
gh skill update --dry-run
```

## この repo での位置づけ

この repo では、`gh skill install` は主導線ではありません。

- 主導線:
  - 各アプリ向け install guide
  - `npx -y jp-lit-mcp install-skills <app>`
- 別ルート:
  - `gh skill install`

理由は次のとおりです。

- `gh` の追加インストールが必要
- `gh skill` 自体が public preview 段階なので将来の仕様変更がありうる
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
