# jp-lit MCP + Skill 使い方ガイド

このガイドでは、MCP と Skill のインストールを済ませた後に「実際どう使うか」をていねいに説明します。インストール手順は別ドキュメントに譲り、ここでは調査依頼の出し方・結果の読み方・MCP 単体と Skill 併用の使い分けを中心にご紹介します。

インストール手順は次を参照してください。

- [Codex App](install/codex-app.md)
- [Codex CLI](install/codex-cli.md)
- [Cursor](install/cursor.md)
- [Claude Code](install/claude-code.md)

---

## 基本の考え方

`ndl-jp-lit-mcp` は、日本語の文献・資料を検索・取得するための MCP サーバーです。書誌情報・本文 OCR・ページ画像 URL・図版情報など、文献調査に必要な情報を幅広く返します。

Skill（`jp-lit-research` スキル）を組み合わせると、エージェントが依頼内容を読み取り、適切な source を選択し、検索語を展開し、結果の確からしさを段階的に整理してくれます。

| 役割 | 担当 |
|------|------|
| 検索・取得 | MCP（`jp_lit_search` など） |
| 調査手順の判断・検索語展開・結果整理 | Skill |

Skill なしでも MCP 単体で使えますが、その場合は source やツール名をある程度明示する使い方をおすすめします。調査の安定性を高めたい場合は Skill の併用が向いています。

Skill を確実に起動したい場合は、依頼の先頭に `文献DBで` または `文献DBを始めます` を付けてください。一度起動したらそのセッション中は継続し、毎回検索前に調査計画を提示して確認を取ります。

```text
文献DBで、明治期の女学生の制服について、論文と図書を探してください。
```

```text
文献DBを始めます。『常陸国風土記』の調べ方を知りたいです。
```

文献DBモードでは、依頼の内容（intent）に応じて検索前に次を参照して調査計画を作ります。

- レファ協の調べ方マニュアル
- レファ協の類似事例
- NDL リサーチ・ナビの該当分野ページ

ここで得た検索語候補、参考資料、DB 候補、調査順序をもとに「まずどの source をどう使うか」を決め、計画をユーザーに提示して確認を取ってから検索へ進みます。これらは答えをそのまま返すためではなく、調査ルートを組み立てるために使います。

---

## 文献検証モード

他サービスの返答や他セッションの出力を貼り付けて、そこに出てくる日本語文献・資料の実在性・存在を検証できます。

起動フレーズは次のいずれでも発火します。

| パターン | 例 |
|---------|-----|
| 修飾型 | 「文献検証で」「資料検証で」 |
| 起動型 | 「文献実在性調査を始めます」「資料存在確認を始めます」 |
| 単体確認 | 「この文献は本当にある？」「この資料は実在するか」「存在確認して」 |
| 文章渡し | 「文章に出てくる文献（資料）の実在性・存在を確認して」 |

```text
文献検証で、この文章に出てくる文献の実在性を確認してください。
```

このモードでは、文章から文献候補を抽出し、`ndl_search` を第一関門として実在性を確認します。必要な候補だけ個別 source で再確認し、`実在確認済み` / `部分一致` / `非実在の疑い` / `混線の疑い` の表で返します。

### 入力例

```text
文献検証で、次の文章に出てくる文献の実在性を確認してください。

「佐藤花子『大正期女学校制服史』(教育史学研究 第4号, 1931年) によれば、
 当時の制服は海老茶袴から洋装へ移行した」
```

### 出力例

| 抽出文献 | 推定タイプ | 検証結果 | 判定理由 |
|----------|------------|----------|----------|
| 佐藤花子『大正期女学校制服史』 | 論文 | 非実在の疑い | `ndl_search` で題名・著者・掲載誌の組み合わせに一致する有力候補を確認できなかった。表記ゆれを想定した再検索でも近い候補が見つからず、現時点では実在確認に足る根拠がない。 |

### この表の見方

- `実在確認済み`: `ndl_search` で題名・著者・年などが十分強く一致した
- `部分一致`: 題名や年は近いが、著者・掲載誌などにずれがある
- `非実在の疑い`: 有力候補が見つからない
- `混線の疑い`: 複数文献の題名・著者・年が混ざっている可能性がある

重要なのは `検証結果` だけでなく `判定理由` です。各行で、何が一致し、何が一致せず、なぜその判定にしたかを文章で確認してください。

