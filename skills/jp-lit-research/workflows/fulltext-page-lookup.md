# 全文・ページ特定・OCR ワークフロー（fulltext_page_lookup）

## 対象となる依頼

- 「この語がデジコレのどのページに出るか調べたい」
- 「〇〇という表現が使われている資料を全文から探したい」
- 「OCR でページの文字を取得したい」
- 「ページ画像の URL を取得したい」

---

## ツール早見表

| 目的 | ツール |
|------|--------|
| デジコレ全資料から全文横断検索 | `jp_lit_search_fulltext` |
| 特定資料内のページ検索 | `jp_lit_search_pages` |
| 特定ページの OCR テキスト + 画像 URL | `jp_lit_get_text_coordinates` |
| 資料全ページの OCR テキスト一括取得 | `jp_lit_get_fulltext` |

---

## フロー A: キーワードから全文横断検索 → ページ特定

```
1. jp_lit_search_fulltext(keyword="〇〇", size=20)
   → items[].pid 取得（インターネット公開済み、available 確認不要）
   → items[].highlights で文脈確認

2. 特定資料のページを絞る
   jp_lit_search_pages(source=ndl_digital, pid=..., keyword="〇〇", size=20)
   → items[].page でページ番号取得

3. ページ画像・OCR 座標を取得
   jp_lit_get_text_coordinates(source=ndl_digital, pid=..., page=N)
   → page_image_url で画像確認
   → contents で OCR テキスト確認
```

---

## フロー B: 書誌からデジコレ → OCR（source_id 経由）

```
1. jp_lit_search(source=ndl_digital, query=...)
   → source_id 取得

2. jp_lit_get_record(source=ndl_digital, source_id=...)
   → source_metadata.next_digital_library を確認
   → available=true のみ次へ進む（false なら OCR 利用不可）

3. jp_lit_get_text_coordinates(source=ndl_digital, source_id=..., page=N)
   または
   jp_lit_search_pages(source=ndl_digital, source_id=..., keyword="〇〇")
```

---

## フロー C: 資料全文を一括取得

```
jp_lit_get_fulltext(source=ndl_digital, pid=... または source_id=...)
→ pages[].contents で全ページ OCR テキスト
→ 大きな資料は pages[] が長くなるため、必要なページだけ
  jp_lit_get_text_coordinates で取得する方が効率的
```

---

## OCR の限界と確認方法

- OCR は誤認識を含む。重要な箇所は必ず `jp_lit_get_text_coordinates` の `page_image_url` で画像確認する
- `coordjson` は IIIF フルサイズ画像のピクセル座標。縮小表示時はスケーリングが必要
- 全文検索ヒットだけで「この資料に〇〇が書かれている」と断定しない
- `jp_lit_search_fulltext` の絞り込み: `f_ndc`（NDC分類）/ `fc_is_classic`（古典籍）

---

## 報告テンプレート

```
【全文検索結果】
- 検索語: 
- ヒット資料数: 
- 確認資料: source=ndl_digital / pid=... / タイトル=...

【ページ特定】
- ヒットページ: N ページ
- OCR 抜粋: 「...」
- ページ画像 URL: https://dl.ndl.go.jp/api/iiif/...

【典拠強度】
- OCR確認のみ: 有力（誤認識の可能性あり）
- 画像で目視確認済み: 確認済み
```
