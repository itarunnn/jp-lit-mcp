# 見つからない時の対処（failure_modes）

## 「見つからない」と言う前に確認すること

依頼の intent に関係するものを試してから「見つからない」を報告する。すべての source を一律に試す必要はない。

```
共通チェック:
- [ ] 表記ゆれ・旧字体・旧仮名遣いを必要に応じて試したか（query-expansion.md）
- [ ] 目的に合う複数の source を試したか（source-selection.md）
- [ ] 検索語を広げる/狭める両方向を試したか
- [ ] 難航時にレファ協・リサーチ・ナビで、別の資料類型・索引・調査順序を確認したか

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

### C2. 一般誌・新聞記事や参考書誌側の確認が必要

1. `ndl_articles` / `ndl_articles_online` で雑誌記事索引を確認
2. `ndl_search` / `ndl_catalog` で誌名、巻号、所蔵、特集名の手がかりを確認
3. レファ協（`jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases`）で、総目次・年鑑・索引・類似質問の導線を確認する
4. リサーチ・ナビで「雑誌の総目次・バックナンバー」「人物・伝記文献」など近い調べ方ページを確認する
5. 著者名、誌名、事件名、特集名、年代で検索語を作り直す
6. それでも一般誌・新聞側の欠落がありそうなら、`参考書誌確認` または `要有料DB確認` として確認先と検索語を提案する

参考書誌・有料DB用の検索語は、MCP の検索結果から得た語を人間が参考書誌、索引、契約 DB で試しやすい形にする。

```
参考書誌確認:
- 雑誌総目次・年鑑・専門索引: "誌名" "特集名" "年代"

要有料DB確認:
- ざっさくプラス: "主題語" AND "誌名または著者名"
- 大宅壮一文庫: "人物名" / "事件名" / "流行語"
- 新聞系 DB: "事件名" "年月" "地名"
```

この注意は毎回出さない。参考書誌・索引・一般誌・新聞・戦後以降のメディア言説が調査目的に関係する場合だけ出す。

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
  - available=false + reason=not_available_in_next_digital_library → OCR 系ツール利用不可（実務上は次世代側未収録であることが多いが、アクセス制限・上流都合などとの厳密な区別はしていない）
```

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
