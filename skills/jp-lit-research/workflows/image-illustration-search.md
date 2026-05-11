# 図版・挿絵検索ワークフロー（image_illustration_search）

## 対象となる依頼

- 「〇〇の挿絵・図版を探したい」
- 「デジコレの画像・図版をキーワードで検索したい」
- 「ある図版が含まれる資料を知りたい」
- 「浮世絵・美術図版を探している」

---

## ツール早見表

| 目的 | ツール / source |
|------|---------------|
| デジコレ全資料の図版をキーワード検索 | `jp_lit_search_illustrations` |
| 国書DBの画像タグを検索 | `jp_lit_search_kokusho_image_tags` |
| 図版を含む資料ページの画像 URL | `jp_lit_get_text_coordinates` |
| 美術・文化財・博物館資料 | `jp_lit_search(source=japan_search)` |

---

## フロー A: 次世代デジタルライブラリーで図版検索

美術・文化財・博物館資料・地域資料が絡む場合は、実検索前に [heuristics/advisory-consultation.md](../heuristics/advisory-consultation.md) を使い、レファ協・リサーチ・ナビから見るべき所蔵機関、資料類型、外部ポータル、検索語候補を確認する。

インターネット公開済み資料の図版（約860万点）をテキストキーワードで検索できる。

```
jp_lit_search_illustrations(keyword="〇〇", size=20)
→ items[].illustration_image_url → IIIF トリミング画像（直接表示可）
→ items[].pid + page で詳細確認
→ items[].graphictags で図版の種別タグ確認
```

### 図版の位置・サイズ

- `items[].x`, `y`, `w`, `h` はページ全体に対する % 座標
- `illustration_image_url` は IIIF `pct:x,y,w,h` で図版部分だけトリミングした URL

### 周辺テキスト確認

```
jp_lit_get_text_coordinates(source=ndl_digital, pid=items[].pid, page=items[].page)
→ contents でキャプション・周辺テキスト確認
→ page_image_url でページ全体の画像確認
```

---

## フロー B: Japan Search（美術・文化財）

美術品・博物館所蔵資料・文化財は Japan Search が有効。

```
jp_lit_search(source=japan_search, query="〇〇")
jp_lit_get_record(source=japan_search, source_id=...)
→ source_metadata に元機関の URI が含まれることがある
```

---

## フロー B2: 国書DBの画像タグ検索

古典籍・国書DBの挿絵タグや図像タグを探す依頼では、国書DB専用 tool を使う。

```
jp_lit_search_kokusho_image_tags(keyword="〇〇", limit=20)
→ items[].bid / items[].koma / items[].tag_texts / items[].viewer_url を確認
→ 画像本体は取得しない。必要なら公式画面で確認
```

---

## フロー C: キーワードが難しい場合

1. 現代語 → ヒットしない場合は [historical-term-search.md](historical-term-search.md) で語を展開
2. 図版種別タグ（`graphictags`）を参考にキーワードを変える
3. `jp_lit_search_fulltext` でキャプションテキストを全文検索してから `jp_lit_search_pages` でページ特定 → `jp_lit_get_text_coordinates` で図版周辺を確認

---

## 注意点

- `jp_lit_search_illustrations` の対象は **インターネット公開済み資料のみ**（館内限定資料は含まない）
- OCR キャプションが誤認識されている場合、キーワードがヒットしないことがある → 別の語で試す
- 浮世絵・美術画像は Japan Search / ARC浮世絵ポータル（外部 DB）が充実している（MCP 外）
- `illustration_image_url` は認証不要で直接表示できる

---

## 報告テンプレート

```
【図版検索結果】
- 検索語: 
- ヒット件数: 
- 代表的な図版:
  - id: PID_page_index
  - 資料: タイトル (source=ndl_digital / pid=...)
  - ページ: N ページ
  - 画像 URL: illustration_image_url
  - 図版タグ: graphictags

【確認方法】
- illustration_image_url で目視確認済み: 確認済み
- キーワードヒットのみ（未目視）: 有力候補
```