---

## まず何を頼めばよいか

### 文献を探したい

一般的な文献探索は、シンプルに目的を伝えるだけで始められます。

```text
文献DBで、明治期の女学生の制服について、論文と図書を探してください。
```

Skill 併用時は、エージェントが依頼内容に応じて `cinii_articles` / `jstage_articles` / `ndl_articles` / `irdb` / `ndl_catalog` / `cinii_books` などを使い分けます。

MCP 単体で明示的に使いたい場合は、`jp_lit_search` に `query` を渡してください。

```text
jp_lit_search(query="明治 女学生 制服")
```

---

### 書誌や所蔵を確認したい

図書館の所蔵館・書誌情報を調べたいときは、`ndl_catalog` と `cinii_books` を組み合わせます。`cinii_books` の詳細レコードには、取得できる場合 `source_metadata.holdings[]` として所蔵館情報が含まれます。

```text
文献DBで、雑誌『LA VIE』（ルーツ出版、1979年創刊）の所蔵機関を確認してください。
```

```text
jp_lit_search(source=ndl_catalog, query="LA VIE ルーツ出版")
jp_lit_search(source=cinii_books, query="LA VIE ルーツ出版")
```

---

### デジコレ全文から特定の語を探したい

「国立国会図書館デジタルコレクション（デジコレ）の本文から語を探す」には、ツールの使い分けが重要です。

| ツール | 何をするか |
|--------|-----------|
| `ndl_digital` | デジコレ資料のメタデータ検索（本文中の語は直接検索しない） |
| `jp_lit_search_fulltext` | OCR 全文から資料を横断検索する |
| `jp_lit_search_pages` | ヒットした資料の中で、どのページに語があるか特定する |
| `jp_lit_get_text_coordinates` | 特定ページの OCR テキスト・座標・ページ画像 URL を取得する |

```text
文献DBで、1925年の官報で普通選挙法の公布に関する記録を探して、ページも特定してください。
```

標準的な流れはこうなります。

```text
jp_lit_search_fulltext(keyword="普通選挙法 公布")
jp_lit_search_pages(source=ndl_digital, pid="...", keyword="普通選挙法 公布")
jp_lit_get_text_coordinates(source=ndl_digital, pid="...", page=...)
```

`jp_lit_search_fulltext` の結果に含まれる `pid` は、そのまま `jp_lit_search_pages` や `jp_lit_get_text_coordinates` に渡せます。`source_id` 経由で OCR を使う場合は、先に `jp_lit_get_record(source=ndl_digital, source_id=...)` で `source_metadata.next_digital_library.available=true` を確認しておくとスムーズです。

---

### 古い表記や表記ゆれで探したい

明治・大正期の資料を探す際は、現代的な表記だけでなく、当時の語彙・旧字・関連語も試す必要があります。

```text
文献DBで、明治・大正期の「職業婦人」に関する文献を、当時の表記や関連語も含めて探してください。
```

Skill 併用時は、次のような語群を自動的に試みます。

```text
職業婦人 / 職業女性 / 婦人労働 / 婦人勞働 / 女子職業 / 女子教育 / 婦人問題
```

この種の調査では `ndl_digital`・`jp_lit_search_fulltext`・`ndl_articles`・`ndl_catalog`・`cinii_articles`・`cinii_books`、必要に応じて `nihu_bridge` を組み合わせます。

---

### 図版・挿絵を探したい

デジコレ収録資料の図版・挿絵を検索したいときは `jp_lit_search_illustrations` を使います。結果には、図版部分を切り出した `illustration_image_url`（IIIF 切り出し URL）が含まれます。

```text
文献DBで、錦帯橋が描かれた浮世絵や図版を探してください。
```

```text
jp_lit_search_illustrations(keyword="錦帯橋")
```

美術・文化財・博物館資料を扱う場合は、`japan_search` も併用するとカバー範囲が広がります。

---

### 会議録を探したい

国会・帝国議会の発言記録を探したいときは、専用の source を指定してください。これらは source 未指定の横断検索に含まれないため、明示的な指定が必要です。

| source | 対象 |
|--------|------|
| `kokkai_minutes` | 戦後の国会会議録（発言単位で検索） |
| `teikoku_minutes` | 1890〜1947年の帝国議会会議録（発言単位で検索） |

