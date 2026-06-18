# jp-lit-mcp

`jp-lit-mcp` は、AI アプリから日本語の文献・資料データベースを横断検索するための MCP サーバーです。国立国会図書館、NDL デジタルコレクション、CiNii Research / Books、J-STAGE、IRDB、JDCat、nihuBridge、国会・帝国議会会議録などに対応しています。

主な読者として、人文学・社会科学の調査で「どのデータベースをどう当たればよいか」を AI と相談しながら進めたい人を想定しています。プログラミング開発者だけの道具ではありません。

使うものは大きく 2 つあります。

- `MCP サーバー`: AI アプリから各種文献データベースを検索・取得するための接続口
- `Skills`: 「どの DB から見るか」「検索語をどう広げるか」「結果をどう読むか」を AI に指示する調査手順

通常利用では、このリポジトリを clone する必要はありません。使うアプリの個別ページに沿って、`npx -y jp-lit-mcp` を MCP サーバーとして登録し、必要に応じて Skills を入れます。

## 何をしたい人向けか

たとえば、次のような作業に向いています。

- 研究テーマに関係する図書、論文、雑誌記事、研究課題、会議録を探す
- NDL / CiNii Books などで書誌・所蔵・オンライン公開状況を確認する
- NDL デジタルコレクションの OCR 全文から語句を探す
- 古典籍、国文学、日本語研究、日本語教育、地域資料など、専門 DB を含めて探す
- レファレンス協同データベースや NDL リサーチ・ナビを手がかりに、調べ方そのものを組み立てる
- 他サービスや AI が出した文献リストに、実在しない文献や混線がないか確認する
- 検索結果をあとから再整理し、Markdown / JSON / CSL JSON で書き出す

反対に、`jp-lit-mcp` は文献を読んで最終的な学術評価を自動で確定する道具ではありません。タイトル、要旨、目次、書誌、所蔵情報、全文検索スニペットなどをもとに調査の入口を作り、人間が次に読むべき資料を見つけやすくするためのものです。

## まず知っておく用語

初めて使う場合、次の 2 つだけ押さえれば十分です。

- `MCP`: AI アプリに外部ツールを追加する仕組みです。ここでは、AI に「NDL や CiNii などを検索できる道具」を渡すものだと思ってください。
- `Skills`: AI に調査の進め方を教えるための手順書です。MCP だけでも検索はできますが、Skills を入れると「最初にどの DB を見るか」「表記ゆれをどう試すか」「候補の強弱をどう説明するか」が安定します。

通常は、MCP と Skills の両方を入れるのがおすすめです。

## 導入前の確認

必要なものは次のとおりです。

- `Node.js 18` 以上
- `npm`
- MCP に対応した AI アプリ

Node.js と npm が使えるかは、ターミナルで確認できます。

```bash
node -v
npm -v
```

`v18` 以上の Node.js が表示されれば大丈夫です。表示されない場合は、先に Node.js を導入してください。

