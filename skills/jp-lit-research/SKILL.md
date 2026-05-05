---
name: jp-lit-research
description: >-
  日本語人文社会系文献調査スキル。jp-lit MCP サーバーを使って NDL・CiNii・J-STAGE・IRDB・JDCat・NIHU Bridge・国会会議録などを横断検索し、
  書誌確認・所蔵調査・テーマ文献探索・古語表記ゆれ検索・デジコレ全文OCR・図版検索を行う。
  「文献DBで調べて」「文献DBを始めます」など、文献DB という起動語を明示した文献調査依頼で使用する。
  一度発火したらセッション中は継続して調査を進める。
  SKIP: 「調べて」単体・API ドキュメント調査・Web 検索・一般的な質問への説明。
---

# 日本語文献調査スキル（jp-lit-research）

このスキルは jp-lit MCP（`jp_lit_search` / `jp_lit_list_cache` / `jp_lit_search_cache_index` / `jp_lit_refine_results` / `jp_lit_export_view` / `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases` / `jp_lit_search_kaken_projects` / `jp_lit_resolve_authority` / `jp_lit_find_authority_terms_by_classification` / `jp_lit_get_record` / `jp_lit_get_fulltext` / `jp_lit_search_fulltext` / `jp_lit_search_pages` / `jp_lit_get_text_coordinates` / `jp_lit_search_illustrations` / `jp_lit_annotate_session` / `jp_lit_export_session`）を使った日本語人文社会系文献調査の作法を定義する。

**MCP は検索・取得に徹する。調査戦略・DB選択・検索語展開・典拠評価はこのスキルが担う。**

Web NDL Authorities 系 tool は、典拠候補・別名義・分類由来の件名標目候補を取得する補助である。どの語を採用して実検索へ進めるかはこのスキルが判断する。

KAKEN tool は、研究課題・研究成果報告書 PDF・成果リストを確認する補助である。KAKEN の成果リスト中の論文・図書・学会発表は文献候補として扱い、採用・引用・CSL JSON 化する前に CiNii / J-STAGE / IRDB / NDL などの文献 source で確認する。

researchmap は MCP tool では扱わない。文献 DB 調査の途中で、講演・口頭発表・寄稿・分担執筆などの漏れやすい成果を探す必要があり、研究者名が手がかりになる場合だけ、ユーザー確認後の補助 Web 検索で researchmap 個人ページを確認してよい。結果は確認済み文献ではなく、追加探索の手がかりとして扱う。

重要論文が見つかった場合は、初出版だけで完結させず、後年の研究書・論文集・著作集等への再録・改稿・最終版候補を確認する。発行日で当たりを付け、目次・初出一覧・あとがき・版注記・現物確認で判断する。

本文未確認の文献については、次を守る。

- タイトル・要旨・目次・書評・出版社紹介・Web 断片から仮整理してよい
- ただし、本文を読んだように要約・分類・位置づけしない
- `availability.online=true` や PDF / HTML / デジコレリンクを見つけただけで、本文を読んだものとして扱わない
- 候補はフラットに並べず、資料種別、出版社・媒体、著者属性、引用・書評状況、確認レベルを手がかりに、調査上の確認優先度を仮に付ける
- 出版社や媒体だけで文献の価値を確定しない
- 必要に応じて `仮整理`, `優先`, `根拠`, `確認`, `本文`, `次` の短いラベルで判断材料と不確実性を残す

**このスキルは、1回の検索で終わるためのものではない。小さく検索し、その結果を見て次の query や次の source を決める対話的な探索ループを支える。**

**そのため、1 回の返答の裏で `jp_lit_search` などを複数回呼ぶことがある。返答時には「この返答は何回の検索を束ねたものか」「各検索で何件ヒットし、そのうち何件見たか」を可能な限り明示する。**

---

## 原則: 生の結果を会話へ抱え込まない

**このスキルは、検索結果や OCR payload を会話へ大量に貼り付けない。MCP が内部保存した cache / session を原本とし、会話には要点と判断だけを残す。**