```text
文献DBで、国会会議録で「私的録音録画」と著作権法改正が議論された発言を探してください。
```

```text
jp_lit_search(source=kokkai_minutes, query="私的録音録画 著作権法改正")
```

---

## MCP 単体で使う場合

MCP 単体でも、Claude / Cursor などのエージェントに自然言語で依頼できます。エージェントが MCP のツール説明を参照して、必要なツールを自動的に呼び出します。

ただし Skill がない場合、source 選択・検索語展開・典拠評価・OCR の扱いはエージェントの一般的な判断に委ねられます。調査手順を安定させたい場合は Skill 併用をおすすめします。

Skill 併用時は、長い調査でも検索結果や OCR 全文を会話へ大量に貼り付けず、要点と次の一手を中心に進めます。重い結果は MCP の内部保存を原本として扱い、断定・引用・候補確定・export 前など必要な場面だけ読み直します。

より確実に使いたい場合は、ツール名や source を明示して依頼するとよいでしょう。

`文献DBで` は Skill 起動用の合図です。Skill を使わず MCP 単体で進めたい場合は、次のどちらかがおすすめです。

- `jp_lit_search(source=ndl_catalog, query="明治 女学生 制服")`
- `ndl_catalog で「明治 女学生 制服」を検索して`

文献検証モードを使いたい場合は、`文献検証で` / `資料検証で` / `実在するか確認して` などを明示して貼り付け文章を渡してください。

### よく使うツールの組み合わせ

**書誌検索**
```text
jp_lit_search(source=ndl_catalog, query="...")
jp_lit_get_record(source=ndl_catalog, source_id="...")
```

**論文検索**
```text
jp_lit_search(source=cinii_articles, query="...")
jp_lit_search(source=jstage_articles, query="...")
jp_lit_search(source=ndl_articles, query="...")
```

**調べ方・類似事例の確認**
```text
jp_lit_search_guides_manuals(query="常陸国風土記")
jp_lit_search_guides_cases(query="世界線")
```

**デジコレ資料**
```text
jp_lit_search(source=ndl_digital, query="...")
jp_lit_get_record(source=ndl_digital, source_id="...")
```

**OCR 全文**
```text
jp_lit_search_fulltext(keyword="...")
jp_lit_search_pages(source=ndl_digital, pid="...", keyword="...")
jp_lit_get_text_coordinates(source=ndl_digital, pid="...", page=...)
```

**guide 系ツールの見方**

`jp_lit_search_guides_manuals` と `jp_lit_search_guides_cases` は、`source` 指定型の書誌検索ではなく、レファレンス協同データベースの調査支援ツールです。返り値の `search_keywords` / `guide_headings` / `answer_process` / `reference_sources` を見て、次の `jp_lit_search` 用 query を作るのが基本です。

**調査セッションの保存・エクスポート**

調査の途中や終了後に、候補の整理と書き出しができます。

```text
# 候補にラベルとメモを付ける
jp_lit_annotate_session(tool="jp_lit_search", cache_key="...", selected_items=[...])

# 調査結果を exports/ に書き出す（既定は Markdown / full_log）
jp_lit_export_session(format="markdown", profile="full_log", include_unselected=true)

# 採用候補だけを書き出す
jp_lit_export_session(format="markdown", profile="selected")

# 候補から外したものだけを書き出す
jp_lit_export_session(format="json", profile="unselected")
```

`jp_lit_annotate_session` は、過去に呼んだ検索・書誌取得の結果に `confirmed`（確認済み）/ `strong_candidate`（有力候補）/ `weak_candidate`（弱い候補）のラベルと短いメモを付けます。`selected_items.note` には個別候補の短い理由、`notes` には「何件から何件を採用したか」「どういう基準で絞ったか」「何を外したか」など、検索全体の選別理由を入れる想定です。`jp_lit_export_session` は、その内部保存を元に `exports/` 以下へ人間向けビューを書き出します。

現在の export profile:

- `full_log`
  - セッション全体。未選別候補も必要に応じて含める
- `selected`
  - ラベル付けした候補だけを出す
- `unselected`
  - 候補に残さなかった項目だけを出す

Skill 併用時は、エージェントがこれらを調査の締めくくりに自動的に使います。

