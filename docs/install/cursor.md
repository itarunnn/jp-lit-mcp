# Cursor で使う

このページは、`Cursor` で `jp-lit-mcp` を使うための手順です。通常利用では、このリポジトリを clone する必要はありません。

## 前提

- `Node.js 18` 以上と `npm` が使えること
- `Cursor` が起動できること

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

`CINII_RESEARCH_APP_ID` は、MCP サーバーへ渡す環境変数です。値には CiNii Research の API 利用登録で取得する `appid` を入れます。CiNii 系 source の安定利用に推奨し、KAKEN API tool では必要です。未設定でも、NDL、J-STAGE、IRDB など他の source は追加設定なしで使えます。

実値を JSON に直書きしたくない場合は、Cursor の config interpolation を使って `"CINII_RESEARCH_APP_ID": "${env:CINII_RESEARCH_APP_ID}"` と書き、OS / shell 側の環境変数から渡すこともできます。

補足:

- `.cursor/mcp.json` は Cursor の project configuration です
- グローバルに使いたい場合は `~/.cursor/mcp.json` に同様の形式で書けます
- editor と `cursor-agent` CLI は同じ MCP 設定を使います

2. `Skills` をインストールします。

この手順で、同梱されている文献探索用の `jp-lit-research` と文献実在性確認用の `jp-lit-verification` の両方を user-level の `~/.cursor/skills/` に配置します。

```bash
npx -y jp-lit-mcp install-skills cursor
```

Cursor では project-level の Skill ディレクトリも使えます。ただし、この package の主導線は `npx -y jp-lit-mcp install-skills cursor` による user-level install です。

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
- `Skills` を使いたいのに、`npx -y jp-lit-mcp install-skills cursor` を実行していない

よくある見分け方:

- 文献DBモードが起動しない
  - `~/.cursor/skills/` に `jp-lit-research` と `jp-lit-verification` が入っているか確認してください
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
