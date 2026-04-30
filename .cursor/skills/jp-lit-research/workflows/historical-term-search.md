# 古語・表記ゆれ・異体字検索ワークフロー（historical_term_search）

## 対象となる依頼

- 「明治・大正・昭和初期の文献で探したい」
- 「旧字体・異体字が含まれる可能性がある」
- 「現代語で検索したがヒットしない」
- 「カタカナ外来語の当時の表記がわからない」

---

## 基本方針

人文社会系の文献では、現代語のまま検索するだけでは不十分なことが多い。**検索語展開を先に行ってから検索する**。

近代以前・旧字・別称・初出調査が絡む場合は、必要に応じて [heuristics/advisory-consultation.md](../heuristics/advisory-consultation.md) を使い、レファ協やリサーチ・ナビから別称・調査順序・参考索引を補う。

詳細な展開手順は [heuristics/query-expansion.md](../heuristics/query-expansion.md) を参照。

---

## フロー

### 1. 現代語で一度検索（ベースライン）

```
jp_lit_search(source=ndl_catalog, query=現代語)
jp_lit_search(source=ndl_digital, query=現代語)
jp_lit_search(source=cinii_articles, query=現代語)
```

ヒット数を確認。少ない・ゼロなら次へ。

### 2. 表記ゆれ候補を展開する

以下のカテゴリで候補語を列挙する（詳細は [query-expansion.md](../heuristics/query-expansion.md)):

```
カテゴリ例（近代語「職業婦人」の場合）:
  現代表記:  職業婦人
  関連語:    職業女性 / 婦人労働 / 女子職業
  旧字体:    婦人勞働
  上位語:    婦人問題 / 女子教育 / 労働問題
```

展開した語で個別に検索し、ヒットした語だけを採用する（LLM 推測の幻覚を避けるため、ヒット確認が必要）。

### 2.5 条件付きで調査前情報収集を使う

次のような場合は advisory-consultation を実行してよい。

- 現代語では何を旧表記に直すべきか見当がつかない
- 人名・事項の別称が多い
- 初出調査や古典籍調査で、どの索引・参考図書を先に見るべきか不明

この場合、レファ協 `manuals` / `cases` とリサーチ・ナビから

- 別称・類義語
- 参考索引
- 調査順序

を抽出し、その後の query 展開に反映する。

### 3. 旧字・異体字での検索

NIHU Bridge は `normalize: true`（デフォルト）で異体字同定をしてくれる:
```
jp_lit_search(source=nihu_bridge, query=現代語)
```

NDL 系は旧字・異体字を個別に試す:
```
jp_lit_search(source=ndl_digital, query=旧字形)
jp_lit_search_fulltext(keyword=旧字形)
```

### 4. デジコレ全文から古い表記を探す

```
jp_lit_search_fulltext(keyword=古い表記, fc_is_classic=true)
jp_lit_search_fulltext(keyword=古い表記)
```

ヒットした資料の `highlights` で文脈確認 → 有望なものに `jp_lit_search_pages` でページ特定。

### 5. 発行年の扱い

```
jp_lit_search(source=ndl_catalog, query=..., sort_by=issued_date, sort_order=asc)
```

現行 MCP の `jp_lit_search` には発行年範囲フィルターはない。NDL 系では `sort_by=issued_date` と検索結果の `issued_at` / `issued_at_label` / `facets.issued_years` を使って、結果側で年代を判定する。

---

## 検索語展開の優先度

| 優先度 | カテゴリ |
|--------|---------|
| 高 | 旧仮名遣い・旧字体 |
| 高 | カタカナ外来語の揺れ（末尾長音省略、濁点変異） |
| 中 | 漢語翻訳語・同義語 |
| 中 | 上位概念語 |
| 低 | 下位概念語（ノイズが増えやすい） |

---

## 報告テンプレート

```
【検索語展開】
- 元の語: 〇〇
- 試した語: （ヒットあり） / （ヒットなし）
- 採用した語: 

【検索結果】
- ヒット source: 
- 代表的な資料:
  - タイトル / 著者 / 出版年 / source_id

【典拠強度】確認済み / 有力 / 弱い
【未確認の可能性】表記ゆれの試行は網羅的ではない。以下は未試行: 
```
