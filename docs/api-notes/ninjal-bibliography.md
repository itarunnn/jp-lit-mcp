# 日本語研究・日本語教育文献データベース

確認日: 2026-05-10

対象 source 候補: `ninjal_bibliography`

## 実装判断

- decision: go
- reason: 日本語学・日本語教育研究の文献に特化し、1950年以降の論文・図書に分野情報と本文リンク有無を付与しているため、CiNii / NDL だけでは得にくい分野別探索と確認優先度付けに価値がある。
- japan_search_or_existing_source_overlap: 一部文献は CiNii / NDL / IRDB と重複するが、国語年鑑・日本語教育年鑑由来の採録、分野情報、研究図書室請求記号、本文リンク有無に差分がある。
- unique_value: 2026年3月現在で 302,014 件。論文データと図書データを含み、内容を示す分野情報を付与している。Web 公開論文には本文リンクが付く。
- access_method: 公式検索画面 HTML。簡易検索は `GET https://bibdb.ninjal.ac.jp/bunken/ja/result?r_freeWord_search=...&lop=and&per=20&disp=snipet`、詳細は `GET https://bibdb.ninjal.ac.jp/bunken/ja/article/{文献ID}`。検索結果から選択データを CSV / BibTeX / Excel で書き出す導線もある。
- allowed_scope: 低頻度・キャッシュ前提で検索結果 HTML と詳細 HTML から書誌メタデータを抽出する。本文リンクはリンク先 URL の手がかりとして保存し、本文取得はしない。
- excluded_scope: 検索結果全件の一括ダウンロード、本文 PDF の取得、外部リポジトリ本文の自動取得、研究図書室 OPAC の追加取得。
- fragility: 公式 API ではなく HTML best-effort。詳細ページの `dl.detail` は比較的読みやすいが、検索結果 HTML やダウンロード form は変更される可能性がある。

## 公式情報

トップページでは、この DB を「日本語学，日本語教育に関する研究文献のデータベース」とし、国立国語研究所が発行していた『国語年鑑』『日本語教育年鑑』掲載文献情報を元に、1950年から現在までの関係論文・図書を検索できると説明している。

データベース概要では、2026年3月現在の総データ件数を 302,014 件とし、内訳を論文データ 251,206 件、図書データ 50,808 件としている。書誌情報に加えて分野情報を付与し、Web 上に公開されている論文には本文へのリンクを付けている。

利用条件では、文献データベースの著作権は国立国語研究所が保有し、営利目的利用を希望する場合は国立国語研究所との協議が必要とされる。

## 確認済み取得導線

### robots

`https://bibdb.ninjal.ac.jp/robots.txt`

確認結果:

```text
User-agent: GPTBot
Disallow: /
```

`User-agent: *` の禁止は確認できなかった。ただし高頻度アクセスや一括収集は避ける。

### 簡易検索

```text
GET https://bibdb.ninjal.ac.jp/bunken/ja/result?r_freeWord_search=日本語教育&lop=and&per=20&disp=snipet
```

確認結果:

- HTTP 200
- `text/html; charset=UTF-8`
- 件数、ページング、詳細リンク `/bunken/ja/article/{文献ID}` が HTML に出る
- `per` は 20 / 50 / 100
- `skip` でページング

### 詳細

```text
GET https://bibdb.ninjal.ac.jp/bunken/ja/article/102025006447
```

確認結果:

- HTTP 200
- `text/html; charset=UTF-8`
- `DB`, `文献ID`, `研究図書室請求記号`, `論文著者名`, `論文名`, `誌名・書名`, `巻号`, `ページ`, `発行`, `発行年月`, `キーワード`, `章タイトル・目次`, `分野`, `ISBN`, `ISSN`, `関連情報` などが `dl.detail` に出る

### ダウンロード

利用の手引きでは、検索結果の選択データを BibTeX / テキスト（CSV） / Excel 形式でダウンロードできると説明している。検索結果が100件を超える場合はページごとのダウンロードになる。

初期実装では HTML 詳細を主導線にし、CSV ダウンロードは fixture 調査後に必要な場合だけ使う。

## 初期マッピング案

- `source`: `ninjal_bibliography`
- `source_id`: 文献ID
- `title`: 論文名、図書の場合は誌名・書名
- `authors`: 論文著者名または図書編著者名
- `journal_title`: 誌名・書名。図書の場合も共通 schema 上はここに入れ、`source_metadata.db_kind` で区別する。
- `publisher`: 発行
- `issued_at`: 発行年月から best-effort
- `subjects`: 分野、キーワード
- `availability.online`: 本文表示リンクがある場合に true。ただし本文読了ではない。
- `source_metadata`:
  - `bibliography_id`
  - `db_kind`: `雑誌` / `論文集` / `図書`
  - `library_call_number`
  - `alternate_authors`
  - `alternate_title`
  - `volume`
  - `pages`
  - `keywords`
  - `chapter_titles`
  - `fields`
  - `isbn`
  - `issn`
  - `fulltext_links`
  - `related_information`
  - `raw_fields`

## 実装時の注意

- `source` 未指定の既定横断には入れない。
- `availability.online=true` は本文リンクの存在だけを意味し、本文読了扱いにしない。
- ダウンロード機能は便利だが、100件単位かつ選択式の利用導線であるため、全件収集に使わない。
- NINJAL 側の著作権・営利利用協議条件を README / source usage に反映する。

## 参照

- https://bibdb.ninjal.ac.jp/bunken/ja/
- https://bibdb.ninjal.ac.jp/bunken/ja/help/about
- https://bibdb.ninjal.ac.jp/bunken/dist/db_guide.pdf
- https://bibdb.ninjal.ac.jp/robots.txt
