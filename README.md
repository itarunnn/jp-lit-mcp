# jp-lit-mcp

NDL Search、NDL デジタルコレクション、CiNii Research、J-STAGE、IRDB、JDCat、nihuBridge、国会・帝国議会会議録などを、AI エージェントから横断的に使うための日本語文献探索向け MCP サーバーです。

MCP は検索・取得の道具を提供し、同梱の Skills は「どの DB を使うか」「どんな検索語を試すか」「結果をどう評価するか」を対話の中で補助します。

## まず使うアプリを選ぶ

導入でいちばんつまずきやすいのは、アプリごとの MCP / Skills 設定の違いです。まずは使用するアプリの手順を開いてください。

前提として、`Node.js 18` 以上と `npm` が必要です。通常利用ではリポジトリを clone せず、`npx` から MCP サーバーと Skills インストーラーを実行できます。

- [Cursor での導入手順](docs/install/cursor.md)
- [Claude Code での導入手順](docs/install/claude-code.md)
- [Codex CLI での導入手順](docs/install/codex-cli.md)
- [Codex App での導入手順](docs/install/codex-app.md)
- [GitHub CLI で Skills を入れる](docs/install/github-skills.md)

## 最短の始め方

1. 使うアプリの導入手順どおりに `npx -y jp-lit-mcp` を MCP として登録する
2. `npx -y jp-lit-mcp install-skills <app>` で Skills を入れる
3. アプリ上で調査を依頼する

導入後の切り分けには、軽量診断コマンドを使えます。

```bash
npx -y jp-lit-mcp doctor
```

このコマンドは `Node.js 18` 以上、パッケージバージョン、同梱 Skills、cache / exports ディレクトリの書き込み、環境変数 `CINII_RESEARCH_APP_ID` の有無を確認します。`CINII_RESEARCH_APP_ID` は CiNii Research の API 利用登録で取得する `appid` を入れるための名前です。CiNii 系 source の安定利用と KAKEN API tool で使います。外部 DB への live API アクセスは行いません。

開発や source 追加をしたい場合だけ、このリポジトリを clone して `npm install` / `npm run build` / `npm run smoke:mcp` を実行してください。

最初の依頼例:

```text
文献DBで、近代日本の労働文化について、論文と図書を探してください。
```

```text
文献DBを始めます。明治期の俳句雑誌について、最初に見るべき資料と、使うべき DB を教えてください。
```

```text
文献検証で、この文章に出てくる文献の実在性を確認してください。
```

## 何ができるか

- 図書・論文・雑誌記事・会議録・研究データを探す
- NDL / CiNii Books などで所蔵や書誌詳細を確認する
- レファレンス協同データベースの調べ方マニュアル・事例を参照する
- NDL デジタルコレクションの OCR 全文、ページ座標、図版・挿絵を扱う
- 貼り付けた文章に出てくる文献の実在性を確認する
- 保存した調査結果をあとから絞り込み・統合・再整理し、Markdown / JSON / CSL JSON で書き出す
- 調査目的、source 選択、検索試行、採用/保留理由、未確認事項、次アクションなどの調査経過を保存する

CSL JSON で書き出した調査結果は、Zotero、Pandoc、citeproc 系ツールなどの文献管理・引用処理に渡せます。

対応 source や MCP ツールの詳細は [技術リファレンス](docs/reference.md) を参照してください。

## Skills を使う理由

MCP 単体でも検索はできますが、source の選択、検索語の展開、結果の評価は利用者側で考える必要があります。

`jp-lit-research` Skill を使うと、検索前に調査計画を立て、必要に応じてレファ協や NDL リサーチ・ナビを見ながら、source と検索語を組み立てます。調査は一回の検索で終わらせず、候補を見ながら次の query や DB を選び直す前提です。

結果を返すときは、書誌情報だけでなく、全文検索の `highlights` や概要・目次の短い抜粋もできるだけ添えて、「なぜその資料を出したか」が分かる形にします。ページ位置の特定は必要時だけ別ツールで行います。

`jp-lit-mcp` は、LLM が文献の内容把握や学術的位置づけを最終決定するためのものではありません。本文を読んでいない文献でも、タイトル・要旨・目次・書評・出版社紹介・Web 上の断片から仮整理することがあります。その場合は、本文読解ではないことと、何を根拠にした整理かを明示します。`online=true` や PDF / HTML / デジコレへのリンクは、オンライン上に入口があることを示すだけで、エージェントが本文を読んだことを意味しません。

