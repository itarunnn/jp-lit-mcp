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
| 国書DB収録本文のスニペット検索 | `jp_lit_search_kokusho_fulltext` |
| 特定資料内のページ検索 | `jp_lit_search_pages` |
| 特定ページの OCR テキスト + 画像 URL | `jp_lit_get_text_coordinates` |
| 資料全ページの OCR テキスト一括取得 | `jp_lit_get_fulltext` |

---

## 複合語 query の扱い

- `jp_lit_search_fulltext` では空白 AND や `AND` 演算子を上流仕様として期待しない。`keyword` は分解せず上流 API へ渡される。
- 複合語 0 件を、両語が同一資料に存在しない証拠として扱わない。
- 人名・歴史語・表記ゆれを探す場合は、まず単独語で検索し、ヒット資料の highlights、ページ検索、本文 OCR、画像確認で文脈を確認する。
- `jp_lit_search_pages` は既知 PID 内の補助確認として使う。既知 PID で複合語が当たる場合があっても、全文横断検索の AND 仕様として一般化しない。
- 調査ログでは、単独語検索と複合語検索を分けて記録し、複合語 0 件の解釈を明示する。
- 実例: `キューリン` 単独では hit=25、`キューリン 博士` は hit=0 だった。複合語 0 件は不在証明ではなく、単独語検索と資料内確認へ戻す合図として扱う。

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

## フロー A2: 国書DB収録本文のスニペット検索

古典籍・国書DBの本文中の語を探す依頼では、デジコレ OCR ではなく国書DB専用 tool を使う。

```
jp_lit_search_kokusho_fulltext(keyword="〇〇", limit=20)
→ items[].bid / items[].koma / items[].snippet / items[].viewer_url を確認
→ 重要な箇所は viewer_url から公式画面で確認
```

この tool は本文全体を取得しない。スニペットだけで断定しない。

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
