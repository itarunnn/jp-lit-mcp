# 国書データベース

確認日: 2026-05-10

対象 source 候補: `kokusho`

## 実装判断

- decision: go
- reason: 古典籍の著作・書誌・所在・画像公開ページ・IIIF manifest の関係を保持できる専門 DB であり、Japan Search / nihuBridge 経由より元 DB 固有の構造を返す価値が高いため。
- japan_search_or_existing_source_overlap: 一部は Japan Search / nihuBridge / CiNii Research / Web NDL Authorities と連携しているが、国書データベース本体の書誌 ID、著作 ID、種別、刊写、所在、画像有無、請求記号、manifest、利用条件が調査上重要。
- unique_value: 新日本古典籍総合データベース、日本古典籍総合目録データベース、館蔵和古書目録データベース等を統合した古典籍 DB。著作・書誌・所在・画像公開導線をまとめて確認できる。
- access_method: Vue app が利用している JSON endpoint。簡易検索は `GET https://kokusho.nijl.ac.jp/api/biblioSimpleSearch?searchkbn=simple&keyword=...`、詳細は `GET https://kokusho.nijl.ac.jp/api/biblioDetail/{bid}`。公開ページは `/biblio/{bid}`。
- allowed_scope: 書誌・著作・所在・公式 URL・画像有無・manifest URL・ライセンス URL のメタデータ確認まで。低頻度・キャッシュ前提。
- excluded_scope: 画像本体のダウンロード、IIIF image API の取得、全コマ manifest の深掘り、OCR、翻刻本文の大量取得、画像解析。
- fragility: JSON endpoint は公式アプリが使う公開導線だが、独立した API 仕様書として確認したものではない。レスポンス shape 変更に備えて fixture test を厚めにする。

## 公式情報

国文学研究資料館のデータベース一覧では、国書データベースを「国内外の機関が所蔵する古典籍の書誌情報と高精細画像を検索・利用できるデータベース」と説明している。また、統合済みデータベースとして次を挙げている。

- 新日本古典籍総合データベース
- 日本古典籍総合目録データベース
- 館蔵和古書目録データベース
- 所蔵機関との連携による日本古典籍デジタル画像データベース
- コーニツキー欧州所在日本古書総合目録データベース
- 近代書誌・近代画像データベース

データベース利用規程では、当館 DB は原則無償利用とされ、オープンデータについては表示された利用条件に従ったクレジット記載が求められる。画像や本文テキスト等は個別の利用条件を保持するため、MCP ではメタデータと公式 URL に留める。

## 確認済み取得導線

### robots

`https://kokusho.nijl.ac.jp/robots.txt`

```text
User-agent: *
Disallow:
```

### 検索

```text
GET https://kokusho.nijl.ac.jp/api/biblioSimpleSearch?searchkbn=simple&keyword=伊勢物語
```

確認結果:

- HTTP 200
- `application/json;charset=UTF-8`
- 配列で書誌候補を返す
- `bid`, `name`, `collection`, `seikyu`, `kansha`, `year`, `satsu`, `shubetsu`, `image`, `wid`, `wname`, `wkeyword`, `wauthor`, `wyear` などが含まれる

### 詳細

```text
GET https://kokusho.nijl.ac.jp/api/biblioDetail/{bid}?t={timestamp}
```

確認結果:

- HTTP 200
- `application/json;charset=UTF-8`
- 書誌詳細、著作情報、請求記号、媒体情報、画像有無、manifest URL、ライセンス URL、目次/タグ等が含まれる

### IIIF manifest

```text
GET https://kokusho.nijl.ac.jp/biblio/{bid}/manifest
```

確認結果:

- HTTP 200
- `application/json`
- IIIF Presentation 2 manifest

初期実装では manifest URL とライセンス URL をメタデータとして保存するだけにし、manifest の取得や image API へのアクセスは行わない。

## 初期マッピング案

- `source`: `kokusho`
- `source_id`: `bid`
- `title`: `name` または詳細の標目書名・記載書名
- `authors`: `authorlist` / `wauthor`
- `issued_at`: `year` / `wyear` から best-effort
- `material_type`: `古典籍`
- `url`: `https://kokusho.nijl.ac.jp/biblio/{bid}`
- `availability.online`: `image === "1"` または manifest URL がある場合に true。ただし本文読了ではない。
- `content_access.viewer_url`: 公式書誌ページ URL
- `source_metadata`:
  - `bid`
  - `wid`
  - `record_kind`: `bibliographic_record`
  - `work_title`
  - `collection`
  - `call_number`
  - `kansha`
  - `volumes`
  - `has_images`
  - `manifest_url`
  - `license_url`
  - `shubetsu`
  - `raw`

## 実装時の注意

- `source` 未指定の既定横断には入れない。
- 初版は書誌検索を中心にする。著作検索、著者検索、画像タグ検索、全文検索、近代書誌検索は別タスク。
- manifest は URL として保持するだけにする。画像 API の URL は返却しても自動取得しない。
- 画像利用条件は個別資料・manifest 側に依存するため、再利用可否を MCP が確定しない。

## 参照

- https://www.nijl.ac.jp/db/
- https://kokusho.nijl.ac.jp/
- https://kokusho.nijl.ac.jp/api/biblioSimpleSearch?searchkbn=simple&keyword=%E4%BC%8A%E5%8B%A2%E7%89%A9%E8%AA%9E
- https://kokusho.nijl.ac.jp/api/biblioDetail/100000123
- https://kokusho.nijl.ac.jp/robots.txt
- https://www.nijl.ac.jp/wp/wp-content/uploads/2025/08/database-usage-regulations_20240509.pdf