候補はフラットに並べるだけでなく、資料種別、出版社・媒体、著者属性、引用・書評状況、本文確認状況を手がかりに、調査上の確認優先度を仮に付けます。ただし出版社や媒体だけで文献の価値を確定しません。確認優先度は、人間が次に何を見るべきかを決めるための作業上の目安です。

検索したあとの結果整理にも対応しています。今の結果を並び替える、オンライン公開だけに絞る、前回の結果と差分・共通項を取る、といった操作は、原則として保存済み結果を再利用して行います。今の検索結果だけでなく、過去に保存した検索結果も横断検索して統合できます。`jp_lit_search` の `cache.hit=true` は、その再利用元の cache が使われたことを示します。古いローカル cache は `jp_lit_prune_cache` で候補を確認してから削除できます。

調査が長くなる場合は、検索結果だけでなく、調査目的、source を選んだ理由、検索試行、採用・保留・除外理由、本文確認範囲、未確認事項、次アクションもセッションに残せます。Markdown / JSON export ではこの調査経過も読み返せます。CSL JSON は文献管理・引用処理向けなので、調査経過は混ぜず、採用文献の書誌情報だけを出します。

人名の筆名・別名義や件名の確認には Web NDL Authorities を使う補助ツールも利用できます。たとえば色川武大と阿佐田哲也のような名義関係を確認し、名義別に探すか、まとめて探すかを分けられます。NDC などの分類から件名標目を逆引きして、未知の本を探すための探索語候補を作ることもできます。

通常の Skill 導入は各アプリ向けの install guide にある `npx -y jp-lit-mcp install-skills <app>` をおすすめします。GitHub CLI の `gh skill install` を使う別ルートもありますが、こちらは上級者向けです。詳しくは [GitHub CLI で Skills を入れる](docs/install/github-skills.md) を参照してください。

`jp-lit-verification` Skill は、他サービスの回答や自分の文章に出てくる日本語文献候補を抽出し、実在確認済み / 部分一致 / 非実在の疑い / 混線の疑いに分けて確認します。

詳しい使い方は [使い方ガイド](docs/usage-guide.md) を参照してください。

## 主な対応先

よく使う source は次のとおりです。

- `ndl_catalog`: 国立国会図書館や所蔵情報を調べる入口
- `ndl_digital`: 国立国会図書館デジタルコレクション
- `cinii_articles` / `cinii_books`: 論文、大学図書館の本・雑誌
- `jstage_articles`: 学会誌・研究論文
- `irdb`: 大学の機関リポジトリ
- `nihu_bridge`: 人文学系専門 DB の横断検索
- `national_archives`: 国立公文書館DAの官庁資料・特定歴史公文書
- `jacar`: JACAR の外交・軍事・旧外地・近現代アジア歴史資料
- `kokkai_minutes` / `teikoku_minutes`: 国会・帝国議会会議録
- `jdcat`: 人文学・社会科学系の研究データ
- `japan_search`: 文化財・博物館・地域資料

一覧と実装上の注意点は [技術リファレンス](docs/reference.md) にまとめています。

## ドキュメント

- [使い方ガイド](docs/usage-guide.md): 実際の依頼例、調査フロー、出力の読み方
- [GitHub CLI で Skills を入れる](docs/install/github-skills.md): `gh skill install` を使う別ルート
- [技術リファレンス](docs/reference.md): source、MCP ツール、環境変数、制約、開発・検証コマンド
- [データ利用条件メモ](docs/source-usage-conditions.md): 外部 DB / API の表示要件や利用条件
- [実装状況](docs/project-status.md): 現在の状態、最近の更新、公開後メモ

## ライセンス

このリポジトリのコードは `MIT License` です。詳細は [LICENSE](LICENSE) を参照してください。

ただし、MCP がアクセスする外部 DB / API のデータ利用条件は別です。個人端末での調査利用と、検索結果を蓄積して複数利用者に提供する公開サービス・共有サーバ運用では注意点が変わります。再配布・表示・商用利用・ミラー的な保存の条件は [データ利用条件メモ](docs/source-usage-conditions.md) と各提供元規約を確認してください。
