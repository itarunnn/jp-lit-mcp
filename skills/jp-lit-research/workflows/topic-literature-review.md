# テーマ文献探索ワークフロー（topic_literature_review）

## 対象となる依頼

- 「〇〇に関する論文・図書を集めたい」
- 「このテーマの文献リストを作りたい」
- 「〇〇を研究するにあたって読むべき文献は？」
- 「〇〇分野の一次資料と二次文献をまとめたい」

---

## 検索深度別フロー

### quick（概要把握・書誌詳細なし）

```
# 1. NDL モード（広域・1リクエスト）
jp_lit_search(source=ndl_search, query=テーマ)

# 2. LLM が候補を選別してユーザーに提示
→ getRecord は呼ばない。SearchItem のメタデータのみで報告
```

NDL モードのカバー範囲: NDL 系 4 source ＋ CiNii / J-STAGE / IRDB（ハーベスト済み・情報は薄め）＋ 地方アーカイブ・青空文庫・JPRO 等 100 機関以上。nihu_bridge は対象外。
所蔵・PDF リンク・nihu_bridge が必要になったら standard へ移行する。

### standard（source別に丁寧に）

```
# 0. 調査前情報収集（advisory-consultation.md を参照）
jp_lit_search_guides_manuals(query=テーマ, limit=3)
jp_lit_search_guides_cases(query=テーマ, limit=3)
→ ドメインに対応するリサーチ・ナビ URL を WebFetch
→ 得られたキーワード・DB候補・調査手順を以降の検索に反映

# 1. source 別に検索
jp_lit_search(source=cinii_articles, query=テーマ, limit=20)
jp_lit_search(source=jstage_articles, query=テーマ, limit=20)
jp_lit_search(source=ndl_articles, query=テーマ, limit=20)
jp_lit_search(source=ndl_catalog, query=テーマ, limit=20)
jp_lit_search(source=cinii_books, query=テーマ, limit=20)
jp_lit_search(source=irdb, query=テーマ, limit=20)

# 2. LLM が候補を絞る（関連性・重複除去・信頼性で選別）
→ ユーザーに見せる候補を10〜20件程度に絞る

# 3. 絞った候補だけ書誌詳細を取得
jp_lit_get_record(source=..., source_id=...) × 候補件数分
```

表記ゆれが疑われる場合は [historical-term-search.md](historical-term-search.md) を先に実施。

### deep（網羅的）

```
# 0. 調査前情報収集（advisory-consultation.md を参照）
jp_lit_search_guides_manuals(query=テーマ, limit=5)
jp_lit_search_guides_cases(query=テーマ, limit=5)
→ ドメインに対応するリサーチ・ナビ URL を WebFetch
→ 得られたキーワード・DB候補・調査手順を以降の検索に反映

# 1. standard と同じ source 別検索（limit を大きめに）
# 2. 追加 source
jp_lit_search_fulltext(keyword=テーマ)        ← 全文横断
jp_lit_search(source=nihu_bridge, query=テーマ) ← 人文専門DB
jp_lit_search(source=jdcat, query=テーマ)      ← 研究データ
jp_lit_search(source=kokkai_minutes, query=テーマ) ← 必要な場合
jp_lit_search(source=teikoku_minutes, query=テーマ) ← 必要な場合

# 3. LLM が候補を選別（基準は甘め：迷ったら残す）
→ 関連性が低いと断言できるものだけ除外
→ 有力・弱い候補も落とさず「有力候補」枠に残す

# 4. 選別済み候補の getRecord
jp_lit_get_record(source=..., source_id=...) × 候補件数分

# 5. 重要な一次資料はページ特定まで
jp_lit_search_pages(pid=..., keyword=テーマ)
```

「見つからない」場合は [failure-modes.md](../heuristics/failure-modes.md) へ。

**選別過程の記述（deep では特に詳しく）:**
- source ごとの取得件数・ヒット件数
- 採用・除外の判断とその根拠を1件ずつ明記
- 迷った候補は「有力候補」として残し、迷った理由も記載
- 除外したものは除外リストとして別掲

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
