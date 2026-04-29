---
name: jp-lit-research
description: >-
  日本語人文社会系文献調査スキル。jp-lit MCP サーバーを使って NDL・CiNii・J-STAGE・IRDB・JDCat・NIHU Bridge・国会会議録などを横断検索し、
  書誌確認・所蔵調査・テーマ文献探索・古語表記ゆれ検索・デジコレ全文OCR・図版検索を行う。
  「文献を探して」「〇〇について調べて」「この本はどこにある」「古い語で探して」「デジコレで全文検索して」「図版や挿絵を探して」「調べ方がわからない」
  という依頼で使用する。NDL Search / NDL デジタルコレクション / CiNii / J-STAGE / Japan Search / 次世代デジタルライブラリーに関わる調査すべてに適用する。
---

# 日本語文献調査スキル（jp-lit-research）

このスキルは jp-lit MCP（`jp_lit_search` / `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases` / `jp_lit_get_record` / `jp_lit_get_fulltext` / `jp_lit_search_fulltext` / `jp_lit_search_pages` / `jp_lit_get_text_coordinates` / `jp_lit_search_illustrations`）を使った日本語人文社会系文献調査の作法を定義する。

**MCP は検索・取得に徹する。調査戦略・DB選択・検索語展開・典拠評価はこのスキルが担う。**

**このスキルは、1回の検索で終わるためのものではない。小さく検索し、その結果を見て次の query や次の source を決める対話的な探索ループを支える。**

---

## 原則: まず小さく試し、結果を見て次を決める

このスキルの基本動作は次のとおり。

1. 依頼を整理する
2. 最初の仮説を立てる
3. 最小限の source / query で試す
4. 結果を読む
5. 次の一手を決める
6. 必要なら query や source を変えて再検索する
7. 途中経過を整理して返す

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

## Step 2: 検索深度を決める

| 深度 | 基準 | 内容 |
|------|------|------|
| `quick` | 「ちょっと調べて」「ざっと調べて」「参考程度に」 | 横断検索は既定にせず、1問だけ確認するか、最小 source 1〜2 個から始める |
| `standard` | 「調べて」「探して」（明示なし） | source別検索・表記ゆれ展開 → 結果を見て query / source を更新 → 選別済み候補の getRecord → 報告 |
| `deep` | 「網羅的に」「論文・発表用に」「本気で」 | リサーチナビ確認→段階的に複数 source→全文→ページ特定→必要なら図版や所蔵まで追う |

---

## Step 3: source を選ぶ（早見表）

詳細は [heuristics/source-selection.md](heuristics/source-selection.md) を参照。

| 目的 | 優先 source |
|------|------------|
| 近代以降の図書・雑誌 | `ndl_catalog` → `ndl_digital` → `cinii_books` |
| 論文・紀要 | `cinii_articles` → `jstage_articles` → `ndl_articles` → `irdb` |
| 古い雑誌記事 | `ndl_articles` → `ndl_digital` |
| 本文中の語を探す | `jp_lit_search_fulltext` → `jp_lit_search_pages` |
| 図版・挿絵 | `jp_lit_search_illustrations` → `japan_search` |
| 所蔵確認 | `ndl_catalog` → `cinii_books`（holdings） |
| 人文専門DB横断（詳細） | `nihu_bridge`（横断検索にも含まれる）|
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

検索を開始する前に、使う source とその理由をユーザーに伝える。

- **quick**: いきなり横断検索しない。必要なら 1 問だけ確認するか、「まずは〇〇 source から見ます」と小さく始める
- **standard / deep**: 使う source・検索語の展開・理由を提示し、ユーザーが方針を調整できる余地を作る

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

ユーザーが「進めて」「そのままで」などと応じた場合はそのまま実行する。`quick` でも、曖昧なら最小限の確認を優先する。

各 DB の特性・選択理由は [heuristics/db-characteristics.md](heuristics/db-characteristics.md) を参照。
方針提示時、またはユーザーに「なぜそのDBか」と問われたときは、そのDBの特性を具体的に説明する。

---

## Step 6: 検索する（MCP を使う）

- メタデータ検索が先。全文検索は後。
- `research_guide` intent では、必要に応じて先に `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases` を使い、そこで得た語・参考資料・探索手順を実検索へつなぐ。
- `jp_lit_search` → 候補がなければ `jp_lit_search_fulltext` → ページ特定は `jp_lit_search_pages` → OCR確認は `jp_lit_get_text_coordinates`
- `ndl_digital` で `jp_lit_get_record` を呼ぶ際、`source_metadata.next_digital_library.available` を確認してから OCR 系ツールを使う。
- **ページネーション:** `jp_lit_search` は1回最大100件。レスポンスの `total` が取得件数を超える場合、`page=2, 3...` と追加取得できる。deep 調査では各 source 最大200件程度まで取得を検討する。結果報告には必ず「全N件中M件取得」を明記すること。

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

## Step 7: 選別過程を明示して報告する

詳細は [heuristics/evidence-grading.md](heuristics/evidence-grading.md) を参照。

結果は **確認済み / 有力候補 / 弱い候補** の3段階に分けて報告する。OCR ヒットのみで内容を断定しない。

**選別過程は必ず出力すること。** 以下を明記する：
- 各 source から何件取得したか
- どの基準で候補を絞ったか（関連性・重複・信頼性など）
- 除外したものがあればその理由

ユーザーが「全部見せて」「選ばれなかったものも見たい」「生データを見せて」と求めた場合は、選別前の全件リストを **パース済みの共通スキーマ（SearchItem / RecordItem）ベース** で開示してよい。`raw` や OCR 全文 JSON をそのまま貼り付けるのではなく、必要な項目だけ抜粋して示す。

---

## 禁止ルール

- 最初から全 source 横断しない（ノイズが増える）
- OCR ヒットだけで本文内容を断定しない
- 表記ゆれ・旧字を試さずに「見つからない」と言わない
- NDL Search / デジコレ / 次世代デジコレを同一と扱わない
- Japan Search を既定横断として使いすぎない（文化財・美術・地域資料に限定）
- レファ協の回答を一次情報として扱わない（導線として使う）
- `ndl_articles_online` の getRecord は常に null（既知の制約）

---

## 詳細リファレンス

- [workflows/bibliography-lookup.md](workflows/bibliography-lookup.md) — 所蔵・書誌調査
- [workflows/topic-literature-review.md](workflows/topic-literature-review.md) — テーマ文献探索
- [workflows/historical-term-search.md](workflows/historical-term-search.md) — 古語・表記ゆれ
- [workflows/fulltext-page-lookup.md](workflows/fulltext-page-lookup.md) — 全文・ページ特定・OCR
- [workflows/image-illustration-search.md](workflows/image-illustration-search.md) — 図版・挿絵
- [workflows/research-guide-lookup.md](workflows/research-guide-lookup.md) — 調べ方を調べる
- [heuristics/source-selection.md](heuristics/source-selection.md) — DB選択ルール詳細
- [heuristics/query-expansion.md](heuristics/query-expansion.md) — 検索語展開
- [heuristics/evidence-grading.md](heuristics/evidence-grading.md) — 典拠評価
- [heuristics/failure-modes.md](heuristics/failure-modes.md) — 見つからない時の対処
- [heuristics/db-characteristics.md](heuristics/db-characteristics.md) — DB特性・選択理由
- [heuristics/clarifying-questions.md](heuristics/clarifying-questions.md) — 問い返しガイダンス
