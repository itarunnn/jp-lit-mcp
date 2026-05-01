# Claude Code で使う

このページは、`Claude Code` で `jp-lit-mcp` を使うための手順です。

## 手順

コマンド例のパスは、自分が clone した実際のパスに置き換えてください。
Claude Code の MCP は、公式には `claude mcp add` で追加するのが基本です。

1. このリポジトリを clone します。
2. ターミナルで次を実行します。

```bash
npm install
npm run build
```

3. `Claude Code` に MCP server を追加します。

**Windows (PowerShell)**

```powershell
claude mcp add jp-lit -- node C:\path\to\jp-lit-mcp\dist\src\index.js
```

`CINII_RESEARCH_APP_ID` を設定する場合は `--env` を使います。

```powershell
claude mcp add jp-lit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- node C:\path\to\jp-lit-mcp\dist\src\index.js
```

**macOS / Linux (bash / zsh)**

```bash
claude mcp add jp-lit -- node /path/to/jp-lit-mcp/dist/src/index.js
```

```bash
claude mcp add jp-lit --env CINII_RESEARCH_APP_ID=your-cinii-app-id -- node /path/to/jp-lit-mcp/dist/src/index.js
```

`CINII_RESEARCH_APP_ID` は CiNii の安定利用に推奨します。未設定でも動作しますが、公式仕様では `appid` が必要なため、継続利用では設定してください（[CiNii API 利用登録](https://support.nii.ac.jp/ja/cinii/api/developer)）。NDL、J-STAGE、IRDB など他の source は追加設定なしで使えます。

補足:

- 既定の `local` scope では、現在のプロジェクト用設定が `~/.claude.json` に保存されます
- チームで共有したい場合は `--scope project` を付けると、リポジトリ直下に `.mcp.json` が作られます
- 現在の設定確認は `claude mcp list` でできます

各 source の base URL を明示・上書きしたい場合は [技術リファレンス](../reference.md#環境変数) を参照してください。

4. `Skills` をインストールします。

この手順で、文献探索用の `jp-lit-research` と文献実在性確認用の `jp-lit-verification` の両方がインストールされます。

**Windows (PowerShell)**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-skills.ps1 -Platform claude
```

**macOS / Linux**

```bash
bash scripts/install-skills.sh claude
```

5. `Claude Code` を再起動するか、新しいセッションを開いて、このリポジトリで対話を始めます。

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

## つまずきやすい点

- `Skills` をインストールしたあとに `Claude Code` を再起動していない
- `dist/src/index.js` を作る前に MCP 登録だけしている
- Windows で `ExecutionPolicy` に止められている
- `claude mcp list` で server が見えていない

## 最初の確認

```bash
npm run smoke:mcp
```
