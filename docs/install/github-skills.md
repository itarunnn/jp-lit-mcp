# GitHub CLI で Skills を入れる

`gh skill install` は、このrepoのSkillsをGitHubから導入し、取得元・版・更新を管理する方法です。GitHub CLIを既に使っている人や、Skillsの継続的な更新を管理したい人におすすめします。このページは `gh 2.94.0` で、公開release v0.17.0から4 Skillsの取得を確認しています。

## 導入方法を選ぶ

SkillsはGitHub CLIとnpmのどちらからも導入できます。使うアプリごとに、次のどちらか一方を選んでください。

| 重視すること | おすすめの方法 | 導入後の更新 |
| --- | --- | --- |
| GitHub CLIを活用する、取得元・版を記録する、内容と更新を確認する | このページの `gh skill install` | `gh skill update`で更新を確認・適用する |
| 追加ツールを減らす、npm packageに同梱された版を使う | 各アプリの導入ガイドにある `npx -y jp-lit-mcp install-skills <app>` | npmの導入コマンドを再実行する。特定版は `jp-lit-mcp@0.17.0` のように指定する |

GitHub経由では、取得元repository・ref・tree SHAがSkillsに記録され、`preview`、版固定、更新のdry-runを利用できます。GitHub CLIのSkills管理は現在public previewで、将来の仕様変更がありえます。[GitHub CLI公式manual](https://cli.github.com/manual/gh_skill)、[installの仕様](https://cli.github.com/manual/gh_skill_install)

## 前提

- `GitHub CLI` (`gh`) **2.90.0 以降**が必要です
- `gh skill` は public preview です
- `gh skills` は `gh skill` の alias として使えます
- GitHub Docs では `gh` **2.90.0 以降**が案内されています
- `gh skill --help` が `unknown command "skill"` になる場合は、GitHub CLI を 2.90.0 以降へ更新してください
- 認証を求められた場合は、`gh auth login` でログインしてください

参考:

- [GitHub CLI install manual](https://cli.github.com/manual/gh_skill_install)
- [GitHub DocsのSkills管理手順](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills)

## MCP登録と実行環境を準備する

MCPの登録は、Skillsの導入方法に共通する手順です。`gh skill install` とnpmの `install-skills` はSkillsを配置するコマンドで、どちらもMCPの登録までは行いません。

使うアプリの導入ガイドで、次の準備を済ませてください。

- [Codex App](codex-app.md)
- [Codex CLI](codex-cli.md)
- [Cursor](cursor.md)
- [Claude Code](claude-code.md)

1. `npx -y jp-lit-mcp` での `MCP` 登録
2. 必要なら環境変数 `CINII_RESEARCH_APP_ID` の設定

各アプリのSkills導入段階で、GitHub CLI経由のコマンドを選びます。MCP本体とTEI/IIIF CLIの起動には、引き続き `Node.js 22` 以上とnpmを使います。TEI readerのuv/Python環境は[TEIガイド](../tei-reader.md)、IIIF CLIの起動は[IIIFガイド](../iiif-workbench.md)を参照してください。

`gh skill install` はtarget agentとinstall scopeを指定できます。CursorとClaude Codeでは、それぞれ `--agent cursor` / `--agent claude-code` を明示し、個人用には `--scope user` を付けてください。Codexの個人用は次の配置先指定を使います。作業repository内だけで使う場合は、対応するagentと `--scope project` を選びます。

Codexの個人用Skillsは、[現行OpenAI公式手順](https://learn.chatgpt.com/docs/build-skills)に合わせて `~/.agents/skills/` を使います。[gh 2.94.0の配置規則](https://github.com/cli/cli/blob/v2.94.0/internal/skills/registry/registry.go#L62-L66)では `--agent codex --scope user` の既定先が `~/.codex/skills/` になるため、このページのCodex用コマンドは `--dir "$HOME/.agents/skills"` で配置先を明示します。`--dir`はagent/scopeの既定先を置き換えます。`$HOME`の表記はPowerShellとbashで使えます。

`gh skill install` で version を指定しない場合、GitHub CLI は次の順で install 元を解決します。

1. repository の最新タグ付き release
2. default branch の HEAD

通常利用では公開releaseのSkillsを使います。`main`へ変更をpushした段階の内容を確認したい場合は、`jp-lit-research@main` のようにrefを明示してください。特定版へ固定する場合は、`jp-lit-research@v0.17.0` のようにタグを付けるか、`--pin v0.17.0` を使います。

## 使い方

公開repositoryは [itarunnn/jp-lit-mcp](https://github.com/itarunnn/jp-lit-mcp) です。コマンドのrepository指定には `itarunnn/jp-lit-mcp` を使います。

### agent / scope を指定してまとめて入れる

```bash
gh skill install itarunnn/jp-lit-mcp --all --dir "$HOME/.agents/skills"
gh skill install itarunnn/jp-lit-mcp --all --agent cursor --scope user
gh skill install itarunnn/jp-lit-mcp --all --agent claude-code --scope user
```

使うagentに合わせて1行だけ実行します。文献探索の `jp-lit-research`、文献検証の `jp-lit-verification`、TEI読解の `jp-lit-tei`、IIIF比較・画像読解の `jp-lit-iiif` が入ります。既存の同名Skillsを個別に編集した場合は、導入・更新の前に編集内容を退避してください。

### 対話的に選ぶ

```bash
gh skill install itarunnn/jp-lit-mcp --dir "$HOME/.agents/skills"
```

この形だと、repo 内の Skills を対話的に選べます。

### 個別の Skill を入れる

```bash
gh skill install itarunnn/jp-lit-mcp jp-lit-research --dir "$HOME/.agents/skills"
gh skill install itarunnn/jp-lit-mcp jp-lit-verification --dir "$HOME/.agents/skills"
gh skill install itarunnn/jp-lit-mcp jp-lit-tei --dir "$HOME/.agents/skills"
gh skill install itarunnn/jp-lit-mcp jp-lit-iiif --dir "$HOME/.agents/skills"
```

ここではCodexの個人用配置先を指定しています。CursorやClaude Codeでは `--dir` の代わりに、対応する `--agent` と `--scope user` を使ってください。

IIIFの比較画面と画像読解は[IIIFガイド](../iiif-workbench.md)を参照してください。Skillは手順を提供し、CLIは同ガイドのnpmコマンドで起動します。

### version を明示して入れる

特定のversionを入れる場合は、Skill名に `@VERSION` を付けます。

```bash
gh skill install itarunnn/jp-lit-mcp jp-lit-research@v0.17.0 --dir "$HOME/.agents/skills"
gh skill install itarunnn/jp-lit-mcp jp-lit-verification@v0.17.0 --dir "$HOME/.agents/skills"
```

4 Skillsをまとめて同じreleaseへ固定する例です。

```bash
gh skill install itarunnn/jp-lit-mcp --all --pin v0.17.0 --dir "$HOME/.agents/skills"
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
gh skill preview itarunnn/jp-lit-mcp jp-lit-research@v0.17.0
```

### 更新を確認して適用する

このrepoの4 Skillsだけを対象に、ファイルを変更せず更新の有無を確認します。CursorとClaude Codeは次のコマンドを使います。

```bash
gh skill update jp-lit-research jp-lit-verification jp-lit-tei jp-lit-iiif --dry-run
```

Codexは導入時と同じ配置先を指定します。

```bash
gh skill update jp-lit-research jp-lit-verification jp-lit-tei jp-lit-iiif --dry-run --dir "$HOME/.agents/skills"
```

更新を適用する場合は、同じ対象から `--dry-run` を外します。対話モードでは適用前に確認が表示されます。

```bash
# Cursor / Claude Code
gh skill update jp-lit-research jp-lit-verification jp-lit-tei jp-lit-iiif
# Codex
gh skill update jp-lit-research jp-lit-verification jp-lit-tei jp-lit-iiif --dir "$HOME/.agents/skills"
```

特定のSkillだけを確認・更新する場合は、その名前だけを指定してください。Codexの例です。

```bash
gh skill update jp-lit-research --dry-run --dir "$HOME/.agents/skills"
gh skill update jp-lit-research --dir "$HOME/.agents/skills"
```

版を固定したSkillsは通常の更新対象から除外されます。固定を続ける場合は、希望する新しいtagを指定して導入し直します。固定を解除して更新対象に戻す場合は、対象名と `--unpin` を指定してください。[updateの仕様](https://cli.github.com/manual/gh_skill_update)

## 導入後の管理方法

GitHub経由で入れたSkillsは `gh skill update`、npm経由で入れたSkillsはnpmの導入コマンドで管理します。npm installerをGitHub取得版へ重ねると、GitHubの追跡metadataが置き換わるため、同じSkillsの導入・更新経路を揃えてください。

管理経路を切り替える場合は、編集内容を退避してから移行先の導入コマンドを実行します。npmからGitHubへ移す場合は、このページのアプリ別コマンドで `gh skill install` を実行し、取得元の記録を付け直します。GitHubからnpmへ移す場合は、各アプリのnpm導入コマンドを使い、以後の更新もnpm経由に揃えます。このページのコマンドでは、同じアプリの両経路の配置先を揃えています。

既にghのCodex用既定コマンドで導入した場合は、`~/.codex/skills/` にも同名Skillsが残りえます。移行前に `~/.codex/skills/` と `~/.agents/skills/` の両方を確認し、編集内容を退避してください。新しい配置先で導入と利用を確認した後、旧配置先のこのrepo由来の4 Skillsは読み込み対象外の場所へ退避し、更新対象が一組になるように整理します。
