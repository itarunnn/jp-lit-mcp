# jp-lit MCP + Skill 使い方ガイド

この文書は、MCP と Skill のインストール後に「どう使うか」を説明する。インストール方法ではなく、実際の調査依頼の出し方、結果の読み方、MCP 単体利用と Skill 併用の違いを扱う。

## 基本の考え方

`ndl-jp-lit-mcp` は日本語文献・資料を検索して取得する MCP サーバーである。MCP はデータベースを検索し、書誌・本文 OCR・ページ画像 URL・図版情報を返す。

Skill を併用すると、エージェントは依頼内容に応じて source を選び、検索語を展開し、結果の確からしさを整理する。つまり、MCP は「検索・取得」、Skill は「調査手順の判断」を担当する。

## まず何を頼めばよいか

### 文献を探したい

例:

```text
明治期の女学生の制服について、論文と図書を探して。
```

Skill 併用時は、Agent が依頼内容に応じて `cinii_articles` / `jstage_articles` / `ndl_articles` / `irdb` / `ndl_catalog` / `cinii_books` などを使い分ける。MCP 単体で明示的に使う場合は、まず `jp_lit_search` に `query` を渡す。

```text
jp_lit_search(query="明治 女学生 制服")
```

### 書誌や所蔵を確認したい

例:

```text
雑誌『LA VIE』（ルーツ出版、1979年創刊）の所蔵機関を確認して。
```

主に `ndl_catalog` と `cinii_books` を使う。`cinii_books` の詳細には、取得できる場合 `source_metadata.holdings[]` として所蔵館情報が入る。

```text
jp_lit_search(source=ndl_catalog, query="LA VIE ルーツ出版")
jp_lit_search(source=cinii_books, query="LA VIE ルーツ出版")
```

### デジコレ全文から語を探したい

例:

```text
1925年の官報で、普通選挙法の公布に関する記録を探して、ページも特定して。
```

この場合は `ndl_digital` ではなく、次世代デジタルライブラリー系の OCR 全文検索ツールを使う。`ndl_digital` はデジコレ資料のメタデータ検索、`jp_lit_search_fulltext` は OCR 全文から資料を探す検索で、役割が違う。

```text
jp_lit_search_fulltext(keyword="普通選挙法 公布")
jp_lit_search_pages(source=ndl_digital, pid="...", keyword="普通選挙法 公布")
jp_lit_get_text_coordinates(source=ndl_digital, pid="...", page=...)
```

`jp_lit_search_fulltext` の結果に含まれる `pid` は、そのまま `jp_lit_search_pages` や `jp_lit_get_text_coordinates` に渡せる。`source_id` 経由で OCR を使う場合は、先に `jp_lit_get_record(source=ndl_digital, source_id=...)` で `source_metadata.next_digital_library.available=true` を確認する。

### 古い表記や表記ゆれで探したい

例:

```text
明治・大正期の「職業婦人」に関する文献を、当時の表記や関連語も含めて探して。
```

Skill 併用時は、検索語を現代表記だけに固定せず、カナ揺れ・旧字・漢語訳・上位語を試す。

例:

```text
職業婦人 / 職業女性 / 婦人労働 / 婦人勞働 / 女子職業 / 女子教育 / 婦人問題
```

この種の調査では、`ndl_digital`、`jp_lit_search_fulltext`、`ndl_articles`、`ndl_catalog`、`cinii_articles`、`cinii_books`、必要に応じて `nihu_bridge` を使う。

### 図版や挿絵を探したい

例:

```text
錦帯橋が描かれた浮世絵や図版を探して。
```

デジコレ図版検索には `jp_lit_search_illustrations` を使う。結果には図版部分を切り出した `illustration_image_url` が含まれる。

```text
jp_lit_search_illustrations(keyword="錦帯橋")
```

美術・文化財・博物館資料寄りの調査では、`japan_search` も併用する。

### 会議録を探したい

例:

```text
国会会議録で「私的録音録画」と著作権法改正が議論された発言を探して。
```

国会会議録は `kokkai_minutes`、帝国議会会議録は `teikoku_minutes` を使う。これらは source 未指定の横断検索には含まれないので、明示的に指定する。

```text
jp_lit_search(source=kokkai_minutes, query="私的録音録画 著作権法改正")
```

## MCP 単体で使う場合

MCP 単体でも、Claude / Cursor / Codex などのエージェントに自然言語で依頼できる。エージェントが MCP のツール説明を見て、必要に応じて `jp_lit_search` などを呼び出す。