内部保存は「あとで読み直せる原本」、会話は「判断と要約」を担う、という分担です。そのため、OCR 全文や `raw` payload を会話に持ち回ることは前提にしていません。

---

### 横断検索について

source を指定しない `jp_lit_search(query="...")` は横断検索になりますが、対象は限られています。

**横断検索に含まれる source**

```
ndl_catalog
ndl_digital
ndl_articles
ndl_articles_online
cinii_articles
cinii_books
jstage_articles
nihu_bridge
```

**横断検索に含まれない source（必要なときだけ明示指定）**

```
ndl_search
irdb
jdcat
japan_search
kokkai_minutes
teikoku_minutes
```

---

## Skill 併用時の頼み方

Skill を使う場合は、ツール名を細かく指定する必要はありません。むしろ、調査の目的・時代・資料種別・欲しい出力を自然な文章で伝える方が、より良い結果が得られます。

### 良い依頼例

```text
明治期の新聞・雑誌で「婦人参政権」に関する文献を探してください。
旧字や当時の表現も試してみて、見つかったものは確認済み・有力候補に分けて整理してください。
```

```text
『扶桑略記』の推古天皇部分について、読み下しや注釈がある文献を探してください。
所蔵館や掲載誌の情報も確認してください。
```

```text
錦帯橋の浮世絵を探しています。近景に女性が二人描かれていた記憶があります。
デジコレと Japan Search を使って候補を出してください。
```

### 避けた方がよい依頼例

```text
全部調べて。
```

このような依頼は、範囲が広すぎて source の選択や検索語の展開が難しくなります。少なくとも「時代・分野・資料種別・目的」のどれかを加えていただくと、より的確な調査が可能になります。

---

## 主な DB / source の概要

この MCP では、外部 DB や API を `source` という名前で指定します。source ごとに収録対象と得意な調査が異なりますので、目的に応じて使い分けてください。

| source | どんな DB か | 向いている調査 | 注意点 |
|--------|-------------|---------------|--------|
| `ndl_catalog` | NDL サーチのうち、NDL 蔵書・公共図書館等の所蔵を探す入口 | 図書・雑誌の書誌確認、所蔵確認 | 本文やデジタル画像が読めるとは限りません |
| `ndl_digital` | NDL デジタルコレクション資料を NDL Search SRU 経由で探すメタデータ source | デジタル化資料、古い図書・雑誌、官報などの書誌・公開範囲確認 | 本文中の語は直接検索しません。OCR 利用可否は detail の `source_metadata.next_digital_library` で確認してください |
| `ndl_articles` | NDL 雑誌記事索引 | 雑誌記事、古い論文・記事の手がかり | 巻号・ページなどは detail 側の `source_metadata` 確認が必要です |
| `ndl_articles_online` | NDL 雑誌記事索引オンライン版 | オンライン採録記事の検索 | 検索のみ。`jp_lit_get_record` は常に null になります |
| `ndl_search` | NDL Search 参加機関 100 以上を一括横断する広域 source | 存在確認・初動調査。「この資料は本当に存在するか」を広く当たりたいとき | CiNii・J-STAGE はハーベスト済みで書誌が薄く、nihu_bridge は対象外。詳細調査は個別 source で |
| `cinii_articles` | CiNii Research の論文・記事検索 | 学術論文、紀要、研究論文の探索 | 本文公開の有無はレコードごとに異なります |
| `cinii_books` | CiNii Books。大学図書館等の図書・雑誌所蔵検索 | 大学図書館の所蔵館確認 | holdings が取得できない場合もあります |
| `jstage_articles` | J-STAGE の論文検索 | 国内学協会誌、理工・医学・人文社会系の論文 | sort は未対応。PDF URL が取れる場合があります |
| `irdb` | IRDB。国内機関リポジトリの横断検索 | 紀要、学位論文、研究報告書、機関公開論文 | 既定横断検索には含まれません |
| `jdcat` | JDCat。人文学・社会科学系の研究データカタログ | 調査データ、統計データ、研究データセット | データ本体が無条件公開とは限りません |
| `nihu_bridge` | NIHU Bridge。人間文化研究機構系の専門 DB 横断 | 国文学・歴史・民俗・日本語学など人文学専門資料 | 横断検索に含まれます。NIHU 傘下 7 機関 100+ DB を横断します |
| `japan_search` | Japan Search。文化資源メタデータの横断ポータル | 美術、文化財、地域資料、博物館資料 | 最終確認は元機関 DB で行ってください |
| `kokkai_minutes` | 国会会議録検索 API | 戦後国会の議論・発言検索 | 発言単位で検索します |
| `teikoku_minutes` | 帝国議会会議録検索 API | 1890〜1947年の帝国議会の議論 | 発言単位で検索します |

