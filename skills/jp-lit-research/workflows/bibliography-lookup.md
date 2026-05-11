# 所蔵・書誌調査ワークフロー（bibliography_lookup）

## 対象となる依頼

- 「この本は NDL にあるか」「どこの図書館に所蔵されているか」
- 「この論文の出版年・掲載誌を確認したい」
- 「初出はどの雑誌か」「書名の正式表記を確認したい」

---

## フロー

### 0. 調査前情報収集の要否

タイトル・著者・ISBN・NCID・DOI などが明確で、単純な所蔵確認・書誌確認だけを行う場合は、レファ協・リサーチ・ナビ確認を省略してよい。

次の場合は、実検索前または行き詰まった時点で [heuristics/advisory-consultation.md](../heuristics/advisory-consultation.md) に戻り、レファ協・リサーチ・ナビから調査計画を作る。

- 初出、掲載号、雑誌記事、一般誌記事を探す
- 書誌情報が曖昧で同定が難しい
- 通常の所蔵・書誌検索で 0 件またはノイズ過多
- どの索引・参考図書・DB から見るべきか不明

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
4. [heuristics/advisory-consultation.md](../heuristics/advisory-consultation.md) で、レファ協・リサーチ・ナビから有効な索引・参考資料・調査順序を確認する
5. さらに必要なら [historical-term-search.md](historical-term-search.md) へ

初出調査で advisory を使うときは、レファ協やリサーチ・ナビから

- 初出確認に有効な索引・参考図書
- 雑誌記事索引以外に見るべき DB
- 別称・旧表記

を取り、`jp_lit_search` の query と source を補正する。

### 5. 再録・改稿・最終版候補の追跡

初出論文や重要候補が見つかった場合、後年の研究書・論文集・著作集・全集・編著に収録された版がないか確認する。

基本の動線:

1. 初出候補の `title` / `author` / `issued_at` / `journal_title` を控える
2. 同じ著者名 + 論文タイトルで `ndl_catalog` / `cinii_books` を検索する
3. タイトルが一致しない場合は、主題語・短いタイトル語・旧字/新字で検索する
4. 後年の図書・論文集・著作集の目次を確認する
5. 目次・初出一覧・あとがき・版注記に「初出」「改稿」「補訂」「増補」「再録」等がないか確認する
6. 現物未確認なら `要現物確認` として残す

発行日は候補順位付けに使う。初出より後年の図書収録は重要だが、発行日だけで最終版とは断定しない。

使う source:

- `ndl_catalog`: NDL 所蔵・目次・出版年・著作集/論文集の確認
- `cinii_books`: 大学図書館所蔵、編著・研究書の確認
- `ndl_digital`: デジタル公開や目次確認
- `jp_lit_get_record`: 目次、注記、所蔵、関連情報の確認
- `jp_lit_annotate_session`: `要現物確認` / `要複写` / `再録候補` を保存
- `jp_lit_export_session`: 図書館確認・複写候補リストを出す

文献自体の存在確認と、版関係の確認は分ける。NDL / CiNii Books で図書の存在や所蔵を確認できても、初出・再録・改稿・最終版の関係は、目次・初出一覧・あとがき・版注記・現物確認が終わるまで `要現物確認` のまま残してよい。

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
