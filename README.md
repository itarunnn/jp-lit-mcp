# jp-lit-mcp

`jp-lit-mcp` は、AI アプリから日本語の文献・資料データベースを横断検索するための MCP サーバーです。国立国会図書館、NDL デジタルコレクション、CiNii Research / Books / Dissertations、J-STAGE、IRDB、JDCat、nihuBridge、国会・帝国議会会議録などに対応しています。

主な利用者として、人文学・社会科学の調査で「どのデータベースをどう当たればよいか」を AI と相談しながら進めたい人を想定しています。プログラミング開発者だけの道具ではありません。

使うものは大きく 2 つあります。

- `MCP サーバー`: AI アプリから各種文献データベースを検索・取得するための接続口
- `Skills`: 「どの DB から見るか」「検索語をどう広げるか」「結果をどう読むか」を AI に指示する調査手順

日本文学・日本史のTEI/XMLを読む場合は、`jp-lit-tei` Skillと任意CLI `jp-lit-tei-reader`を使えます。章・歌・史料の項目、異読、訂正、注記を位置付きで取り出し、原構造と読解上の解釈を分けて扱います。[TEIの使い方](docs/tei-reader.md)に依頼例と操作手順をまとめています。

IIIF比較画面では、複数機関の公開資料を1〜4窓に並べ、ページ・矩形を出典付きで記録し、画像と原テキストを既存AIアプリへ渡せます。v0.17.0から任意CLI `jp-lit-iiif`と`jp-lit-iiif` Skillを同梱します。[比較・画像読解の使い方](docs/iiif-workbench.md)を参照してください。

通常利用では、このリポジトリを clone する必要はありません。使うアプリの個別ページに沿って、`npx -y jp-lit-mcp` を MCP サーバーとして登録し、必要に応じて Skills を入れます。

## 何をしたい人向けか

たとえば、次のような作業に向いています。

- 研究テーマに関係する図書、論文、雑誌記事、研究課題、会議録を探す
- NDL / CiNii Books などで書誌・所蔵・オンライン公開状況を確認する
- NDL デジタルコレクションの OCR 全文から語句を探す
- 古典籍、国文学、日本語研究、日本語教育、地域資料など、専門 DB を含めて探す
- 保存したTEI/XMLから章・歌・史料の項目を取り出し、異読・訂正・注記を構造付きで確認する
- 公開IIIFの資料・ページを並べ、選択した画像と原テキストを出典付きでAIへ渡して読む
- レファレンス協同データベースや NDL リサーチ・ナビを手がかりに、調べ方そのものを組み立てる
- 他サービスや AI が出した文献リストに、実在しない文献や混線がないか確認する
- 検索結果をあとから再整理し、Markdown / JSON / CSL JSON で書き出す

MCPはタイトル、要旨、目次、書誌、所蔵情報、全文検索スニペットなどを集め、読む資料の候補を整理します。任意のTEI readerは、手元のXMLから読解対象の単位を取り出します。本文の評価、異読の採用、史料批判、研究上の結論づけは、原資料と照合しながら人間が行う前提です。

## まず知っておく用語

初めて使う場合、次の用語を押さえれば十分です。

- `MCP`: AI アプリに外部ツールを追加する仕組みです。ここでは、AI に「NDL や CiNii などを検索できる道具」を渡すものだと思ってください。
- `Skills`: AI に調査の進め方を教えるための手順書です。MCP だけでも検索はできますが、Skills を入れると「最初にどの DB を見るか」「表記ゆれをどう試すか」「候補の強弱をどう説明するか」が安定します。
- `session_id`: 複数回の検索・判断・注釈を一つの調査案件へまとめる jp-lit のアプリケーション側 ID です。MCP 通信の `Mcp-Session-Id` とは別物です。
- `cache_key`: 個々の検索結果・取得結果の保存場所を指すキーです。`session_id` は調査ノート、`cache_key` は保存結果を管理します。

呼び出し例の `SID` は、先に `jp_lit_start_session` を呼んで取得した `session_id` に置き換えます。検索・取得・照合・注釈・exportでは、同じ調査のIDを毎回指定します。通常はAIがこのIDを保持して呼び出します。

