# テーマ文献探索ワークフロー（topic_literature_review）

## 対象となる依頼

- 「〇〇に関する論文・図書を集めたい」
- 「このテーマの文献リストを作りたい」
- 「〇〇を研究するにあたって読むべき文献は？」
- 「〇〇分野の一次資料と二次文献をまとめたい」

---

## フロー

### Step 1: 調査前情報収集（必要な場合）

advisory-consultation.md を参照。以下のいずれかに該当する場合に実行する:
- テーマが人文専門寄り・資料種別が曖昧・関連語展開が重要
- 表記ゆれが疑われる（→ [historical-term-search.md](historical-term-search.md) も参照）

### Step 2: 調査計画を提示してユーザーと確認する

ドメイン・資料種別に基づき、初手の source セットを提示する。
ユーザーの返答に応じて source を増減し、確認後に検索を開始する。

**初手の推奨 source（調整の出発点）:**
- 論文: cinii_articles / jstage_articles / ndl_articles
- 図書: ndl_catalog / cinii_books
- リポジトリ（紀要・学位論文）: irdb（必要に応じて提案）

**「もっと広く」「網羅的に」とユーザーが言ったら追加で提案する:**
- nihu_bridge（人文専門 DB 横断：国文研・国民博など 100+ DB）
- jp_lit_search_fulltext（全文横断）
- jdcat（研究データ）
- kokkai_minutes / teikoku_minutes（会議録。法令・議会資料が必要な場合）

**「ざっくりでいい」「まず概要だけ」とユーザーが言ったら:**
- `jp_lit_search(source=ndl_search)` から始める（NDL モード：100 機関以上を 1 リクエストで横断）
- getRecord は呼ばず、SearchItem のメタデータのみで報告する
- 所蔵・PDF リンク・nihu_bridge が必要になったら個別 source へ移行する

### Step 3: 確認後に検索実行

提案した source を順番に検索する。

```
jp_lit_search(source=cinii_articles, query=テーマ, limit=20)
jp_lit_search(source=jstage_articles, query=テーマ, limit=20)
jp_lit_search(source=ndl_articles, query=テーマ, limit=20)
jp_lit_search(source=ndl_catalog, query=テーマ, limit=20)
jp_lit_search(source=cinii_books, query=テーマ, limit=20)
```

### Step 4: 候補を選別

- 重複を除く（同一論文が複数 source にヒットする場合がある）
- 関連性・査読有無・出版年で評価
- 絞った候補の書誌詳細を取得
  ```
  jp_lit_get_record(source=..., source_id=...) × 候補件数分
  ```

### Step 5: 深掘り（必要な場合）

有力な一次資料が見つかった場合、全文・ページ特定まで追うか確認する:
```
jp_lit_search_fulltext(keyword=テーマ)        ← 全文横断
jp_lit_search_pages(pid=..., keyword=...)    ← ページ特定
```

### Step 6: 選別過程を明示して報告

**選別過程は必ず明記する（特に source が多い場合）:**
- source ごとの取得件数・ヒット件数
- 採用・除外の判断とその根拠
- 迷った候補は「有力候補」として残し、迷った理由も記載
- 除外したものは除外リストとして別掲

「見つからない」場合は [failure-modes.md](../heuristics/failure-modes.md) へ。

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
1. タイトル / 著者 / 掲載誌or出版社 / 出版年 / source（DB名）/ source_id / URL（あれば）
2. ...

▍有力候補（未書誌確認）
1. ...

▍検索・選別過程
- 検索した source と取得件数（source別）: 
- 検索語（展開済み含む）: 
- 選別基準: （例: テーマへの関連性・重複除去・査読有無・出版年）
- 除外したものとその理由: 

▍未調査・不足
- 以下は今回検索していない: 
```