- 重い OCR 全文、座標 JSON、`raw` payload は必要時だけ読む
- 長い調査では、途中経過を短い要点に圧縮して次に進む
- 断定、引用、candidate の格上げ、競合解消、export 作成時だけ cache / session を再確認する
- 「全部見せて」と求められた場合でも、まずは共通スキーマ上の必要項目を抜粋し、巨大 payload 全文の貼り付けは避ける
- 通常の探索ループ（source 選択、検索語展開、候補判断、次 query の決定）は主エージェントが文脈を持って進める
- サブエージェントは任意。単独エージェントで成立することを前提にし、`cache_key` / `session_id` で原本が固定された大量結果の再整理・重複確認・傾向要約では必要に応じて推奨する
- サブエージェントには新しい query/source の判断、依頼意図の再解釈、最終採否を任せない。固定済みデータの点検結果だけを主エージェントが受け取って統合する

---

## 原則: 計画を立てて確認してから検索する

**検索前に調査計画をユーザーに提示し、確認を取ること。検索 MCP（`jp_lit_search` / `jp_lit_get_record` 等）は確認後のみ呼ぶ。調査前情報収集（`jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases` / WebFetch）は計画生成のために確認前に呼んでよい。**


このスキルの基本動作は次のとおり。

1. 依頼を整理する
2. 最初の仮説を立てる
3. 調査計画をユーザーに提示して確認を取る
4. 最小限の source / query で試す
5. 結果を読む
6. 次の一手を決める
7. 必要なら query や source を変えて再検索する
8. 途中経過を整理して返す

つまり、このスキルは「最初の query を決める」だけでなく、「検索結果から次の query を作る」「別 source に移る」「深掘りするか打ち切るかを決める」までを担当する。

---

## Step 1: 依頼を分類する

| intent | 典型的な依頼 | 参照ワークフロー |
|--------|------------|----------------|
| `bibliography_lookup` | 「この本はどこにある」「書誌を確認したい」「初出を調べたい」 | [bibliography-lookup.md](workflows/bibliography-lookup.md) |
| `topic_literature_review` | 「〇〇に関する文献を集めたい」「論文リストが欲しい」 | [topic-literature-review.md](workflows/topic-literature-review.md) |
| `historical_term_search` | 「明治期の表現で調べたい」「旧字・異体字が含まれる」 | [historical-term-search.md](workflows/historical-term-search.md) |
| `fulltext_page_lookup` | 「この語が出るページを特定したい」「デジコレ全文検索」 | [fulltext-page-lookup.md](workflows/fulltext-page-lookup.md) |
| `image_illustration_search` | 「図版・挿絵を探したい」「画像を探している」 | [image-illustration-search.md](workflows/image-illustration-search.md) |
| `research_guide` | 「何を使って調べればいいかわからない」「調べ方を教えて」 | [research-guide-lookup.md](workflows/research-guide-lookup.md) |

複数 intent が混在する場合は、まず `bibliography_lookup` → `topic_literature_review` の順で処理する。

依頼が曖昧で intent や資料種別が判断できない場合は、検索前に問い返す。詳細は [heuristics/clarifying-questions.md](heuristics/clarifying-questions.md) を参照。

---

## Step 2: 調査前情報収集（intent に応じて）

| intent | 実行条件 |
|--------|---------|
| `research_guide` | 常に実行 |
| `topic_literature_review` | 原則実行（書誌が明確な場合は省略可）|
| `historical_term_search` | 用語・時代・異体字が複雑な場合に実行 |
| `bibliography_lookup` | 初出調査のみ実行。通常の所蔵・書誌確認は省略 |
| `fulltext_page_lookup` | 省略 |
| `image_illustration_search` | 美術・文化財・地域資料の場合のみ実行 |

詳細は [heuristics/advisory-consultation.md](heuristics/advisory-consultation.md) に従う。要点:

1. `jp_lit_search_guides_manuals(query=テーマ, limit=3)` + `jp_lit_search_guides_cases(query=テーマ, limit=3)` でレファ協確認
2. ドメインに対応するリサーチ・ナビ URL を WebFetch
3. 得られた DB 候補・検索語・調査手順を Step 3〜5 に反映する

---

## Step 3: source を選ぶ（早見表）

詳細は [heuristics/source-selection.md](heuristics/source-selection.md) を参照。