```text
SID = jp_lit_start_session(research_goal="調査テーマ").session_id
```

通常は、MCP と Skills の両方を入れるのがおすすめです。

## Skill と MCP の役割

MCP は検索・取得の道具です。データベースへ問い合わせ、書誌、所蔵、OCR、会議録、研究データなどを返します。

Skills によって実際の調査を進めます。どの source から入るか、検索語をどう広げるか、候補をどう評価するか、本文確認の有無をどうラベルづけするかを案内します。

- `jp-lit-research`: 日本語文献・資料調査を進める Skill。テーマ調査、書誌確認、地域資料、本文・図版探索などを扱います。プロンプトに「文献DB」を入れることで発動します。
- `jp-lit-verification`: 貼り付けた文章や他サービスの回答に出てくる文献候補を抽出し、実在性や混線の可能性を確認する Skill です。プロンプトに「文献検証」を入れることで発動します。
- `jp-lit-tei`: 公開TEIの探索、取得版・hashの記録、章・歌・異読・注記の構造読解を進めるSkillです。「TEIを探して」「このTEIを構造付きで読んで」などで使います。[TEI readerの導入手順](docs/tei-reader.md)を参照してください。readerにはuvとPython3.13が必要です。
- `jp-lit-iiif`: 公開IIIFの資料比較、矩形・原テキスト・出典の保存、画像を実際に開いたAI読解を進めるSkillです。「この2資料をIIIFで比べて」などで使います。[IIIFの導入手順](docs/iiif-workbench.md)を参照してください。比較と書き出しはNode.jsだけで使えます。

## 導入前の確認

必要なものは次のとおりです。

- `Node.js 22` 以上
- `npm`
- MCP に対応した AI アプリ

Node.js と npm が使えるかは、ターミナルで確認できます。

```bash
node -v
npm -v
```

`v22` 以上の Node.js が表示されれば大丈夫です。表示されない場合は、先に Node.js を導入してください。

