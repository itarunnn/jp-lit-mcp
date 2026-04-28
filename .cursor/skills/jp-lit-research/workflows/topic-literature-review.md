# テーマ文献探索ワークフロー（topic_literature_review）

## 対象となる依頼

- 「〇〇に関する論文・図書を集めたい」
- 「このテーマの文献リストを作りたい」
- 「〇〇を研究するにあたって読むべき文献は？」
- 「〇〇分野の一次資料と二次文献をまとめたい」

---

## 検索深度別フロー

### quick（10件程度、概要把握）

```
jp_lit_search(query=テーマ, limit=10)   ← source 未指定で横断
→ 上位10件を提示
```

横断検索の既定対象: `ndl_catalog` / `ndl_digital` / `ndl_articles` / `ndl_articles_online` / `cinii_articles` / `cinii_books` / `jstage_articles`

### standard（source別に丁寧に）

```
# 論文
jp_lit_search(source=cinii_articles, query=テーマ, limit=20)
jp_lit_search(source=jstage_articles, query=テーマ, limit=20)
jp_lit_search(source=ndl_articles, query=テーマ, limit=20)

# 図書
jp_lit_search(source=ndl_catalog, query=テーマ, limit=20)
jp_lit_search(source=cinii_books, query=テーマ, limit=20)

# 機関リポジトリ（紀要・学位論文）
jp_lit_search(source=irdb, query=テーマ, limit=20)
```

表記ゆれが疑われる場合は [historical-term-search.md](historical-term-search.md) を先に実施。

### deep（網羅的）

1. standard を実施
2. `jp_lit_search_fulltext(keyword=テーマ)` で全文横断
3. 重要な一次資料があれば `jp_lit_search_pages` でページ特定
4. 人文専門 DB が必要なら `nihu_bridge`
5. 研究データが必要なら `jdcat`
6. 会議録・公文書が必要なら `kokkai_minutes` / `teikoku_minutes`
7. 「見つからない」場合は [failure-modes.md](../heuristics/failure-modes.md) へ

---

## source 選択の判断基準

| テーマの性質 | 優先 source |
|------------|------------|
| 近代以降の人文学・社会科学全般 | `cinii_articles` → `jstage_articles` → `ndl_articles` |
| 図書・単行本 | `ndl_catalog` → `cinii_books` |
| 紀要・学位論文・リポジトリ資料 | `irdb` |
| 人文学専門（日本語学・国文学・歴史・民俗等）| `nihu_bridge` |
| 研究データ・アンケート・統計 | `jdcat` |
| 法令・議会・官庁資料 | `kokkai_minutes` / `teikoku_minutes` |
| デジタル化一次資料 | `ndl_digital` → 全文は `jp_lit_search_fulltext` |

詳細は [heuristics/source-selection.md](../heuristics/source-selection.md) を参照。

---

## 結果の整理方針

1. 重複を除く（同一論文が複数 source にヒットする場合がある）
2. 査読論文・単行本 > 紀要 > 学位論文 > Web記事の順で信頼性が高い傾向
3. OCR 全文ヒットのみの候補は「有力」として別枠にする
4. 典拠評価の詳細は [heuristics/evidence-grading.md](../heuristics/evidence-grading.md) を参照

---

## 報告テンプレート

```
【文献リスト】テーマ: 〇〇

▍確認済み文献（書誌確認済み）
1. タイトル / 著者 / 掲載誌or出版社 / 出版年 / source_id / URL（あれば）
2. ...

▍有力候補（未書誌確認）
1. ...

▍検索過程
- 検索した source: 
- 検索語（展開済み含む）: 
- 検索件数: 全N件中M件取得（source別に記載）

▍未調査・不足
- 以下は今回検索していない: 
```