| 目的 | 優先 source |
|------|------------|
| 存在確認・初動調査（広域） | `ndl_search`（100 機関以上・1 リクエスト。詳細が必要なら個別 source へ移行）|
| 近代以降の図書・雑誌（詳細） | `ndl_catalog` → `ndl_digital` → `cinii_books` |
| 論文・紀要 | `cinii_articles` → `jstage_articles` → `ndl_articles` → `irdb` |
| 雑誌記事（全般） | `ndl_articles`（近代以降の雑誌記事索引全体）|
| 雑誌記事の本文（デジタル化済みの古い資料） | `ndl_digital`（インターネット公開はおおむね1950年代以前が中心。戦後以降は `cinii_articles` / `jstage_articles` のPDFリンクを先に確認）|
| 本文中の語を探す | `jp_lit_search_fulltext` → `jp_lit_search_pages` |
| 図版・挿絵 | `jp_lit_search_illustrations` → `japan_search` |
| 所蔵確認 | `ndl_catalog` → `cinii_books`（holdings） |
| 人名・団体名・件名・著作名の典拠確認 | `jp_lit_resolve_authority` |
| NDC などの分類から件名標目候補を作る | `jp_lit_find_authority_terms_by_classification` |
| 研究課題・研究成果報告書 PDF・成果リストの手がかり | `jp_lit_search_kaken_projects` |
| 人文専門DB横断（詳細） | `nihu_bridge`（ラウンドロビンモードに含まれる）|
| 研究データ | `jdcat` |
| 機関リポジトリ | `irdb` |
| 会議録 | `kokkai_minutes` / `teikoku_minutes` |
| 調べ方・類似事例 | `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases` |

---

## Step 4: 検索語を展開する

人文社会系では現代語のままでは不足することが多い。詳細は [heuristics/query-expansion.md](heuristics/query-expansion.md) を参照。

**最低限やること:**
1. 表記ゆれ（送り仮名・カタカナ揺れ・旧仮名遣い）を2〜3種追加
2. 旧字・異体字を確認
3. 関連する上位語・下位語を1つずつ加える

---

## Step 5: 検索方針をユーザーに提示する

検索を開始する前に調査計画を提示し、ユーザーの確認を取る。詳細は [heuristics/clarifying-questions.md](heuristics/clarifying-questions.md) を参照。

使う source・検索語の展開・理由を提示し、ユーザーが方針を調整できる余地を作る。ユーザーが「もっと広く」「まずざっくりで」と応じた場合は source を増減して計画を更新する。

提示例:
```
テーマが人文学系のため、以下の source を使います：
- cinii_articles / ndl_articles（論文）
- nihu_bridge（NIHU 人文専門 DB — 国文研・国民博など 100+ DB を横断）
- ndl_catalog / cinii_books（図書）
- irdb（紀要・学位論文）

検索語: 「〇〇」「△△」（旧字: □□）

よろしければ検索を開始します。追加・変更があればお知らせください。
```

scope が小さい依頼（単一の書誌確認など）は 1 行で示してもよい: 「まず ndl_catalog で「○○」を確認します。よいですか？」

ユーザーが「進めて」「そのままで」などと応じた場合はそのまま実行する。

各 DB の特性・選択理由は [heuristics/db-characteristics.md](heuristics/db-characteristics.md) を参照。
方針提示時、またはユーザーに「なぜそのDBか」と問われたときは、そのDBの特性を具体的に説明する。

---

## Step 6: 検索する（MCP を使う）

