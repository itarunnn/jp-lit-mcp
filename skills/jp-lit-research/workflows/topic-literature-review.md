# テーマ文献探索ワークフロー（topic_literature_review）

## 対象となる依頼

- 「〇〇に関する論文・図書を集めたい」
- 「このテーマの文献リストを作りたい」
- 「〇〇を研究するにあたって読むべき文献は？」
- 「〇〇分野の一次資料と二次文献をまとめたい」

---

## フロー

### Step 1: 調査前情報収集

advisory-consultation.md を参照。テーマ文献探索では、原則としてレファ協とリサーチ・ナビを検索計画の材料にする。特に以下のいずれかに該当する場合は省略しない:
- テーマが人文専門寄り・資料種別が曖昧・関連語展開が重要
- 表記ゆれが疑われる（→ [historical-term-search.md](historical-term-search.md) も参照）
- 人名単独、回想記事、雑誌目次、一般誌記事、初出、掲載号探索が絡む
- 初手の `ndl_search` / `japan_search` / 専門 DB / 個別 source で 0 件またはノイズ過多になった

### Step 2: 調査計画を提示してユーザーと確認する

ドメイン・資料種別に基づき、初手の source セットを提示する。
ユーザーの返答に応じて source を増減し、確認後に検索を開始する。

**初手の推奨 source（調整の出発点）:**
- 既定セット: ndl_search / japan_search
- 論文: cinii_articles / jstage_articles / ndl_articles
- 図書: ndl_catalog / cinii_books
- リポジトリ（紀要・学位論文）: irdb（必要に応じて提案）

初手で実行する source は、`ndl_search` と `japan_search` を基礎候補にする。レファ協・リサーチ・ナビで示唆された専門 DB / source と、資料種別に応じた論文・図書系 source を追加して優先順位を決める。
レファ協・リサーチ・ナビから得た索引名、参考図書、総目次、データベース名、検索語候補は、MCP の `source` と混同せず、`reference_tools` と `検索語候補` として計画に反映する。参考図書・専門索引・有料 DB が示唆された場合は、無料オンラインで完結しない可能性を前提に、`参考書誌確認` / `要有料DB確認` として強めに次アクションへ出す。

**「もっと広く」「網羅的に」とユーザーが言ったら追加で提案する:**
- nihu_bridge（人文専門 DB 横断：国文研・国民博など 100+ DB）
- jp_lit_search_fulltext（全文横断）
- jdcat（研究データ）
- kokkai_minutes / teikoku_minutes（会議録。法令・議会資料が必要な場合）

**「ざっくりでいい」「まず概要だけ」とユーザーが言ったら:**
- `jp_lit_search(source=ndl_search)` と `jp_lit_search(source=japan_search)` から始める
- getRecord は呼ばず、SearchItem のメタデータのみで報告する
- 所蔵・PDF リンク・nihu_bridge が必要になったら個別 source へ移行する

### Step 3: 確認後に検索実行

提案した source を順番に検索する。`ndl_search` と `japan_search` は初手で実行し、以下の追加候補は計画に応じて実行する。

```
jp_lit_search(source=ndl_search, query=テーマ, limit=20)
jp_lit_search(source=japan_search, query=テーマ, limit=20)
jp_lit_search(source=cinii_articles, query=テーマ, limit=20)
jp_lit_search(source=jstage_articles, query=テーマ, limit=20)
jp_lit_search(source=ndl_articles, query=テーマ, limit=20)
jp_lit_search(source=ndl_catalog, query=テーマ, limit=20)
jp_lit_search(source=cinii_books, query=テーマ, limit=20)
```

### Step 4: 候補を選別

- 重複を除く（同一論文が複数 source にヒットする場合がある）
- 内容別・論点別の分類、必要時の立場別分類、読む順番の仮整理をしてよい。ただし、本文未読の場合は `仮整理` とし、根拠を明示する
- 関連性、資料種別、出版社・媒体、著者属性、引用・書評状況、刊行時期、確認レベルを手がかりに、調査上の確認優先度を仮に付ける
- `優先` は文献価値の確定ではなく確認順である。出版社・媒体だけで候補を切り捨てない
- 絞った候補の書誌詳細を取得
  ```
  jp_lit_get_record(source=..., source_id=...) × 候補件数分
  ```
- 代表文献候補・引用候補に格上げする前に、本文確認、要旨確認、目次確認、または学術書評・引用状況などの強い二次根拠を確認する

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
- `仮整理` / `優先` / `根拠` / `確認` / `本文` / `次` を必要に応じて短く添える
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
2. 候補はフラットに並べず、確認優先度を仮に付ける
3. 本文未読の内容別・論点別分類、必要時の立場別分類は `仮整理` とし、根拠を示す
4. 査読論文・学術論文・研究書・一次資料・同時代証言は優先度が高くなりやすいが、出版社・媒体だけで価値確定しない
5. OCR 全文ヒットのみの候補は「有力」として別枠にし、ページ画像確認や本文確認へ進める
6. 典拠評価の詳細は [heuristics/evidence-grading.md](../heuristics/evidence-grading.md) を参照

---

## 報告テンプレート

```
【文献リスト】テーマ: 〇〇

▍確認済み文献（書誌確認済み）
1. タイトル / 著者 / 掲載誌or出版社 / 出版年 / source（DB名）/ source_id / URL（あれば）
   - 仮整理: <探索上の位置づけ>
   - 優先: <高 / 中 / 低 / 保留>
   - 根拠: <本文 / 要旨 / 目次 / 書評 / 出版社紹介など>
   - 確認: <書誌 / 要旨 / 目次 / 本文> / 本文: <状態> / 次: <次アクション>
2. ...

▍有力候補・本文未読の仮整理
1. ...

▍書評・受容・論争状況の候補
1. ...

▍検索・選別過程
- 検索した source と取得件数（source別）: 
- 検索語（展開済み含む）: 
- 選別基準: （例: テーマへの関連性・重複除去・資料種別・出版社/媒体・著者属性・引用/書評状況・出版年・確認レベル）
- 除外したものとその理由: 

▍未調査・不足
- 以下は今回検索していない: 
```
