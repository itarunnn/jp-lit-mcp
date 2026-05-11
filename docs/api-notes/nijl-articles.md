# 国文学・アーカイブズ学論文データベース

確認日: 2026-05-10

対象 source 候補: `nijl_articles`

## 実装判断

- decision: go
- reason: 日本文学・日本語学・国語教育・アーカイブズ学の国内研究論文を専門的に採録しており、CiNii / NDL だけでは拾い切れない分野分類・掲載誌情報・国文研請求記号を返せるため。
- japan_search_or_existing_source_overlap: 一部は CiNii / NDL / IRDB と重なるが、国文学年鑑由来の採録範囲、時代分類・分野、掲載誌等一覧、国文研所蔵情報に差分がある。
- unique_value: 日本文学研究論文の総合目録として、明治21年から令和4年までのデータと校正中レコードを含む。2019年以降はリポジトリ等掲載データからの採録も開始している。
- access_method: 公式検索画面 HTML。簡易検索は `GET https://ronbun.nijl.ac.jp/search/books?q=...`、詳細は `GET https://ronbun.nijl.ac.jp/kokubun/{id}`。ページングは `page` query。
- allowed_scope: 低頻度・キャッシュ前提で検索結果 HTML と詳細 HTML から書誌メタデータを抽出する。公式レコード URL を必ず保持する。
- excluded_scope: 画像・PDF・本文取得、OPAC 側の大量追跡、採録誌 CSV の自動大量取得、アーカイブズ学文献を同じ source に混ぜること。
- fragility: 公式 API ではなく Laravel/Vue 系 HTML の best-effort 抽出になる。HTML 構造変更で壊れる可能性がある。

## 公式情報

国文学研究資料館のデータベース一覧では、`国文学・アーカイブズ学論文データベース` を「国文学に関する論文及びアーカイブズ学に関係する国内文献データベース」と説明している。

国文学・アーカイブズ学論文データベースのトップページでは、国文学論文について次の範囲が示されている。

- 日本文学研究論文の総合目録データベース。
- 国文学研究資料館で所蔵している日本国内発表の雑誌・紀要・単行本（論文集）等の論文情報を掲載。
- 現在、明治21年から令和4年のデータを公開。
- 2019年データより、国文学研究資料館未所蔵資料についてリポジトリ等掲載データからの採録を開始。

データベース利用規程では、当館データベースは学術調査・学術研究・教育活動のため公開され、原則無償利用とされる。一方で、オープンデータを除くデータベースを利用して研究成果等を公表する場合は当館データベース利用の明記が求められ、営利目的利用は認める旨の記載がある場合を除き不可とされる。

## 確認済み取得導線

### robots

`https://ronbun.nijl.ac.jp/robots.txt`

```text
User-agent: *
Disallow:
```

### 検索

```text
GET https://ronbun.nijl.ac.jp/search/books?q=源氏物語
```

確認結果:

- HTTP 200
- `text/html; charset=UTF-8`
- 検索結果件数と `1-50` の表示範囲が HTML に出る
- 詳細リンクは `/kokubun/{8桁ID}` 形式
- ページングは `page=2` 形式

### 詳細

```text
GET https://ronbun.nijl.ac.jp/kokubun/00000002
```

初期実装では `source_id` を8桁IDにする。検索結果 URL だけで同定できるが、詳細ページから著者、掲載誌、巻号、ページ、発行年、分類、請求記号などを補完する。

## 初期マッピング案

- `source`: `nijl_articles`
- `source_id`: `/kokubun/{id}` の8桁ID
- `title`: 論文名
- `authors`: 執筆者
- `journal_title`: 掲載誌・掲載図書等
- `issued_at`: 発行年または発行年月から正規化
- `url`: 公式詳細 URL
- `subjects`: 時代分類・分野が取れる場合
- `source_metadata`:
  - `nijl_article_id`
  - `period_classification`
  - `field`
  - `volume`
  - `pages`
  - `nijl_call_number`
  - `opac_url`
  - `raw_fields`

## 実装時の注意

- `source` 未指定の既定横断には入れない。
- `archivesgakus` は初期実装では別 source にしない。必要なら将来 `nijl_archives_articles` として分ける。
- 詳細 HTML が取れない場合は検索結果由来の範囲に留める。
- OPAC URL は補助リンクとして保存してよいが、OPAC 詳細の追加取得は初期対象外。

## 参照

- https://www.nijl.ac.jp/db/
- https://ronbun.nijl.ac.jp/
- https://ronbun.nijl.ac.jp/search/books?q=%E6%BA%90%E6%B0%8F%E7%89%A9%E8%AA%9E
- https://ronbun.nijl.ac.jp/robots.txt
- https://www.nijl.ac.jp/wp/wp-content/uploads/2025/08/database-usage-regulations_20240509.pdf