CiNii Research の `appid` とカーリルAI（カーリル Remote MCP）は必須ではありません。ただし、CiNii / KAKEN や地域資料・公共図書館調査をよく使うなら、最初に設定しておくと便利です。入れ先は下の [追加で入れると便利な設定](#追加で入れると便利な設定) にまとめています。

## まず使うアプリを選ぶ

導入でいちばんつまずきやすいのは、アプリごとの MCP / Skills 設定の違いです。普段使うアプリに合わせて、次の手順を見てください。

- [Cursor での導入手順](docs/install/cursor.md)
- [Claude Code での導入手順](docs/install/claude-code.md)
- [Codex CLI での導入手順](docs/install/codex-cli.md)
- [Codex App での導入手順](docs/install/codex-app.md)
- [GitHub CLI で Skills を入れる](docs/install/github-skills.md)

迷った場合は、まず普段文章やコードを書いているアプリに入れるのが楽です。複数のアプリに入れてもかまいませんが、それぞれで MCP 登録と Skills インストールが必要です。

README では全体の登録コマンドを重ねて並べません。MCP 登録、Skills インストール、設定反映の確認、つまずきやすい点は、使うアプリの個別ページに沿って進めてください。

## 追加で入れると便利な設定

### CiNii Research の appid

CiNii Research の API 利用登録で取得する `appid` は、`jp-lit-mcp` の MCP サーバーへ渡す環境変数に入れます。変数名は `CINII_RESEARCH_APP_ID` です。手元で `CiniiId` などと呼んでいる値が CiNii Research API の `appid` を指している場合も、ここに入れます。

大事なのは、単にプロンプトへ書くのではなく、AI アプリが起動する `jp-lit-mcp` の MCP server 設定の `env` として渡すことです。

`your-cinii-app-id` は実際の値に置き換えてください。実値は Git 管理しないでください。

入れておくと、CiNii 系 source の利用が安定し、KAKEN API tool も使えるようになります。未設定でも、NDL、J-STAGE、IRDB、JDCat、国会会議録など多くの source は追加設定なしで使えます。

設定の書き方はアプリごとに違います。

- Codex CLI / Codex App: MCP 追加時に `--env CINII_RESEARCH_APP_ID=...` を渡します
- Claude Code: MCP 追加時に `--env CINII_RESEARCH_APP_ID=...` を渡します
- Cursor: `mcpServers.<server>.env.CINII_RESEARCH_APP_ID` に入れます

詳しい手順は、使うアプリの導入ページを見てください。

- [Cursor での導入手順](docs/install/cursor.md)
- [Claude Code での導入手順](docs/install/claude-code.md)
- [Codex CLI での導入手順](docs/install/codex-cli.md)
- [Codex App での導入手順](docs/install/codex-app.md)

### カーリルAI / カーリル Remote MCP

カーリルAI（カーリル Remote MCP）にも対応しています。

地域資料、地方人物、地方紙、地方雑誌、公共図書館・専門図書館の所蔵まで調べたい場合は、カーリルAI（カーリル Remote MCP）も入れておくと便利です。

カーリルは `jp-lit-mcp` の中に入れる設定ではありません。`jp-lit-mcp` とは別の MCP server として、使う AI アプリ側に追加します。同じ MCP 設定の中に、`jpLit` とは別の `calil` のようなエントリを足すイメージです。

`jp-lit-mcp` と Skills が「どの地域・館・検索語を見るか」を整理し、カーリル Remote MCP が公共図書館 OPAC などの実検索を担当する、という分担です。

カーリル Remote MCP の endpoint は次です。

```text
https://mcp-beta.calil.jp/mcp
```

REST API のアプリケーションキーではなく、初回にブラウザで OAuth 認可します。認可後は通常、新しいセッションで再利用できます。

Codex CLI / Codex App での具体的な登録手順は、次のページにあります。

- [Codex CLI での導入手順](docs/install/codex-cli.md#カーリルaiを併用する場合)
- [Codex App での導入手順](docs/install/codex-app.md#カーリルaiを併用する場合)

Codex CLI でも Streamable HTTP MCP / OAuth を使ってカーリル Remote MCP を追加できます。

地域資料調査でどう使うかは、[地方公共図書館・地域資料調査メモ](docs/regional-public-library-research.md) にまとめています。

カーリル Remote MCP を入れていない場合でも、`jp-lit-mcp` は NDL / CiNii / Japan Search / レファ協などから地域資料の手がかりを整理できます。ただし、カーリル側の live 所蔵検索はできないため、必要な図書館 OPAC やレファレンス相談を次アクションとして案内する形になります。

## 導入後の確認と最初の依頼例

まず軽量診断コマンドを実行します。

```bash
npx -y jp-lit-mcp doctor
```

`doctor` は次を確認します。

- `Node.js 18` 以上か
- npm パッケージを取得できるか
- MCP entrypoint が見えるか
- 同梱 Skills が見えるか
- cache / exports ディレクトリへ書き込めるか
- `CINII_RESEARCH_APP_ID` が設定されているか

外部 DB への live API アクセスは行いません。つまり、`doctor` が通っても、NDL や CiNii の検索結果の品質まで保証するものではありません。

MCP 登録そのものの確認は、各アプリの個別ページにある確認手順を使ってください。設定後は、AI アプリを再起動するか、新しいセッションを開くのがおすすめです。

新しい対話で、次のように依頼します。

```text
文献DBで、近代日本の労働文化について、論文と図書を探してください。
```

```text
文献DBを始めます。明治期の俳句雑誌について、最初に見るべき資料と、使うべき DB を教えてください。
```

```text
文献検証で、この文章に出てくる文献の実在性を確認してください。
```

`文献DBで` / `文献DBを始めます` は `jp-lit-research` を起動する合図です。`文献検証で` / `資料検証で` は `jp-lit-verification` を起動する合図です。

### うまく動かないとき

よくある原因は次のとおりです。

- MCP 登録後に AI アプリやセッションを開き直していない
- MCP は登録したが Skills をインストールしていない
- Skills は入れたが、起動語として `文献DBで` や `文献検証で` を付けていない
- Node.js が古い、または `npx` が使えない
- `CINII_RESEARCH_APP_ID` をユーザー環境変数には入れたが、MCP 子プロセスへ渡っていない

切り分けの順番は、`doctor`、アプリ側の MCP 一覧、Skills のインストール先、新しいセッションでの短い依頼、の順がおすすめです。

## 何ができるか

### 文献を探す

図書、論文、雑誌記事、研究データ、研究課題、会議録などを、目的に応じて source を選びながら探します。

例:

```text
文献DBで、1920年代の都市風俗と映画館について、まず日本語の論文と図書を探してください。
```

```text
文献DBで、戦後日本のゲームセンター文化について、社会学・メディア史寄りの文献を探してください。
```

Skill 併用時は、エージェントが依頼内容から DB 候補、検索語、表記ゆれ、確認順序を考えます。最初の 1 回の検索で終わらせず、結果を見ながら query や source を変える前提です。

### 書誌・所蔵を確認する

NDL Search、NDL Catalog、CiNii Books などを使い、資料の書誌、所蔵館、出版年、巻号、オンライン公開状況を確認します。

例:

```text
文献DBで、この本がどの図書館にあるか、NDL と大学図書館を中心に確認してください。
```

古い図書や雑誌では、表記ゆれ、改題、別タイトル、巻号単位の所蔵差が出ることがあります。Skill は候補を一つに決め打ちせず、強い候補・弱い候補・未確認点を分けて返すようにします。

### 論文・PDF・機関リポジトリを探す

CiNii Research、J-STAGE、IRDB、JDCat などから、論文、紀要、学位論文、研究データ、本文 PDF への入口を探します。

例:

```text
文献DBで、日本のボードゲーム研究について、CiNii、J-STAGE、IRDB を中心に論文を探してください。
```

J-STAGE など一部 source では、API がアブストラクトを返さないことがあります。その場合は、タイトル、著者、掲載誌、リンクなど、確認できる範囲を明示します。

### NDL デジタルコレクションの OCR 全文を探す

NDL デジタルコレクションのインターネット公開資料について、OCR 全文検索、ページ単位検索、文字座標、図版・挿絵検索を使えます。

例:

```text
文献DBで、デジコレ全文から「普通選挙法 公布」が出てくる資料を探してください。
```

```text
文献DBで、明治期の雑誌に出てくる双六の図版を探してください。
```

OCR は誤読や欠落があります。完全一致で出ない場合は、旧字、異体字、送り仮名、スペース、別表記を変えて試す必要があります。

### 古典籍・国文学・日本語研究を探す

国書データベース、国文学論文目録系の source、日本語研究・日本語教育文献データベースなどを使い、古典籍、写本・版本、国文学研究、日本語研究の資料を探します。

例:

```text
文献DBで、『伊勢物語』の近代以降の受容研究を探してください。古典籍そのものと研究論文は分けてください。
```

国書データベースでは、書誌・所在確認のほか、本文スニペット検索や画像タグ検索も補助的に使えます。ただし本文全体、画像本体、IIIF manifest 本体を丸ごと取得する道具ではありません。

### 国会・帝国議会会議録を探す

戦後の国会会議録、戦前の帝国議会会議録を、発言単位・会議単位で探せます。

例:

```text
文献DBで、国会会議録から「私的録音録画」と著作権法改正が議論された発言を探してください。
```

会議録は通常の文献検索とは性質が違うため、必要なときは `国会会議録` や `帝国議会` と明示するほうが安定します。

### 調べ方・参考事例を探す

レファレンス協同データベース、NDL リサーチ・ナビ、KAKEN などを使い、調査テーマの入口、関連する参考資料、検索語候補、研究課題・研究成果報告書 PDF への導線を探します。

例:

```text
文献DBを始めます。地方紙に出てくる戦前の映画館広告を調べたいです。まず調べ方と使うべき DB を整理してください。
```

KAKEN は研究課題や成果報告書 PDF を探す入口です。成果リストに論文や図書が出ることはありますが、それらの書誌確定は CiNii、J-STAGE、IRDB、NDL などで再確認します。

### 典拠・別名義・件名を確認する

Web NDL Authorities を使い、人名、団体名、件名、NDC などから検索語を広げられます。

例:

```text
文献DBで、色川武大と阿佐田哲也の名義関係を確認し、どちらの名義で探すべきか整理してください。
```

別名義、旧字体、筆名、翻字、表記ゆれが多い人物や主題では、典拠確認を先に入れると検索の抜けを減らせます。

### 文献の実在性を検証する

`jp-lit-verification` Skill は、貼り付けた文章や他サービスの回答に出てくる文献候補を抽出し、実在確認済み / 部分一致 / 非実在の疑い / 混線の疑いに分けて確認します。

例:

```text
文献検証で、次の参考文献リストに実在しないものや混線がないか確認してください。
```

架空文献だけでなく、「題名は近いが著者や誌名が違う」「著者は実在するが論文題名だけ混ざっている」といったケースも切り分けます。

### 検索結果を整理し直す

検索結果はローカル cache に保存され、あとから絞り込み、統合、差分確認、再エクスポートができます。

できることの例:

- オンライン公開がある候補だけに絞る
- 複数回の検索結果を統合し、重複候補を整理する
- 前回の検索と今回の検索の差分を見る
- 採用候補に `confirmed` / `strong_candidate` / `weak_candidate` などのラベルを付ける
- Markdown / JSON / CSL JSON で書き出す

CSL JSON で書き出した採用候補は、Zotero、Pandoc、citeproc 系ツールなどの文献管理・引用処理に渡せます。

### 調査経過を残す

長い調査では、検索結果だけでなく、調査目的、source を選んだ理由、検索試行、採用・保留・除外理由、本文確認範囲、未確認事項、次アクションを session trace として残せます。

調査後に残るものは、役割が違います。

cache / session trace / handoff report は、似ていますが役割が違います。

| 種類 | 役割 |
| --- | --- |
| `cache` | 検索結果・取得 payload の保管 |
| `session trace` | 調査過程、判断、未確認事項、次アクションの復元 |
| `handoff report` | 主エージェントや人間が読むための整理済みレポート |
| 最終回答 | その場でユーザーに返す短い報告 |

サブエージェントを使う長い調査では、handoff report を使うと後から経緯を追いやすくなります。詳しくは [使い方ガイド](docs/usage-guide.md#調査後に残るもの) を参照してください。

### 地域資料・公共図書館調査に広げる

地域資料、地方人物、地方紙、地方雑誌では、NDL / CiNii / Japan Search だけでは足りないことがあります。この場合は、県立図書館、市区町村中央館、郷土資料室、専門資料機関、カーリルAI（カーリル Remote MCP）を組み合わせる調査ルートを検討できます。

カーリルAIを実検索に使うには、利用する AI クライアント側でカーリル Remote MCP の設定と初回 OAuth 認可が別途必要です。詳しくは [地方公共図書館・地域資料調査メモ](docs/regional-public-library-research.md) を参照してください。

## Skills を使う理由

MCP 単体でも検索はできます。ただし、その場合は利用者やエージェントが、source 名、検索語、確認順序、結果の扱いをかなり具体的に決める必要があります。

`jp-lit-research` Skill を使うと、検索前に調査計画を立て、必要に応じてレファ協や NDL リサーチ・ナビを見ながら、source と検索語を組み立てます。結果を返すときは、書誌情報だけでなく、確認できた根拠、本文確認の有無、オンライン入口、次に見るべき資料も分けて示します。

`jp-lit-verification` Skill は、文献の存在確認に特化しています。文献探索とは別モードとして、貼り付け文章から候補を抽出し、まず NDL Search を第一関門にして、必要に応じて個別 source で補助確認します。

## 読み方の注意

`online=true`、PDF / HTML / デジコレへのリンク、公式 viewer URL は、オンライン上に入口があることを示します。エージェントが本文を読んだことを意味しません。

本文を読んでいない文献でも、タイトル、要旨、目次、書評、出版社紹介、Web 上の断片から仮整理することがあります。その場合は、本文読解ではないことと、何を根拠にした整理かを明示します。

候補の優先度は、調査上の確認優先度です。出版社、掲載誌、著者属性、引用・書評状況、本文確認状況などを手がかりにしますが、出版社や媒体だけで文献の価値を確定しません。

検索・取得系ツールの `cache.hit=true` は、保存済み cache を再利用したことを示します。この場合は上流 API へ再検索していないため、必要なら `force_refresh=true` で再取得します。古い cache は `jp_lit_prune_cache` で候補を確認してから削除できます。

## 主な対応先

よく使う source は次のとおりです。

- `ndl_catalog`: 国立国会図書館の書誌・所蔵情報を調べる入口
- `ndl_digital`: 国立国会図書館デジタルコレクション
- `cinii_articles` / `cinii_books`: 論文、大学図書館の本・雑誌
- `jstage_articles`: 学会誌・研究論文
- `irdb`: 大学の機関リポジトリ
- `nihu_bridge`: 人文学系専門 DB の横断検索
- `nijl_articles`: 国文学論文・日本文学研究論文の専門目録
- `kokusho`: 国書・古典籍・写本・版本の書誌、著作、所在確認
- `ninjal_bibliography`: 日本語研究・日本語教育文献・国語教育文献
- `national_archives`: 国立公文書館DAの官庁資料・特定歴史公文書
- `jacar`: JACAR の外交・軍事・旧外地・近現代アジア歴史資料
- `kokkai_minutes` / `teikoku_minutes`: 国会・帝国議会会議録
- `jdcat`: 人文学・社会科学系の研究データ
- `japan_search`: 文化財・博物館・地域資料

国書データベースについては、書誌・所在確認の `jp_lit_search(source=kokusho, ...)` とは別に、本文スニペット検索の `jp_lit_search_kokusho_fulltext` と画像タグ検索の `jp_lit_search_kokusho_image_tags` も使えます。どちらも本文全体、画像本体、manifest 本体は取得せず、公式画面で確認するための URL とメタデータを返します。

対応 source や MCP ツールの詳細は [技術リファレンス](docs/reference.md) を参照してください。

## ドキュメント

- [使い方ガイド](docs/usage-guide.md): 実際の依頼例、調査フロー、出力の読み方
- [Cursor での導入手順](docs/install/cursor.md): Cursor で MCP と Skills を使う
- [Claude Code での導入手順](docs/install/claude-code.md): Claude Code で MCP と Skills を使う
- [Codex CLI での導入手順](docs/install/codex-cli.md): Codex CLI で MCP と Skills を使う
- [Codex App での導入手順](docs/install/codex-app.md): Codex App で MCP と Skills を使う
- [地方公共図書館・地域資料調査メモ](docs/regional-public-library-research.md): カーリル Remote MCP を併用する地域資料・地方公共図書館ルート
- [GitHub CLI で Skills を入れる](docs/install/github-skills.md): `gh skill install` を使う別ルート
- [技術リファレンス](docs/reference.md): source、MCP ツール、環境変数、制約、開発・検証コマンド
- [データ利用条件メモ](docs/source-usage-conditions.md): 外部 DB / API の表示要件や利用条件
- [実装状況](docs/project-status.md): 現在の状態、最近の更新、公開後メモ

## 開発したい場合

通常利用では clone 不要です。source 追加や実装修正をしたい場合だけ、このリポジトリを clone して開発します。

```bash
git clone https://github.com/itarunnn/jp-lit-mcp.git
cd jp-lit-mcp
npm install
npm run build
npm run smoke:mcp
```

カーリル Remote MCP の接続確認は、開発 checkout では次でも行えます。

```bash
npm run smoke:calil-mcp
```

これは Codex の MCP 設定とは別の Node smoke script です。初回はブラウザで OAuth 認可が必要です。

## ライセンス

このリポジトリのコードは `MIT License` です。詳細は [LICENSE](LICENSE) を参照してください。

ただし、MCP がアクセスする外部 DB / API のデータ利用条件は別です。個人端末での調査利用と、検索結果を蓄積して複数利用者に提供する公開サービス・共有サーバ運用では注意点が変わります。再配布・表示・商用利用・ミラー的な保存の条件は [データ利用条件メモ](docs/source-usage-conditions.md) と各提供元規約を確認してください。