CiNii Research の公式 API 仕様では `appid` が必須です。現在は未設定でも応答する場合がありますが、正式な利用では `CINII_RESEARCH_APP_ID` を設定してください。未設定時も互換性のため CiNii 検索を続行し、結果に警告を付けます。一方、KAKEN API tool は未設定では実行できません。OpenAlex / Crossref の照合設定とカーリル図書館MCPは任意です。入れ先は下の [追加で入れると便利な設定](#追加で入れると便利な設定) にまとめています。

## 最短導入

導入でいちばんつまずきやすいのは、アプリごとの MCP / Skills 設定の違いです。README では全体の登録コマンドを重ねて並べません。MCP 登録、Skills インストール、設定反映の確認、つまずきやすい点は、使うアプリの個別ページに沿って進めてください。

- [Cursor での導入手順](docs/install/cursor.md)
- [Claude Code での導入手順](docs/install/claude-code.md)
- [Codex CLI での導入手順](docs/install/codex-cli.md)
- [Codex App での導入手順](docs/install/codex-app.md)
- [GitHub CLI で Skills を入れる](docs/install/github-skills.md)

迷った場合は、まず普段文章やコードを書いているアプリに入れるのが楽です。複数のアプリに入れてもかまいませんが、それぞれで MCP 登録と Skills インストールが必要です。

Skillsの導入方法は用途に合わせて選べます。GitHub CLIを既に使っている人や、Skillsの取得元・版・更新を管理したい人には[GitHub CLI経由](docs/install/github-skills.md)をおすすめします。追加ツールを減らしたい人や、npm同梱版を使いたい人には、各アプリのnpm導入手順をおすすめします。MCP登録は両経路に共通で、Skillsの導入・更新にはどちらか一方を使います。

## 追加で入れると便利な設定

### CiNii Research の appid

CiNii Research の API 利用登録で取得する `appid` は、`jp-lit-mcp` の MCP サーバーへ渡す環境変数に入れます。変数名は `CINII_RESEARCH_APP_ID` です。別ツールの設定で同じ値を `CiniiId` など別名で管理している場合は、その値を `CINII_RESEARCH_APP_ID` に設定してください。

大事なのは、単にプロンプトへ書くのではなく、AI アプリが起動する `jp-lit-mcp` の MCP server 設定の `env` として渡すことです。

`your-cinii-app-id` は実際の値に置き換えてください。実値は Git 管理しないでください。

CiNii Research の公式 API 仕様では `appid` が必須です。現在は未設定でも応答する場合がありますが、正式な利用では `CINII_RESEARCH_APP_ID` を設定してください。未設定時も互換性のため CiNii 系 source（論文・博士論文・図書）の検索を続行し、結果に `CINII_APP_ID_REQUIRED` 警告を付けます。KAKEN API tool は同じ `appid` が必須で、未設定では実行できません。NDL、J-STAGE、IRDB、JDCat、国会会議録など多くの source は追加設定なしで使えます。

設定の書き方はアプリごとに違います。

- Codex App: `Settings` の `Integrations & MCP` で、`jpLit` server の環境変数として `CINII_RESEARCH_APP_ID` を追加します
- Codex CLI: MCP 追加時に `--env CINII_RESEARCH_APP_ID=...` を渡します
- Claude Code: MCP 追加時に `--env CINII_RESEARCH_APP_ID=...` を渡します
- Cursor: `mcpServers.<server>.env.CINII_RESEARCH_APP_ID` に入れます

詳しい手順は、使うアプリの導入ページを見てください。

- [Cursor での導入手順](docs/install/cursor.md)
- [Claude Code での導入手順](docs/install/claude-code.md)
- [Codex CLI での導入手順](docs/install/codex-cli.md)
- [Codex App での導入手順](docs/install/codex-app.md)

### OpenAlex / Crossref の照合設定

`jp_lit_enrich_record` は、見つけた単一文献候補を Crossref / OpenAlex で DOI、タイトル、著者、刊行年から照合する補助ツールです。文献検索 source ではなく、既存候補の書誌確認を補強するために使います。

- `OPENALEX_API_KEY`: OpenAlex 照合に使います。未設定の場合、OpenAlex は `skipped` になり、Crossref だけで照合します。
- `CROSSREF_MAILTO`: Crossref の polite pool 用連絡先です。任意ですが、継続利用する場合は設定を推奨します。

これらも `CINII_RESEARCH_APP_ID` と同じく、AI アプリが起動する `jp-lit-mcp` の MCP server 設定の `env` に渡します。実値は Git 管理外のシークレットとして扱います。

Crossref / OpenAlex の未収録や低引用は、日本語人文系文献の低重要度を意味しません。本文確認、専門書評、紀要・地域資料・学会誌の文脈は別途確認してください。

### カーリル図書館MCP

[カーリル図書館MCP](https://calil.jp/ai/) は、カーリルが提供する MCP 対応の図書館蔵書検索サービスです。

地域資料、地方人物、地方紙、地方雑誌、公共図書館・専門図書館の所蔵まで調べたい場合は、カーリル図書館MCPも入れておくと便利です。

カーリルは `jp-lit-mcp` の中に入れる設定ではありません。`jp-lit-mcp` とは別の MCP server として、使う AI アプリ側に追加します。同じ MCP 設定の中に、`jpLit` とは別の `calil` のようなエントリを足すイメージです。

`jp-lit-mcp` と Skills が「どの地域・館・検索語を見るか」を整理し、カーリル図書館MCPが公共図書館 OPAC などの実検索を担当する、という分担です。

カーリル図書館MCPの endpoint は次です。

```text
https://mcp-beta.calil.jp/mcp
```

REST API のアプリケーションキーではなく、初回にブラウザで OAuth 認可します。認可後は通常、新しいセッションで再利用できます。

カーリル公式の対応表・設定ガイドには、現時点では Codex は載っていません。ただし、Codex CLI / Codex App でも Streamable HTTP MCP と OAuth を使って登録できます。具体的な手順は次のページにあります。

- [Codex CLI での導入手順](docs/install/codex-cli.md#カーリル図書館mcpを併用する場合)
- [Codex App での導入手順](docs/install/codex-app.md#カーリル図書館mcpを併用する場合)

地域資料調査でどう使うかは、[地方公共図書館・地域資料調査メモ](docs/regional-public-library-research.md) にまとめています。

カーリル図書館MCPを入れていない場合でも、`jp-lit-mcp` は NDL / CiNii / Japan Search / レファ協などから地域資料の手がかりを整理できます。ただし、カーリル側の live 所蔵検索はできないため、必要な図書館 OPAC やレファレンス相談を次アクションとして案内する形になります。

## 導入後の確認

まず軽量診断コマンドを実行します。

```bash
npx -y jp-lit-mcp doctor
```

`doctor` は次を確認します。

- `Node.js 22` 以上か
- npm パッケージを取得できるか
- MCP entrypoint が見えるか
- 同梱 Skills が見えるか
- cache / exports ディレクトリへ書き込めるか
- `CINII_RESEARCH_APP_ID` が設定されているか

外部 DB への live API アクセスは行いません。つまり、`doctor` が通っても、NDL や CiNii の検索結果の品質まで保証するものではありません。

MCP 登録そのものの確認は、各アプリの個別ページにある確認手順を使ってください。設定後は、AI アプリを再起動するか、新しいセッションを開くのがおすすめです。

## 最初の依頼例

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
文献DBで、戦後日本のレジャー文化について、メディア史寄りの文献を探してください。
```

Skill 併用時は、エージェントが依頼内容から DB 候補、検索語、表記ゆれ、確認順序を考えます。最初の 1 回の検索で終わらせず、結果を見ながら query や source を変える前提です。

### 書誌・所蔵を確認する

NDL Search、NDL Catalog、CiNii Books などを使い、資料の書誌、所蔵館、出版年、巻号、オンライン公開状況を確認します。

例:

```text
文献DBで、この本がどの図書館にあるか、NDL と大学図書館を中心に確認してください。
```

古い図書や雑誌では、表記ゆれ、改題、別タイトル、巻号単位の所蔵差が出ることがあります。Skill は候補を一つに決め打ちせず、強い候補・弱い候補・未確認点を分けて返すようにします。

検索後に複数候補の詳細を確認する場合は `jp_lit_get_records` を使えます。同じ source の1〜10件を入力し、候補ごとの成功・失敗と単件 cache 情報を受け取ります。これは MCP 呼び出しをまとめる機能であり、上流の一括 API ではありません。未キャッシュ分はIDごとの外部照会になります。

### 参考図書・事典・索引から調べる

レファ協や NDL リサーチ・ナビで、参考図書・レファ本・事典・辞典・書誌・索引・年鑑が有効と分かった場合は、NDL「参考図書紹介」を明示指定して候補を探します。

```text
jp_lit_search(session_id=SID, source=ndl_reference_books, query="人物事典")
```

候補は `source_metadata.reference_book`、`source_metadata.reference_ndc`、`source_metadata.introduction`、`source_metadata.has_introduction` で選別します。紹介文がないレコードもあります。候補一覧は所蔵・閲覧可否を示さないため、`jp_lit_get_record` / `jp_lit_get_records` で詳細を確認してから、`cinii_books`、カーリル、各館 OPAC で別に確認してください。

`ndl_reference_books` は source 未指定の既定横断には含まれません。sort、期間（`issued_from` / `issued_to`）、`filters.ndl` は未対応です。これは NDL オープンデータセットを runtime へ一括取り込みする機能ではなく、公開検索エンドポイントで参考図書紹介の候補を検索する導線です。

### 論文・PDF・機関リポジトリを探す

CiNii Research、CiNii Dissertations、J-STAGE、IRDB、JDCat などから、論文、紀要、博士論文・学位論文、研究データ、本文 PDF への入口を探します。

例:

```text
文献DBで、日本の新興宗教研究について、CiNii、J-STAGE、IRDB を中心に論文を探してください。
```

J-STAGE など一部 source では、API がアブストラクトを返さないことがあります。その場合は、タイトル、著者、掲載誌、リンクなど、確認できる範囲を明示します。

### NDL デジタルコレクション系の OCR 全文を探す

デジコレの検索には、役割の違う三つの経路があります。

- `jp_lit_search(session_id=SID, source=ndl_digital)`: 資料名、著者、出版年などの書誌から探す
- `jp_lit_search_fulltext`: 次世代デジタルライブラリー API の収録範囲を OCR 全文検索する
- デジコレ公式画面 + `jp_lit_record_ndl_browser_search`: ブラウザでデジコレ本体の全文検索範囲を確認し、観測結果を調査 session へ保存する

`jp_lit_search_fulltext` は、デジコレ本体の全文検索を網羅しません。API で 0 件でも、公式画面ではログインなし公開資料や送信サービス対象・館内限定資料を含む別の候補が見つかることがあります。ブラウザ操作は明示的に許可された場合だけ行い、ログイン済みタブの利用は未ログイン検索とは別の権限として扱います。

保存した API / browser / fulltext 候補は同じ PID で統合し、ユーザーには一つの候補リストとして返します。検索経路の違い、依頼例、ログイン、本文確認、印刷用 PDF の状態は [デジコレ全文検索ガイド](docs/ndl-digital-collections.md) を参照してください。実際の JSON は [使い方ガイド](docs/usage-guide.md#browser観測を同じsessionへ統合する)、入出力 schema は [技術リファレンス](docs/reference.md#jp_lit_record_ndl_browser_search) にあります。

`ndl_digital` の検索後は、選別済み候補の `content_access.manual_viewing` と `source_metadata.next_digital_library.available` を `jp_lit_get_records` で候補ごとに独立して確認できます。手動閲覧導線と MCP の OCR 利用可否を分けて判断してから、OCR または許可済みのブラウザ確認へ進みます。デジコレ PID が既知なら、`pids` は1〜10件を受け付けますが、1件だけなら `jp_lit_get_record` の `pid`、2〜10件なら `jp_lit_get_records` の `pids` を使うのが基本です。

```text
jp_lit_get_record(session_id=SID, source=ndl_digital, pid="1794357")
```

例:

```text
文献DBで、デジコレ全文から「普通選挙法 公布」が出てくる資料を探してください。
```

```text
文献DBで、明治期の雑誌に出てくる彗星の図版を探してください。
```

OCR は誤読や欠落があります。完全一致で出ない場合は、旧字、異体字、送り仮名、スペース、別表記を変えて試す必要があります。

### 古典籍・国文学・日本語研究を探す

国書データベース、国文学論文目録系の source、日本語研究・日本語教育文献データベースなどを使い、古典籍、写本・版本、国文学研究、日本語研究の資料を探します。

例:

```text
文献DBで、『伊勢物語』の近代以降の受容研究を探してください。古典籍そのものと研究論文は分けてください。
```

国書データベースでは、書誌・所在確認のほか、本文スニペット検索や画像タグ検索も補助的に使えます。ただし本文全体、画像本体、IIIF manifest 本体を丸ごと取得する道具ではありません。

### TEIで文学資料・歴史史料を読む

TEI（Text Encoding Initiative）は、文学作品や歴史史料の本文に、章・歌・人物・注記・訂正などの情報を付けて扱う共通の記述方法です。TEI/XMLを使うと、読む箇所を章や歌で絞り、本文と注記・書き入れを分けたまま確認できます。

たとえば[デジタル漱石](https://github.com/Yosh-Hibi/digital-soseki/tree/main/data/tei/soseki)の『こころ』では、章・節と人物・発話のタグを手掛かりに読めます。[廣瀬本万葉集](https://github.com/kokubunken/nijl-manyoshuTEI)では、歌本文と訓、訂正・書き入れを構造ごとに取り出せます。タグにはデータ作成者の判断も含まれるため、底本と作成方針を確かめ、原資料と照合して使います。

jp-litは、**MCPで作品・関連研究の書誌を探す → `jp-lit-tei` Skillと通常のWeb検索で公開TEI・取得版を確認する → `jp-lit-tei-reader`で保存XMLの必要な箇所を読む**という流れを支えます。書誌検索と公開TEIの探索を組み合わせて、まず次のように依頼できます。

```text
jp-lit-teiを使って、漱石『こころ』の公開TEIを探してください。
jp-litで関連書誌を調べ、公開元からXMLの公開先、底本、収録範囲、利用条件を確認してください。
人物と発話を読みたいので、どんなタグが付いているかも示してください。
```

保存したXMLを読む場合は、Skillとreaderを導入済みのAIアプリへ保存先と読みたい範囲を伝えます。要求の作成とreaderの呼び出しはAIが担当します。

```text
jp-lit-teiを使って、この『こころ』TEIの章・節を確認し、「上　先生と私」の最初の節を読んでください。
人物・発話のタグと本文を示し、データ側の注釈とこちらの解釈を分けてください。
元XMLの位置と、今回の抽出範囲を残してください。
XML: J:\Research\tei\digital-soseki-kokoro-tei.xml
```

**TEIを使った研究の方法から、公開データを読む作業へ進めます。** たとえば小池俊希ほか（2020）[万葉集の「読添えのモ」を扱う諸本比較](https://ipsj.ixsq.nii.ac.jp/records/204868)では、本文と訓、どの本の異同かをTEIに記録し、用例集計で校訂訓の違いに注意する必要を示しています。廣瀬本の公開XMLを読む入口には、菊池信彦ほか（2023）の[教材構築の報告](https://ipsj.ixsq.nii.ac.jp/records/224182)と[データ分析入門](https://dhportal.ac.jp/?p=1533)があります。jp-litでは、歌・訓・訂正・注記を確認し、関連研究を調べて同じ箇所を再読できます。諸本比較の論文と公開廣瀬本XMLは、別のデータとして扱います。

```text
jp-lit-teiで、保存した廣瀬本万葉集TEIの第7番の候補と前後を確認してください。
歌本文・訓・書き入れを分け、訓の「ニ」から「ノ」への訂正と「或本ニミクサ」の注記を探してください。
jp-litで「廣瀬本 万葉集 書き入れ」などの研究と、菊池ほか（2023）の教材構築の報告を探してください。
各文献の書誌と確認範囲を示し、読めた研究を手掛かりに同じ歌を再読してください。
本文、書き入れ、そのデータ側の分類、先行研究の主張、こちらの解釈を分け、元XMLの位置を残してください。
XML: J:\Research\tei\manyo.xml
```

readerにはNode.js22以上、uv、Python3.13.15が必要です。起動を確認するには次を使います。

```sh
uv python install 3.13.15
npx --yes --package=jp-lit-mcp@0.17.0 jp-lit-tei-reader --help
```

[TEIの使い方](docs/tei-reader.md)に、万葉集・延喜式の研究例と論文、廣瀬本での読解と文献調査の往復、漱石・源氏物語も含む公開資料の案内、jp-litでの検索例、導入とAIへの依頼・結果の確認をまとめています。手動実行や要求JSONは[CLI技術資料](packages/tei-reader/README.md)を参照してください。画像を見比べる作業には公開元のビューワを併用し、readerの抽出結果と画像の実見・校合を別々に記録します。

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

### 候補を外部書誌 DB で照合する

DOI や title/author/year が分かる候補は、`jp_lit_enrich_record` で Crossref / OpenAlex による書誌照合を補助できます。これは検索 source ではなく、既に見つけた候補が DOI や書誌要素で一致するかを見るための道具です。

例:

```text
jp_lit_enrich_record(session_id=SID, title="源氏物語研究", authors=["山田太郎"], issued_year="2020")
```

照合結果の `match_confidence` は本文確認や重要度評価ではありません。日本語人文系では、Crossref / OpenAlex に未収録でも重要な文献があります。

保存済み検索結果の重複クラスタを確認するときは、`jp_lit_refine_results(session_id=SID, include_duplicate_clusters=true, include_enrichment=true)` や `jp_lit_export_view(..., duplicate_notes=true)` で、明示した session に残っている `jp_lit_enrich_record` cache を cluster に重ねられます。この場合も新規に Crossref / OpenAlex へ照会せず、既存の照合 metadata を並べるだけです。

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

### 検索条件と調査方法を保存する

`jp_lit_search` の新しい検索結果には `search_context` が入り、送信条件、適用されなかった入力、sourceごとの取得件数と返却件数を確認できます。NDL・CiNii・J-STAGE以外の未計測sourceや旧cacheは、記録された範囲だけを示します。

```text
jp_lit_export_session(session_id=SID, profile="methods", format="markdown")
jp_lit_export_session(session_id=SID, profile="methods", format="json")
```

methodsは検索条件ごとの最新entryを調査方法として出力します。全実行履歴、本文確認、全件収集の記録は保証しません。横断totalの重複可能性やagentの申告を区別する読み方は[使い方ガイド](docs/usage-guide.md#検索条件と調査方法を保存する)を参照してください。

### 調査成果物と調査経過を残す

長い調査では、検索結果だけでなく、調査目的、source を選んだ理由、検索試行、採用・保留・除外理由、本文確認範囲、未確認事項、次アクションを session trace として残せます。

新しい調査では最初に `jp_lit_start_session` を呼び、返された `session_id` を検索・取得・照合・注釈・trace・export の各 stateful tool に明示します。同じ調査では同じ ID を使い、並列の別調査では別 ID を使うため、暗黙の「現在のセッション」へ依存しません。

調査後に残るものは、役割が違います。

cache / session trace / handoff report は、似ていますが役割が違います。

| 種類 | 役割 |
| --- | --- |
| `cache` | 検索結果・取得 payload の保管 |
| `session trace` | 調査過程、判断、未確認事項、次アクションの復元 |
| `handoff report` | 主エージェントや人間が読むための整理済みレポート |
| 最終回答 | その場でユーザーに返す短い報告 |

サブエージェントを使う長い調査では、handoff report を使うと後から経緯を追いやすくなります。詳しくは [使い方ガイド](docs/usage-guide.md#調査後に残るもの) を参照してください。

### 地域資料・地方人物・公共図書館調査に広げる

地域資料、地方人物、地方紙、地方雑誌では、NDL / CiNii / Japan Search だけでは足りないことがあります。この場合は、県立図書館、市区町村中央館、郷土資料室、専門資料機関、カーリル図書館MCPを組み合わせる調査ルートを検討できます。

カーリル図書館MCPを実検索に使うには、利用する AI クライアント側でカーリル図書館MCPの設定と初回 OAuth 認可が別途必要です。詳しくは [地方公共図書館・地域資料調査メモ](docs/regional-public-library-research.md) を参照してください。

## Skills を使う理由

MCP 単体でも検索はできます。ただし、その場合は利用者やエージェントが、source 名、検索語、確認順序、結果の扱いをかなり具体的に決める必要があります。

`jp-lit-research` Skill を使うと、検索前に調査計画を立て、必要に応じてレファ協や NDL リサーチ・ナビを見ながら、source と検索語を組み立てます。結果を返すときは、書誌情報だけでなく、確認できた根拠、本文確認の有無、オンライン入口、次に見るべき資料も分けて示します。

`jp-lit-verification` Skill は、文献の存在確認に特化しています。文献探索とは別モードとして、貼り付け文章から候補を抽出し、まず NDL Search を第一関門にして、必要に応じて個別 source で補助確認します。

## MCP 単体で使う場合

Skill なしでも MCP server を登録するだけで検索できます。ただし、source 選択、検索語展開、候補評価、本文確認ラベル、調査ログは利用者またはエージェントに委ねられます。調査の再現性や引き継ぎを重視する場合は Skills の併用を推奨します。

Skill を使わない場合は `文献DBで` / `文献検証で` などの Skill 起動語を避け、必要に応じて source 名や tool 名を直接指定してください。

## 読み方の注意

`online=true`、PDF / HTML / デジコレへのリンク、公式 viewer URL は、オンライン上に入口があることを示します。エージェントが本文を読んだことを意味しません。

本文を読んでいない文献でも、タイトル、要旨、目次、書評、出版社紹介、Web 上の断片から仮整理することがあります。その場合は、本文読解ではないことと、何を根拠にした整理かを明示します。

候補の優先度は、調査上の確認優先度です。出版社、掲載誌、著者属性、引用・書評状況、本文確認状況などを手がかりにしますが、出版社や媒体だけで文献の価値を確定しません。

検索・取得系ツールの `cache.hit=true` は、保存済み cache を再利用したことを示します。この場合は上流 API へ再検索していないため、必要なら `force_refresh=true` で再取得します。古い cache は `jp_lit_prune_cache` で候補を確認してから削除できます。

## 主な対応先

よく使う source は次のとおりです。

- `ndl_catalog`: 国立国会図書館の書誌・所蔵情報を調べる入口
- `ndl_digital`: 国立国会図書館デジタルコレクション
- `ndl_reference_books`: NDL「参考図書紹介」。既定横断外の候補探索専用で、所蔵・閲覧可否は [参考図書・事典・索引から調べる](#参考図書事典索引から調べる) の後段で別確認
- `cinii_articles` / `cinii_dissertations` / `cinii_books`: 論文、博士論文・学位論文、大学図書館の本・雑誌
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

調査の初動では、source ではありませんが次の補助 tool / Web 導線もよく使います。

- `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases`: レファレンス協同データベースから調べ方マニュアル・レファレンス事例を探し、テーマの入口、参考資料、検索語候補を得る
- NDL リサーチ・ナビ: API / MCP source には接続していません。Web 上の調べ方案内として確認し、見るべき DB、索引、参考書誌、検索語候補を決める材料にします

Crossref / OpenAlex は source ではなく、`jp_lit_enrich_record` で既存候補を照合する補助 provider として使います。

国書データベースについては、書誌・所在確認の `jp_lit_search(session_id=SID, source=kokusho, ...)` とは別に、本文スニペット検索の `jp_lit_search_kokusho_fulltext` と画像タグ検索の `jp_lit_search_kokusho_image_tags` も使えます。どちらも本文全体、画像本体、manifest 本体は取得せず、公式画面で確認するための URL とメタデータを返します。

対応 source や MCP ツールの詳細は [技術リファレンス](docs/reference.md) を参照してください。

## 姉妹 project

外国語資料の調査経路と、BnF・Library of Congress・台湾国家図書館・韓国国立中央図書館・OpenAIRE の固定 metadata source を調べる場合は、[multilingual-research-mcp](https://github.com/itarunnn/multilingual-research-mcp) を使います。本 project は日本語文献の書誌・所蔵・本文到達性を扱います。両者は互いを置き換えず、evidence を自動統合しません。

## ドキュメント

- [使い方ガイド](docs/usage-guide.md): 実際の依頼例、調査フロー、出力の読み方
- [デジコレ全文検索ガイド](docs/ndl-digital-collections.md): 書誌検索・API全文検索・公式ブラウザ検索、ログイン、本文・PDF確認の違い
- [TEIの使い方](docs/tei-reader.md): TEIの基本、漱石・古典・歴史史料の公開例、資料の探索、読解と文献調査の往復
- [Cursor での導入手順](docs/install/cursor.md): Cursor で MCP と Skills を使う
- [Claude Code での導入手順](docs/install/claude-code.md): Claude Code で MCP と Skills を使う
- [Codex CLI での導入手順](docs/install/codex-cli.md): Codex CLI で MCP と Skills を使う
- [Codex App での導入手順](docs/install/codex-app.md): Codex App で MCP と Skills を使う
- [地方公共図書館・地域資料調査メモ](docs/regional-public-library-research.md): カーリル図書館MCPを併用する地域資料・地方公共図書館ルート
- [GitHub CLI で Skills を入れる](docs/install/github-skills.md): Skillsの取得元・版・更新を管理する導入手順
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

カーリル図書館MCPの接続確認は、開発 checkout では次でも行えます。

```bash
npm run smoke:calil-mcp
```

これは Codex の MCP 設定とは別の Node smoke script です。初回はブラウザで OAuth 認可が必要です。

## ライセンス

このリポジトリのコードは `MIT License` です。詳細は [LICENSE](LICENSE) を参照してください。

ただし、MCP がアクセスする外部 DB / API のデータ利用条件は別です。個人端末での調査利用と、検索結果を蓄積して複数利用者に提供する公開サービス・共有サーバ運用では注意点が変わります。再配布・表示・商用利用・ミラー的な保存の条件は [データ利用条件メモ](docs/source-usage-conditions.md) と各提供元規約を確認してください。