- メタデータ検索が先。全文検索は後。
- `research_guide` intent では、必要に応じて先に `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases` を使い、そこで得た語・参考資料・探索手順を実検索へつなぐ。
- `jp_lit_search` → 候補がなければ `jp_lit_search_fulltext` → ページ特定は `jp_lit_search_pages` → OCR確認は `jp_lit_get_text_coordinates`
- `ndl_digital` で `jp_lit_get_record` を呼ぶ際、`source_metadata.next_digital_library.available` を確認してから OCR 系ツールを使う。
- **ページネーション:** `jp_lit_search` は1回最大100件。レスポンスの `total` が取得件数を超える場合、`page=2, 3...` と追加取得できる。網羅的な調査では各 source 最大200件程度まで取得を検討する。結果報告には必ず「全N件中M件取得」を明記すること。
- **返答単位と検索単位を混同しない:** `jp_lit_search` の `total` / `limit` / `page` は 1 回のツール呼び出しごとの値である。文献DBモードでは 1 回の返答の中で複数 query・複数 source を順に試すことがあるため、報告時には「今回は 3 回検索した」「1 回目は ndl_search で全 86 件中 50 件取得、2 回目は cinii_articles で全 18 件中 18 件取得」のように分けて示すこと。
- **ラウンドロビン（source 未指定）のページネーション制限:** source 未指定の横断検索は `page=1` のみ対応。`total` が取得件数を超えていても続きは取得できない。ユーザーに「続きを見るには source を指定して再検索してください（例: `source=ndl_catalog`）」と案内すること。

### 検索後の分岐

- ヒット 0 件:
  - 表記ゆれ、旧字、上位語、下位語を追加する
  - source を変える
- ヒットが多すぎる:
  - 年代、資料種別、主題で絞る
  - source を狭める
- 有力な 1 件が見つかった:
  - `jp_lit_get_record` で詳細を見る
  - 著者名、掲載誌名、件名から次 query を作る
  - 必要なら別 source で追う
- `ndl_digital` で見つかった:
  - OCR、ページ特定、図版検索へ進むか判断する

**重要:** 1回の検索で終えるのではなく、結果を読んで次の一手を決めること。

---

## Step 6.5: 直前結果を再ソート・再フィルタする

**ユーザーが「今の結果を〜順で」「この条件で絞って」「除外したものだけ見せて」に類する依頼をした場合は、再検索より先に `jp_lit_refine_results` を使う。**

- 原則として upstream 再検索を行わず、現在セッションの `jp_lit_search` 結果をローカル再処理する
- 「今の検索」は `cache_key` 省略でよい（直近結果を使う）
- 「さっきの○○検索を」は必要に応じて対象 `cache_key` を指定する
- 再処理後に件数差を明示する（`total_before` / `total_after`）
- `jp_lit_refine_results` の既定 `limit` は 30。`total_after > 30` の場合は、会話には整理後の先頭 30 件だけを返し、そのことを明示する
- 重複候補は通常の再整理では出さない。ユーザーが求めた場合や CSL JSON export 前の確認では `include_duplicate_clusters=true` を使う

自然文からの対応例:

- 「今の検索を年代順に」→ `sort_by="issued_at"`, `sort_order="asc"`
- 「新しい順で」→ `sort_by="issued_at"`, `sort_order="desc"`
- 「タイトル順で」→ `sort_by="title"`
- 「オンライン公開だけ」→ `filters.online=true`
- 「NDLだけ」→ `filters.source="ndl_catalog"` など明示 source へ
- 「1900-1945 で絞って」→ `filters.issued_from="1900"`, `filters.issued_to="1945"`
- 「タイトルに◯◯を含むもの」→ `filters.title_contains="◯◯"`
- 「著者に◯◯を含むもの」→ `filters.author_contains="◯◯"`

`jp_lit_refine_results` で満たせる要求は必ず先に実行し、それで不足する場合のみ `jp_lit_search` の query/source を変えて再検索する。

過去キャッシュ横断が必要な場合:

- まず `jp_lit_search_cache_index(query=...)` で候補 `cache_keys` を取得する
- 次に `jp_lit_refine_results(cache_keys=[...], combine=..., sort_by=...)` で再抽出する

自然文ショートカット:

- 「今日のキャッシュだけ」→ `jp_lit_list_cache(tool="jp_lit_search", saved_on="today")`
- 「昨日のキャッシュだけ」→ `jp_lit_list_cache(tool="jp_lit_search", saved_on="yesterday")`
- 「直近1週間のキャッシュ」→ `jp_lit_list_cache(tool="jp_lit_search", saved_on="last_7_days")`
- 「前回との差分だけ」→ `jp_lit_refine_results(cache_keys=[直近2件], combine="minus")`
- 「共通して出てくるものだけ」→ `jp_lit_refine_results(cache_keys=[...], combine="intersection")`
- 「キャッシュを確認してから絞って」→ `jp_lit_list_cache` → `jp_lit_refine_results(cache_keys=[...])`
- 「重複候補を確認して」→ `jp_lit_refine_results(..., include_duplicate_clusters=true)` または全件確認用に `jp_lit_export_view(view="refined_results", export_all=true, duplicate_notes=true)`

