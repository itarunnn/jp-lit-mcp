# source 選択ルール

## 横断検索の使い方

横断検索には **NDL モード（ndl_search）** と **ラウンドロビンモード（source 未指定）** の 2 つがある。

### NDL モード: `jp_lit_search(source=ndl_search)`

NDL Search に参加する **100 機関以上**を 1 リクエストで横断する。存在確認・初動調査に向く。

カバー範囲（主なもの）:
- NDL 系: `iss-ndl-opac`（蔵書） / `ndl-dl`（デジコレ） / `zassaku`（雑誌記事索引）
- `ciniir`（CiNii Research）/ `jstage`（J-STAGE）/ `irdb`（IRDB）
- 地方公共図書館・大学図書館デジタルアーカイブ（都道府県立・国立大学等）
- 青空文庫 / JPRO（出版情報）/ WARP / ADEAC など

**制約:**
- CiNii・J-STAGE・IRDB はハーベスト済みメタデータ → 著者詳細・所蔵・PDF リンクが欠ける
- `nihu_bridge`（NIHU 独自 API）はカバーしない
- getRecord 結果は NDL detail API に依存（CiNii / J-STAGE 固有フィールドは取れない）

**使う場面:** 「ざっと存在確認したい」「どのくらいあるか把握したい」「地方アーカイブ・青空文庫も含めて広く見たい」

**用途を3つに分けて読む:**

1. **総合目録として:** レア資料・同人誌・地域資料が全国のどこにあるかを見る。ヒット後は所蔵館と利用条件を確認する。
2. **NDL 蔵書目録として:** NDL で閲覧できるか、デジタル化・利用可否・欠本/紛失相当の状態を確認する。
3. **全国書誌として:** 既知タイトルでなく、件名・分類・目次語から未知の図書を探す。ヒットした代表資料の件名・NDC/NDLC を次 query に回す。

報告時は、この3用途のどれとして `ndl_search` を使ったかを明示する。

### ラウンドロビンモード: `jp_lit_search`（source 未指定）

ネイティブ API を持つ source を並列呼び出し（ラウンドロビン）。著者情報・所蔵・PDF リンクなどが充実する。

対象:
```
ndl_catalog / ndl_digital / ndl_articles / ndl_articles_online
/ cinii_articles / cinii_books / jstage_articles / nihu_bridge
```

**使う場面:** 詳細調査や所蔵確認・PDF 取得・nihu_bridge での人文専門 DB 横断が必要なとき。

---

以下は横断検索に含まれない（source 指定が必要）:
- `japan_search` — ポータル系、文化財・美術に特化して使う
- `irdb` — 機関リポジトリ、論文調査で明示的に追加（NDL モードでも薄いメタデータで含まれる）
- `jdcat` — 研究データカタログ
- `kokkai_minutes` / `teikoku_minutes` — 会議録

---

## テーマのドメイン判定と推奨 source

テーマのドメインを判定して使う source を決める。
判定結果は Step 5（検索方針提示）でユーザーに示すこと。

| ドメイン | 判定の手がかり | 積極的に使う source |
|---------|--------------|-------------------|
| 国文学・日本語学・歴史・民俗・考古 | 固有名詞が古典的、時代名・地域名が含まれる | `nihu_bridge`（必須）+ `ndl_digital` + `japan_search`（物質文化・地域資料が含まれる場合）|
| 社会科学・統計・調査データ | 「調査」「統計」「データ」「アンケート」 | `jdcat` を追加 |
| 理工系・医学系 | 英語混じり、数値・実験の記述 | `jstage_articles` を優先 |
| 紀要・学位論文・報告書 | 「修士論文」「紀要」「研究報告」 | `irdb` を優先 |
| 美術・文化財・地域資料・博物館資料 | 「作品」「文化財」「地域」「コレクション」「博物館」「民具」「遺跡」「浮世絵」 | `japan_search`（主力）+ `jp_lit_search_illustrations` + `nihu_bridge`（民俗・考古補完）|
| 議会・法令・官庁資料 | 「法律」「答弁」「審議」「議会」 | `kokkai_minutes` / `teikoku_minutes` |
| 全般（判定できない） | — | NDL + CiNii + J-STAGE の既定構成 |

---

## 目的別 source 優先順位

### 図書・雑誌の所蔵確認

