# jp-lit-mcp

`jp-lit-mcp` は、日本語文献・資料調査を AI エージェントが進めるための MCP server + Skills セットです。NDL Search、CiNii、J-STAGE、国書、国会・帝国議会会議録などを横断しながら、検索、候補整理、実在性確認、調査ログ化を支援します。

## Skill と MCP の役割

MCP は検索・取得の道具です。データベースへ問い合わせ、書誌、所蔵、OCR、会議録、研究データなどを返します。

Skills によって実際の調査を進めます。どの source から入るか、検索語をどう広げるか、候補をどう評価するか、本文確認の有無をどうラベルづけするかを案内します。

- `jp-lit-research`: 日本語文献・資料調査を進める Skill。テーマ調査、書誌確認、地域資料・地方人物、本文・図版探索などを扱います。プロンプトに「文献DB」を入れることで発動します。
- `jp-lit-verification`: 貼り付けた文章や他サービスの回答に出てくる文献候補を抽出し、実在性や混線の可能性を確認する Skillです。プロンプトに「文献検証」を入れることで発動します。

## 最短導入

通常利用では、このリポジトリを clone せずに `npx` から使えます。

前提は `Node.js 18` 以上と `npm` です。

Codex で Skills を先に入れる最短コマンドは次です。Cursor / Claude Code では末尾の target を `cursor` / `claude` に読み替えます。

```bash
npx -y jp-lit-mcp install-skills codex
```

MCP 登録やアプリ別の設定は、利用するアプリの guide を選んで進めてください。

- [Codex App](docs/install/codex-app.md)
- [Codex CLI](docs/install/codex-cli.md)
- [Cursor](docs/install/cursor.md)
- [Claude Code](docs/install/claude-code.md)

導入確認には、次を実行します。

```bash
npx -y jp-lit-mcp doctor
```

`doctor` は Node.js、package、同梱 Skills、cache / exports の書き込み、`CINII_RESEARCH_APP_ID` の有無を確認します。`CINII_RESEARCH_APP_ID` は CiNii Research の API 利用登録で取得する appid 用の環境変数です。`doctor` は外部 DB への live API アクセスは行いません。

## 最初の依頼例

```text
文献DBで、近代日本の労働文化について、論文と図書を探してください。
```

```text
文献DBを始めます。明治期の俳句雑誌について、最初に見るべき資料と使うべき DB を教えてください。
```

```text
文献検証で、この文章に出てくる文献の実在性を確認してください。
```

## Skill でできること

- 調査目的から source 候補を選び、検索語を段階的に広げる。
- 図書、論文、雑誌記事、会議録、研究データ、デジタル化資料を探す。
- 書誌、所蔵、オンライン入口、OCR 全文、要旨、目次、会議録本文を確認する。
- 地域資料・地方人物の調査で、県立図書館、市区町村中央館、専門資料室などの確認線を組む。
- カーリル Remote MCP（外部 MCP）と併用し、地域の図書館探索を Skill-guided route として扱う。利用する AI クライアント側で別途設定し、初回 OAuth 認可が必要です。
- `jp-lit-verification` で文献候補の実在確認済み / 部分一致 / 非実在の疑い / 混線の疑いを整理する。

詳細な source 別の使い分けは [使い方ガイド](docs/usage-guide.md) と [技術リファレンス](docs/reference.md) に置いています。

## 調査成果物

調査によって cache / session trace / handoff report / 最終回答が出力されます。

- cache: 検索・取得 payload の再利用用。
- session trace: 調査経過、source を選んだ理由、検索試行、採用・保留・除外理由、本文確認範囲、未確認事項を復元するための記録。
- handoff report: 主エージェントや人間が判断するための整理済み report。
- CSL JSON: 文献管理・引用処理向けの書誌 export。調査経過は混ぜず、採用文献の書誌情報だけを出します。

## 主な検索対象

ここに示したものは一部です。詳細な source / tool catalog は [docs/reference.md](docs/reference.md) を参照してください。

- NDL Search
- CiNii
- J-STAGE
- 国書
- 国会・帝国議会会議録
- NDL デジタルコレクション、IRDB、JDCat、Japan Search、Web NDL Authorities など

## エージェントによる調査整理

`jp-lit-mcp` は、LLM が文献の内容把握や学術的位置づけを最終決定するためのものではありません。本文を読んでいない文献でも、タイトル、要旨、目次、書評、出版社紹介、Web 上の断片から仮整理することがあります。その場合は、本文読解ではないことと、何を根拠にした整理かを明示します。

`online=true` や PDF / HTML / デジコレへのリンクは、オンライン上に入口があることを示すだけで、エージェントが本文を読んだことを意味しません。

候補には、資料種別、出版社・媒体、著者属性、引用・書評状況、本文確認状況を手がかりに、調査上の確認優先度を仮に付けることがあります。ただし出版社や媒体だけで文献の価値を確定しません。確認優先度は、人間が次に何を見るべきかを決めるための作業上の目安です。

## ドキュメント

- [docs/usage-guide.md](docs/usage-guide.md): 使い方ガイド。依頼例、調査フロー、結果の読み方。
- [docs/reference.md](docs/reference.md): 技術リファレンス。source、MCP tool、環境変数、保存形式。
- [docs/regional-public-library-research.md](docs/regional-public-library-research.md): 地域資料・地方人物調査とカーリル Remote MCP 併用。
- [docs/source-usage-conditions.md](docs/source-usage-conditions.md): 外部 DB / API の利用条件メモ。
- [docs/install/codex-app.md](docs/install/codex-app.md)、[docs/install/codex-cli.md](docs/install/codex-cli.md)、[docs/install/cursor.md](docs/install/cursor.md)、[docs/install/claude-code.md](docs/install/claude-code.md): アプリ別導入 guide。
- [docs/install/github-skills.md](docs/install/github-skills.md): GitHub CLI で Skills を入れる secondary / public-preview route。

## MCP 単体で使う場合

Skill なしでも MCP server を登録するだけで検索できます。ただし、source 選択、検索語展開、候補評価、本文確認ラベル、調査ログは利用者またはエージェントに委ねられます。調査の再現性や引き継ぎを重視する場合は Skills の併用を推奨します。

Skill を使わない場合は `文献DBで` / `文献検証で` などの Skill 起動語を避け、必要に応じて source 名や tool 名を直接指定してください。

## 開発者向け

clone が必要なのは、開発、source 追加、テスト、release 準備をする場合だけです。

```bash
npm install
npm run build
npm test
npm run smoke:mcp
npm run smoke:calil-mcp
```

カーリル Remote MCP の接続確認は、開発 checkout では `npm run smoke:calil-mcp` でも行えます。これは Codex の MCP 設定とは別の Node smoke script で、初回はブラウザで OAuth 認可が必要です。

## ライセンス

このリポジトリのコードは `MIT License` です。詳細は [LICENSE](LICENSE) を参照してください。

MCP がアクセスする外部 DB / API のデータ利用条件は提供元ごとに異なります。再配布、表示、商用利用、ミラー的な保存を行う前に、[docs/source-usage-conditions.md](docs/source-usage-conditions.md) と各提供元規約を確認してください。