`saved_on` のショートハンド（`today` / `yesterday` / `last_7_days`）は、必ずサーバー側で `Asia/Tokyo` 基準に解決される前提で扱う。エージェント側で日付を決め打ちしない。

### 自然文ルーティング規約（厳密版）

ユーザーには SQL 風・関数呼び出し風の入力を要求しない。以下の自然文を内部ツールへ機械的にマップする。

優先順位（上から先に判定）:

1. 最新化要求（キャッシュ無視）
   - トリガー: 「最新で」「取り直して」「再取得」「キャッシュ無視」
   - 実行: `jp_lit_search(force_refresh=true, ...)`
2. キャッシュ削除要求
   - トリガー: 「キャッシュ削除」「消して」「リセット」
   - 実行: 単体なら `jp_lit_delete_cache(cache_key=...)`、一括なら `jp_lit_delete_cache(clear_all=true)`
3. キャッシュ一覧要求
   - トリガー: 「キャッシュ一覧」「何が残ってる」「今日のキャッシュ」
   - 実行: `jp_lit_list_cache(...)`
4. 既存結果の再抽出要求
   - トリガー: 「今の結果を」「並び替えて」「絞って」「差分」「共通」
   - 実行: `jp_lit_refine_results(...)`
5. 通常検索要求
   - 実行: `jp_lit_search(...)`

フレーズ対応（代表）:

- 「今日のキャッシュだけ見せて」
  - `jp_lit_list_cache(tool="jp_lit_search", saved_on="today")`
- 「昨日の分も見せて」
  - `jp_lit_list_cache(tool="jp_lit_search", saved_on="yesterday")`
- 「直近1週間だけ見せて」
  - `jp_lit_list_cache(tool="jp_lit_search", saved_on="last_7_days")`
- 「前回との差分だけ」
  - 直近2件の `cache_key` を選び `jp_lit_refine_results(cache_keys=[A,B], combine="minus")`
- 「共通して出るものだけ」
  - `jp_lit_refine_results(cache_keys=[...], combine="intersection")`
- 「この結果を年代順」
  - `jp_lit_refine_results(..., sort_by="issued_at", sort_order="asc")`
- 「新しい順」
  - `jp_lit_refine_results(..., sort_by="issued_at", sort_order="desc")`

曖昧さ解消ルール:

- 「これ」「その結果」は直近の `jp_lit_search` または直前に表示した `cache_keys` を指す
- 「前回」は同一セッション内で時刻が1つ前の検索結果
- 差分/共通の対象が1件しか無い場合は、実行前に短く確認する
- ルーティング後は「何をどの条件で実行したか」を1行で明示して返す

---

## Step 7: 選別過程を明示して報告する

詳細は [heuristics/evidence-grading.md](heuristics/evidence-grading.md) を参照。

結果は **確認済み / 有力候補 / 弱い候補** の3段階に分けて報告する。OCR ヒットのみで内容を断定しない。

候補を報告するときは、可能な限り次の書誌要素を添える。

- 著者名
- 書名
- 掲載誌名または出版社
- 発行年
- source（DB名）
- 可能なら `source_id` または URL

**書誌要素だけでなく、関連箇所の短い抜粋も可能な限り添える。** 特に次の情報がある場合は、上位の有力候補について 1〜2 件示す。

- `jp_lit_search_fulltext` の `highlights`
- `jp_lit_search` / `jp_lit_get_record` の `summary`
- `jp_lit_search` / `jp_lit_get_record` の `table_of_contents`

抜粋は「なぜその資料を候補にしたか」を示すために使う。毎件長く貼り付けるのではなく、上位候補だけに短く添える。抜粋だけで本文内容を断定しない。ページ位置が必要なら `jp_lit_search_pages` へ進む。

**選別過程は必ず出力すること。** 以下を明記する：
- 今回の返答が何回の検索を束ねたものか
- 各検索で何を確かめるために query / source を変えたか
- 各 source から何件取得したか
- どの基準で候補を絞ったか（関連性・重複・信頼性など）
- 除外したものがあればその理由