> **CiNii 系の認証について**  
> `cinii_articles` / `cinii_books` は `CINII_RESEARCH_APP_ID` の設定を推奨します。未設定でも動作する場合がありますが、公式仕様上は `appid` が必要なため、安定した利用や公開運用では必ず設定してください。実値は Git 管理外のシークレットとして扱います。

---

### 次世代デジタルライブラリー系ツール

| ツール | 何をするか | 使いどころ | 注意点 |
|--------|-----------|-----------|--------|
| `jp_lit_search_fulltext` | 次世代デジタルライブラリーの OCR 全文を資料横断で検索します | どの資料に語が出るか探す | 対象はインターネット公開資料中心です。`ndl_digital` のメタデータ検索とは別物です |
| `jp_lit_search_pages` | 特定資料内で OCR 全文からページを検索します | ヒット資料のどのページに語が出るか特定する | `source=ndl_digital` と `pid` または `source_id` が必要です |
| `jp_lit_get_text_coordinates` | 特定ページの OCR テキスト・座標・ページ画像 URL を取得します | OCR 抜粋とページ画像で該当箇所を確認する | OCR は誤認識があるため、重要箇所は画像で確認してください |
| `jp_lit_get_fulltext` | 特定資料の全ページ OCR を取得します | 資料全体をまとめて読みたい場合 | 大きな資料では返却が重くなることがあります |
| `jp_lit_search_illustrations` | 次世代デジタルライブラリーの図版・挿絵をテキスト検索します | 図版・写真・挿絵を探す | `illustration_image_url` は図版部分の IIIF 切り出し URL です |

---

## 結果の読み方

検索結果を読む際は、source の性質を踏まえることが大切です。

- `ndl_catalog` のヒットは「所蔵・書誌の確認」には強いですが、本文確認には使えません。本文が必要な場合は `ndl_digital` でデジタル化資料を確認し、必要に応じて次世代デジタルライブラリー系の OCR ツールへ進んでください。
- `japan_search` は文化資源の入口として便利ですが、最終的な確認は元機関のレコードで行ってください。
- OCR 全文ヒットだけでは事実の断定はせず、重要な箇所は `jp_lit_get_text_coordinates` の `page_image_url` でページ画像を確認することを推奨します。

---

## 典拠の強さ（3 段階の整理）

Skill 併用時、エージェントは結果をなるべく次の 3 段階で整理します。

| 段階 | 意味 |
|------|------|
| **確認済み** | 書誌情報・本文・ページ画像などで内容を確認できたもの |
| **有力候補** | 書誌や OCR ヒットはあるが、現物や画像で未確認のもの |
| **弱い候補** | タイトル類似・OCR 断片・関連語ヒットなど、追加確認が必要なもの |

---

## 調査がうまくいかない時

なかなか見つからない場合は、以下のような追加依頼を試してみてください。

```text
表記ゆれと旧字を試してください。
```

```text
source ごとに何件ヒットしたか、検索語ごとに整理してください。
```

```text
メタデータ検索ではなく、デジコレ全文検索に切り替えてください。
```

```text
見つからなかった検索語も含めて、調査ログを出してください。
```

「見つからない」という結果自体も調査の成果です。特に所蔵調査では、どの source を確認して見つからなかったかを記録しておくことが重要です。

---

## 目的別のよくある使い分け

### 論文を探す

```
cinii_articles → jstage_articles → ndl_articles → irdb
```

### 図書・雑誌を探す

```
ndl_catalog → cinii_books → ndl_digital
```

### 本文中の語を探す

```
jp_lit_search_fulltext → jp_lit_search_pages → jp_lit_get_text_coordinates
```

### 図版・挿絵を探す

```
jp_lit_search_illustrations → japan_search
```

### 古い語・表記ゆれで探す

```
query expansion → ndl_digital → jp_lit_search_fulltext → nihu_bridge
```