ただし、Skill を使わない場合は、source 選択、検索語展開、典拠評価、OCR の扱いはエージェントの一般的な判断に任される。調査手順を安定させたい場合は Skill 併用を推奨する。

MCP 単体でより確実に使いたい場合は、ツール名や source を明示して依頼するとよい。

よく使う組み合わせ:

```text
書誌検索:
  jp_lit_search(source=ndl_catalog, query="...")
  jp_lit_get_record(source=ndl_catalog, source_id="...")

論文検索:
  jp_lit_search(source=cinii_articles, query="...")
  jp_lit_search(source=jstage_articles, query="...")
  jp_lit_search(source=ndl_articles, query="...")

デジコレ:
  jp_lit_search(source=ndl_digital, query="...")
  jp_lit_get_record(source=ndl_digital, source_id="...")

OCR全文:
  jp_lit_search_fulltext(keyword="...")
  jp_lit_search_pages(source=ndl_digital, pid="...", keyword="...")
  jp_lit_get_text_coordinates(source=ndl_digital, pid="...", page=...)
```

source 未指定の `jp_lit_search(query="...")` は横断検索になる。ただし横断対象は絞られている。

横断検索に含まれる source:

```text
ndl_catalog
ndl_digital
ndl_articles
ndl_articles_online
cinii_articles
cinii_books
jstage_articles
```

横断検索に含まれない source:

```text
ndl_search
irdb
jdcat
nihu_bridge
japan_search
kokkai_minutes
teikoku_minutes
```

これらは必要なときだけ `source=...` で指定する。

## Skill 併用時の頼み方

Skill を使うときは、ツール名を細かく指定しなくてもよい。むしろ、調査目的・時代・資料種別・欲しい出力を自然文で伝える方がよい。

良い依頼例:

```text
明治期の新聞・雑誌で「婦人参政権」に関する文献を探して。旧字や当時の表現も試して、見つかったものは確認済み・有力候補に分けて。
```

```text
『扶桑略記』の推古天皇部分について、読み下しや注釈がある文献を探して。所蔵や掲載誌も確認して。
```

```text
錦帯橋の浮世絵を探している。近景に女性が二人描かれていた記憶がある。デジコレとJapan Searchを使って候補を出して。
```

避けたい依頼例:

```text
全部調べて。
```

この場合、範囲が広すぎて source 選択や検索語展開が難しい。少なくとも、時代・分野・資料種別・目的のどれかを追加する。

## 主なDB/sourceの概要

この MCP では、外部 DB や API を `source` という名前で指定する。source ごとに収録対象や得意な調査が違う。


| source                | どんなDBか                                            | 向いている調査                        | 注意点                                                                           |
| --------------------- | ------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| `ndl_catalog`         | NDLサーチのうち、NDL蔵書・公共図書館等の所蔵を探す入口                    | 図書・雑誌の書誌確認、所蔵確認                | 本文やデジタル画像が読めるとは限らない                                                           |
| `ndl_digital`         | NDLデジタルコレクション資料を NDL Search SRU 経由で探すメタデータ source | デジタル化資料、古い図書・雑誌、官報などの書誌・公開範囲確認 | 本文中の語は直接検索しない。OCR 利用可否は detail の `source_metadata.next_digital_library` で確認する |
| `ndl_articles`        | NDL雑誌記事索引                                         | 雑誌記事、古い論文・記事の手がかり              | 巻号・ページなどは detail 側の `source_metadata` 確認が必要                                   |
| `ndl_articles_online` | NDL雑誌記事索引オンライン版                                   | オンライン採録記事の検索                   | 検索のみ。`jp_lit_get_record` は常に null                                             |
| `ndl_search`          | NDL Search 全体を広めに探す互換 source                      | 個別 source で迷う場合の補助             | 通常は `ndl_catalog` / `ndl_digital` / `ndl_articles` の指定を推奨                     |
| `cinii_articles`      | CiNii Research の論文・記事検索                           | 学術論文、紀要、研究論文の探索                | 本文公開の有無はレコードごとに異なる                                                            |
| `cinii_books`         | CiNii Books。大学図書館等の図書・雑誌所蔵検索                      | 大学図書館の所蔵館確認                    | holdings は取得できない場合もある                                                         |
| `jstage_articles`     | J-STAGE の論文検索                                     | 国内学協会誌、理工・医学・人文社会系の論文          | sort は未対応。PDF URL が取れる場合がある                                                   |
| `irdb`                | IRDB。国内機関リポジトリの横断検索                               | 紀要、学位論文、研究報告書、機関公開論文           | 既定横断検索には含まれない                                                                 |
| `jdcat`               | JDCat。人文学・社会科学系の研究データカタログ                         | 調査データ、統計データ、研究データセット           | データ本体が無条件公開とは限らない                                                             |
| `nihu_bridge`         | NIHU Bridge。人間文化研究機構系の専門 DB 横断                    | 国文学・歴史・民俗・日本語学など人文学専門資料        | 既定横断検索には含まれない                                                                 |
| `japan_search`        | Japan Search。文化資源メタデータの横断ポータル                     | 美術、文化財、地域資料、博物館資料              | 元機関 DB の確認が重要                                                                 |
| `kokkai_minutes`      | 国会会議録検索 API                                       | 戦後国会の議論・発言検索                   | 発言単位で検索する                                                                     |
| `teikoku_minutes`     | 帝国議会会議録検索 API                                     | 1890〜1947年の帝国議会の議論             | 発言単位で検索する                                                                     |