**cache 再整理結果の返し方:**

- `jp_lit_refine_results` を使った場合は、必ず `total_before` / `total_after`、適用した条件（sort/filter/combine）、表示件数を明示する
- `total_after <= 30` なら全件返してよい
- `total_after > 30` なら「全何件中、どの順の先頭 30 件か」を明記して先頭 30 件だけ返す
- 全件確認が必要な場合は、まず `jp_lit_export_view` で Markdown / JSON に書き出す
- 重複確認が必要な場合は、`duplicate_notes=true` 付きの refined export を作業台にする。クラスタは自動削除ではなく、最終採否はユーザー確認または主エージェントの明示判断で決める
- `total_after > 100` や複数 cache 統合後の傾向要約が主目的の場合は、`cache_key` / `session_id` で対象を固定したうえで、必要に応じて要約専用のサブエージェントを使ってよい。ただし標準の検索判断フローにはしない
- 返答例:
  - `統合後 86 件です。発行年順に並べ、そのうち先頭 30 件を示します。全件を見るなら export できます。`
  - `差分は 34 件です。新しい順に並べ、上位 30 件を返します。`

ユーザーが「全部見せて」「選ばれなかったものも見たい」「生データを見せて」と求めた場合は、選別前の全件リストを **パース済みの共通スキーマ（SearchItem / RecordItem）ベース** で開示してよい。`raw` や OCR 全文 JSON をそのまま貼り付けるのではなく、必要な項目だけ抜粋して示す。長い調査では、会話に持ち回るのは要点と次の一手だけに留める。

**候補のラベル付けとエクスポート:**

有力な候補が見つかったら `jp_lit_annotate_session` でラベルとメモを保存する。**このとき `selected_items.note` には個別候補の短い理由、`notes` には検索全体の選別理由を入れる。** 調査の締めくくりや「まとめて」「書き出して」という依頼があったときは `jp_lit_export_session` で `exports/` に書き出す。キャッシュ一覧・横断検索・再抽出の表示結果をそのまま保存したい場合は `jp_lit_export_view` を使う。

CSL JSON は Zotero / citeproc / Pandoc などへの取り込み前提になりやすい。重複が気になる場合は、先に `jp_lit_export_view(view="refined_results", export_all=true, duplicate_notes=true)` で確認し、採用する項目だけ `jp_lit_annotate_session` に保存してから `jp_lit_export_session(format="csl-json", profile="selected")` を使う。

`notes` に最低限残すとよい内容:

- 何件取得して何件を採用したか
- どの基準で候補を絞ったか
- 外したものの代表的な理由
- 次に何を確認すべきか

```
jp_lit_annotate_session(
  tool="jp_lit_search",
  cache_key="<検索時のキャッシュキー>",
  selected_items=[
    { source: "ndl_catalog", source_id: "...", title: "...", label: "confirmed", note: "所蔵確認済み" }
  ],
  notes=[
    "全18件から主題一致・年代一致を優先して3件を採用",
    "残りは重複2件、年代不一致9件、関連性が弱い4件として候補から外した"
  ]
)
jp_lit_export_session(format="markdown")
```

---

## 禁止ルール

- 最初から全 source 横断しない（ノイズが増える）
- OCR ヒットだけで本文内容を断定しない
- 表記ゆれ・旧字を試さずに「見つからない」と言わない
- NDL Search / デジコレ / 次世代デジコレを同一と扱わない
- Japan Search を既定横断として使いすぎない（文化財・美術・地域資料に限定）
- レファ協の回答を一次情報として扱わない（導線として使う）
- KAKEN の成果リストを確定文献として扱わない（CiNii / J-STAGE / IRDB / NDL で再確認する）
- `ndl_articles_online` の getRecord は常に null（既知の制約）

---

## 参照順

まず次の `reference/` を読む。

- [reference/01-core-workflow.md](reference/01-core-workflow.md)
- [reference/02-source-and-query.md](reference/02-source-and-query.md)
- [reference/03-evidence-and-output.md](reference/03-evidence-and-output.md)

旧 `workflows/` と `heuristics/` は移行用の詳細資料として当面残す。
