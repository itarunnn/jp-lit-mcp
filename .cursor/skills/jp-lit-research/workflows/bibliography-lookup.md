# 所蔵・書誌調査ワークフロー（bibliography_lookup）

## 対象となる依頼

- 「この本は NDL にあるか」「どこの図書館に所蔵されているか」
- 「この論文の出版年・掲載誌を確認したい」
- 「初出はどの雑誌か」「書名の正式表記を確認したい」

---

## フロー

### 1. 図書・雑誌の所蔵確認

```
jp_lit_search(source=ndl_catalog, query=タイトル or 著者)
  → source_id 取得
jp_lit_get_record(source=ndl_catalog, source_id=...)
  → holdings / publisher / issued を確認
```

大学図書館所蔵も確認したい場合:
```
jp_lit_search(source=cinii_books, query=...)
jp_lit_get_record(source=cinii_books, source_id=...)
  → source_metadata.holdings[] で所蔵館一覧を取得
```

### 2. 雑誌記事・論文の書誌確認

```
jp_lit_search(source=cinii_articles, query=論文タイトル or 著者)
jp_lit_search(source=ndl_articles, query=...)
jp_lit_search(source=jstage_articles, query=...)
```

- `cinii_articles` → `journal_title` / `volume` / `issue` / `page`
- `ndl_articles` → `journal_title`（best-effort）、巻号は `source_metadata` のみ
- `jstage_articles` → `source_metadata.pdf_url` で PDF 直リンク

### 3. デジタルコレクション所蔵確認

```
jp_lit_search(source=ndl_digital, query=...)
jp_lit_get_record(source=ndl_digital, source_id=...)
  → source_metadata.next_digital_library.available を確認
  → available=true → OCR ツール利用可
  → available=false → 次世代デジタルライブラリー経由の OCR ツール利用不可（実務上は未収録であることが多いが、現実装では断定しない）
```

### 4. 初出調査

1. `jp_lit_search(source=ndl_articles, query=論文タイトル, sort_by=issued_date, sort_order=asc)`
2. `jp_lit_search(source=cinii_articles, query=..., sort_by=issued_date, sort_order=asc)`
3. ヒットしない場合 → `jp_lit_search_fulltext(keyword=...)` で全文から探す
4. さらに必要なら [historical-term-search.md](historical-term-search.md) へ

---

## 注意点

- `ndl_articles_online` は検索のみ。`jp_lit_get_record` は常に null（既知の制約）
- `cinii_books` の `holdings` に所蔵館情報が入る（`holding_count` で件数確認）
- 書名に表記ゆれがある場合は [query-expansion.md](../heuristics/query-expansion.md) を先に実施
- 「所蔵なし」だった場合も「確認したが所蔵なし」として記録して報告する

---

## 報告テンプレート

```
【書誌情報】
- タイトル: 
- 著者: 
- 出版者・掲載誌: 
- 出版年: 
- source: （ndl_catalog / cinii_books 等）
- source_id: 

【所蔵・公開状況】
- NDL所蔵: あり / なし
- デジタル公開: インターネット公開 / OCR 利用不可 / なし
- 大学図書館: （cinii_books holdings から）

【典拠強度】確認済み / 有力 / 弱い
```