CiNii 系 source（`cinii_articles` / `cinii_books`）は `CINII_RESEARCH_APP_ID` の設定を推奨する。未設定でも動く場合があるが、公式仕様上は `appid` が必要なため、安定利用や公開運用では必ず設定する。実値は Git 管理外のシークレットとして扱う。

次世代デジタルライブラリー系ツール:


| ツール                           | 何をするか                              | 使いどころ                  | 注意点                                              |
| ----------------------------- | ---------------------------------- | ---------------------- | ------------------------------------------------ |
| `jp_lit_search_fulltext`      | 次世代デジタルライブラリーの OCR 全文を資料横断で検索する    | どの資料に語が出るか探す           | 対象はインターネット公開資料中心。`ndl_digital` のメタデータ検索とは別       |
| `jp_lit_search_pages`         | 特定資料内で OCR 全文からページを検索する            | ヒット資料のどのページに語が出るか特定する  | `source=ndl_digital` と `pid` または `source_id` が必要 |
| `jp_lit_get_text_coordinates` | 特定ページの OCR テキスト・座標・ページ画像 URL を取得する | OCR 抜粋とページ画像で該当箇所を確認する | OCR は誤認識があるため重要箇所は画像で確認する                        |
| `jp_lit_get_fulltext`         | 特定資料の全ページ OCR を取得する                | 資料全体をまとめて読みたい場合        | 大きな資料では返却が重くなる                                   |
| `jp_lit_search_illustrations` | 次世代デジタルライブラリーの図版・挿絵をテキスト検索する       | 図版・写真・挿絵を探す            | `illustration_image_url` は図版部分の IIIF 切り出し URL    |


## 結果の読み方

検索結果では、source の性質を踏まえて読む。たとえば `ndl_catalog` のヒットは「所蔵・書誌の確認」には強いが、本文確認には `ndl_digital` でデジタル化資料を確認し、必要なら次世代デジタルライブラリー系の OCR ツールを使う。`japan_search` は文化資源の入口として便利だが、最終確認は元機関のレコードで行う。

## 典拠の強さ

Skill は結果をなるべく次の3段階で整理する。

```text
確認済み:
  書誌情報・本文・ページ画像などで確認できたもの

有力候補:
  書誌やOCRヒットはあるが、現物や画像で未確認のもの

弱い候補:
  タイトル類似、OCR断片、関連語ヒットなど、追加確認が必要なもの
```

OCR 全文ヒットだけでは断定しない。重要な箇所は `jp_lit_get_text_coordinates` の `page_image_url` でページ画像を確認する。

## 調査がうまくいかない時

見つからない場合は、次のように依頼すると改善しやすい。

```text
表記ゆれと旧字を試して。
```

```text
sourceごとに何件ヒットしたか、検索語ごとに整理して。
```

```text
メタデータ検索ではなく、デジコレ全文検索に切り替えて。
```

```text
見つからなかった検索語も含めて、調査ログを出して。
```

「見つからない」こと自体も調査結果になる。特に所蔵調査では、どの source を確認して見つからなかったかを記録することが重要である。

## よくある使い分け

### 論文を探す

```text
cinii_articles → jstage_articles → ndl_articles → irdb
```

### 図書・雑誌を探す

```text
ndl_catalog → cinii_books → ndl_digital
```

### 本文中の語を探す

```text
jp_lit_search_fulltext → jp_lit_search_pages → jp_lit_get_text_coordinates
```

### 図版・挿絵を探す

```text
jp_lit_search_illustrations → japan_search
```

### 古い語・表記ゆれで探す

```text
query expansion → ndl_digital → jp_lit_search_fulltext → nihu_bridge
```

