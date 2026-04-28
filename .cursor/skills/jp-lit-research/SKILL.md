---
name: jp-lit-research
description: >-
  日本語人文社会系文献調査スキル。jp-lit MCP サーバーを使って NDL・CiNii・J-STAGE・IRDB・JDCat・NIHU Bridge・国会会議録などを横断検索し、
  書誌確認・所蔵調査・テーマ文献探索・古語表記ゆれ検索・デジコレ全文OCR・図版検索を行う。
  「文献を探して」「〇〇について調べて」「この本はどこにある」「古い語で探して」「デジコレで全文検索して」「図版や挿絵を探して」「調べ方がわからない」
  という依頼で使用する。NDL Search / NDL デジタルコレクション / CiNii / J-STAGE / Japan Search / 次世代デジタルライブラリーに関わる調査すべてに適用する。
---

# 日本語文献調査スキル（jp-lit-research）

このスキルは jp-lit MCP（`jp_lit_search` / `jp_lit_get_record` / `jp_lit_get_fulltext` / `jp_lit_search_fulltext` / `jp_lit_search_pages` / `jp_lit_get_text_coordinates` / `jp_lit_search_illustrations`）を使った日本語人文社会系文献調査の作法を定義する。

**MCP は検索・取得に徹する。調査戦略・DB選択・検索語展開・典拠評価はこのスキルが担う。**

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

---

## Step 2: 検索深度を決める

| 深度 | 基準 | 内容 |
|------|------|------|
| `quick` | 「ちょっと調べて」「参考程度に」 | 横断検索1回、上位10件 |
| `standard` | 「調べて」「探して」（明示なし） | source別検索、表記ゆれ2〜3種、書誌詳細取得 |
| `deep` | 「網羅的に」「論文・発表用に」「本気で」 | リサーチナビ確認→全source→全文→ページ特定、過程も報告 |

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

---

## Step 4: 検索語を展開する

人文社会系では現代語のままでは不足することが多い。詳細は [heuristics/query-expansion.md](heuristics/query-expansion.md) を参照。

**最低限やること:**
1. 表記ゆれ（送り仮名・カタカナ揺れ・旧仮名遣い）を2〜3種追加
2. 旧字・異体字を確認
3. 関連する上位語・下位語を1つずつ加える

---

## Step 5: 検索する（MCP を使う）

- メタデータ検索が先。全文検索は後。
- `jp_lit_search` → 候補がなければ `jp_lit_search_fulltext` → ページ特定は `jp_lit_search_pages` → OCR確認は `jp_lit_get_text_coordinates`
- `ndl_digital` で `jp_lit_get_record` を呼ぶ際、`source_metadata.next_digital_library.available` を確認してから OCR 系ツールを使う。
- **ページネーション:** `jp_lit_search` は1回最大100件。レスポンスの `total` が取得件数を超える場合、`page=2, 3...` と追加取得できる。deep 調査では各 source 最大200件程度まで取得を検討する。結果報告には必ず「全N件中M件取得」を明記すること。

---

## Step 6: 典拠を評価して報告する

詳細は [heuristics/evidence-grading.md](heuristics/evidence-grading.md) を参照。

結果は **確認済み / 有力候補 / 弱い候補** の3段階に分けて報告する。OCR ヒットのみで内容を断定しない。

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