```
1. ndl_catalog   — NDL + 都道府県立・政令市立図書館
2. cinii_books   — 大学図書館（holdings に所蔵館リスト）
3. ndl_digital   — デジタル公開状況確認
```

### 洋書・出たはずの本

```text
1. cinii_books   — 大学図書館。洋書・研究用図書の第一候補
2. ndl_search    — NDL + 全国図書館 + CiNii連携の広域確認
3. ndl_catalog   — NDL蔵書・全国書誌としての確認
4. ndl_digital   — 古い資料・復刻・デジタル公開の確認
```

NDL に出ない場合も、すぐ不存在としない。限定本、企業史、同人誌、文学館所蔵資料、専門図書館資料、地域資料は制度上の収集範囲から漏れることがある。MCP 内で見つからない場合は、外部の WorldCat / Google Books / 個別OPAC / 古書DB を次の手として提案する。

### 未知の図書を主題から探す

```text
1. ndl_search / ndl_catalog — 全国書誌・件名・分類・目次語の入口
2. cinii_books              — 大学図書館側の主題・所蔵補完
3. ndl_digital              — 古い本は目次・全文ヒットで補完
```

手順:

- 代表資料の `subjects` / `facets.ndc` / `table_of_contents` を読む
- 件名標目を query に戻し、地名・時代・対象語を足す
- NDC/NDLC は桁を減らして上位主題へ広げる
- 1980年以前など古い資料では分類版差を疑い、近い分類番号も試す

### 雑誌論文・紀要

```
1. cinii_articles    — 人文社会系が充実
2. jstage_articles   — 理工系・医学系 + PDF直リンク
3. ndl_articles      — 古い記事・雑誌記事索引
4. irdb              — 機関リポジトリ（紀要・学位論文・報告書）
```

### デジタル化一次資料・古典籍

```
1. ndl_digital               — 主力
2. jp_lit_search_fulltext    — OCR 全文横断
3. nihu_bridge               — 人文学専門 DB（国文研・国民博・etc.）
```

### 語誌・用例調査

```text
1. cinii_articles / ndl_articles — 語誌・語源・語彙史の論文
2. ndl_catalog                   — 専門書誌・論文集・単行本内章
3. ndl_digital                   — 目次・内容細目・古い資料
4. jp_lit_search_fulltext        — 用例検索
5. nihu_bridge                   — 日本語学・国文学・歴史資料の補完
```

まず語誌文献を探し、見つからない場合に用例検索へ進む。用例だけで語義変化や初出を断定しない。

### 人文学専門調査

```
nihu_bridge  — NIHU 7機関 100+ DB
  → normalize=true（デフォルト）で異体字同定
  → filters.nihu_bridge.institute で機関絞り込み可
```

### 研究データ・統計・アンケート

```
jdcat  — 人文学・社会科学総合データカタログ
  → availability.online=true が配布元 URI あり（公開保証ではない）
```

### 会議録・議会資料

```
kokkai_minutes   — 第1回国会〜現在（speech 単位で検索）
teikoku_minutes  — 第1〜90回帝国議会（1890〜1947年）
```

---

## source 別の制約

| source | 制約 |
|--------|------|
| `ndl_articles_online` | 検索のみ、getRecord は常に null |
| `ndl_search` | NDL モード。CiNii/J-STAGE はハーベスト済みで情報が薄い。nihu_bridge はカバーしない |
| `jstage_articles` | sort 未対応、summary 常に null |
| `irdb` | limit は 20/50/100 のみ有効（adapter が補正）|
| `jdcat` | detail は JSON API、availability.online は公開保証ではない |
| `nihu_bridge` | sort 未対応 |

---

## source 組み合わせパターン

### 「本文が読みたい」

```
ndl_digital（メタ） → available=true → jp_lit_search_fulltext / jp_lit_search_pages
```

### 「論文を網羅したい」

```
cinii_articles + jstage_articles + ndl_articles + irdb
```

### 「古い語で探したい」

```
ndl_digital + jp_lit_search_fulltext + nihu_bridge（normalize=true）
```

### 「画像・図版を探したい」

```
jp_lit_search_illustrations → japan_search（美術・文化財）
```

### 「文献と現物（美術品・文化財）の両方を調べたい」

```
cinii_articles / ndl_catalog（文献）
+ japan_search（現物・資料）
+ nihu_bridge（民俗・考古の専門 DB）
```
