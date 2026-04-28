# 見つからない時の対処（failure_modes）

## 「見つからない」と言う前に確認すること

依頼の intent に関係するものを試してから「見つからない」を報告する。すべての source を一律に試す必要はない。

```
共通チェック:
- [ ] 表記ゆれ・旧字体・旧仮名遣いを必要に応じて試したか（query-expansion.md）
- [ ] 目的に合う複数の source を試したか（source-selection.md）
- [ ] 検索語を広げる/狭める両方向を試したか

intent別チェック:
- bibliography_lookup: ndl_catalog / cinii_books / ndl_digital を確認したか
- topic_literature_review: cinii_articles / jstage_articles / ndl_articles / irdb を確認したか
- historical_term_search: nihu_bridge（normalize=true）と旧字・旧仮名を試したか
- fulltext_page_lookup: jp_lit_search_fulltext / jp_lit_search_pages を確認したか
- image_illustration_search: jp_lit_search_illustrations / japan_search を確認したか
- research_guide: リサーチ・ナビ / レファ協 / 分野別DBの導線を確認または未確認として明示したか
```

---

## 状況別の次の手

### A. 書誌情報が不確か（タイトル・著者・年が曖昧）

1. 確実な情報だけで絞り込む（著者名だけ、キーワードだけ）
2. 発行年に幅を持たせる（前後5年）
3. `ndl_digital` + 全文検索で本文から書誌を逆引き

### B. 古い時代の資料が見つからない

1. 旧字体・旧仮名遣いで再検索
2. `nihu_bridge` で異体字同定検索
3. `ndl_digital` + `jp_lit_search_fulltext` で全文横断
4. NDL に未所蔵の場合 → 専門図書館（ディープライブラリー）を案内

### C. 論文・紀要が見つからない

1. `irdb` を明示的に検索（機関リポジトリ）
2. `nihu_bridge` で人文学専門 DB 横断
3. `jstage_articles` で理工系・医学系の紀要も確認
4. Google Scholar / CiNii Research Web 直接検索を案内（MCP 外）

### D. OCR 全文でヒットしない

1. 表記ゆれ・旧字を試す
2. `searchfield=metaonly` で書誌検索に切り替える
3. 近接検索的なアプローチ（複数語を組み合わせる）
4. より上位語・関連語で検索する

### E. 資料はあるが本文を読めない

```
jp_lit_get_record(source=ndl_digital) の
source_metadata.next_digital_library を確認:
  - available=true → jp_lit_get_text_coordinates / jp_lit_get_fulltext 使用可
  - available=false + reason=not_indexed → 次世代デジコレ未収録
  - available=false + reason=not_public → 館内/図書館送信資料
```

館内限定資料の場合は NDL 本館・図書館送信参加館への来館を案内する。

---

## 「見つからない」報告のテンプレート

手を尽くしても見つからなかった場合は、調査過程を正直に報告する。「わからない」も重要な回答。

```
【調査結果: 該当資料が見つかりませんでした】

試した source:
- ndl_catalog: 0件
- cinii_articles: 0件
- ...

試した検索語:
- 〇〇（ヒットなし）
- △△（ヒットなし）
- □□（別資料がヒットしたが該当なし）

可能性として考えられること:
- NDL 未所蔵の資料の可能性
- 検索語の表記ゆれが網羅できていない可能性
- デジタル化未済みの資料の可能性

次の手として:
- 〇〇専門の図書館（例: ○○文庫）への問い合わせ
- リサーチ・ナビ「〇〇の調べ方」を参照
- レファ協（https://crd.ndl.go.jp/reference/）で類似事例を探す
```
