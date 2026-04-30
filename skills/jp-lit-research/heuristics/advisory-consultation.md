# 調査前情報収集（advisory-consultation）

standard / deep 調査の開始時に実行する。source 選択・検索語展開・方針提示（Step 3〜5）の前。
**quick では実行しない。**

---

## 手順

### 1. レファ協を確認する

```
jp_lit_search_guides_manuals(query=テーマ, limit=3)
jp_lit_search_guides_cases(query=テーマ, limit=3)
```

読むべき箇所:
- `search_keywords` / `guide_headings` → Step 4（検索語展開）の候補に追加
- `reference_sources` → Step 3（source 選択）の補強材料
- `answer_process` → 調査順序・着眼点の参考

### 2. リサーチ・ナビを確認する（WebFetch）

ドメインを判定して、下記テーブルから最も近い URL を WebFetch する。
対応する URL がなければ `https://ndlsearch.ndl.go.jp/rnavi/humanities/` のインデックスを fetch して関連ガイドを探す。

| ドメイン | URL |
|---------|-----|
| 人文（全般・入口） | https://ndlsearch.ndl.go.jp/rnavi/humanities/ |
| 雑誌の総目次・バックナンバー | https://ndlsearch.ndl.go.jp/rnavi/humanities/post_559 |
| 文学作品の初出・書誌確認 | https://ndlsearch.ndl.go.jp/rnavi/humanities/post_101094 |
| 人物・伝記文献 | https://ndlsearch.ndl.go.jp/rnavi/humanities/post_101121 |
| 美術・浮世絵・図版 | https://ndlsearch.ndl.go.jp/rnavi/humanities/post_697 |
| 宗教・仏教・大蔵経 | https://ndlsearch.ndl.go.jp/rnavi/humanities/post_101024 |

読むべき箇所:
- 推奨する索引・参考図書・DB → Step 3（source 選択）に反映
- 調査上の注意点・手順 → Step 5（方針提示）に含める

### 3. 結果を Step 5（方針提示）に組み込む

1・2 で得た情報を踏まえて source 選択・検索語展開・調査順序を決め、Step 5 でユーザーに提示する。

提示テンプレート（方針の冒頭に含める）:
```
▍調査前情報収集
- レファ協の類似事例: 〇〇（着眼点: ...）
- レファ協で得たキーワード候補: ...
- リサーチ・ナビの推奨調査順序: ...
```

---

## 結果がない場合

- レファ協でヒット 0 件: 上位語・類義語でリトライし、それでもなければスキップ
- リサーチ・ナビに対応ページなし: インデックス（`rnavi/humanities/`）から近い分野のページを fetch する。見つからなければスキップ
