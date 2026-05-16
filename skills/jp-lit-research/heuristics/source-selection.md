# source 選択ルール

## 実検索の初動原則

レファ協・NDL リサーチ・ナビを参考に調査計画を立てた後、実検索の初動では、原則として `source` 未指定のラウンドロビン検索を使わない。`ndl_search` + `japan_search` を基礎候補にし、調査前情報収集で示唆された専門 DB / source と並べて計画する。NDL リサーチ・ナビは Web 検索で確認する調べ方案内であり、MCP source ではない。

レファ協・NDL リサーチ・ナビでは、最初の固有名詞 query が不発なら抽象度を上げる。リサーチ・ナビは `site:ndlsearch.ndl.go.jp/rnavi <固有名詞または主題語>` から始め、例: `作家 逸話 調べ方`、`文学者 回想 逸話 資料`、`近代文学 人物調査 年譜 索引` のように調査類型へ広げる。そこで示唆された DB / 参考図書 / 索引を、実検索初手の追加 source や次の確認先に反映する。

実検索に入るときは、次を既定セットにし、レファ協・リサーチ・ナビで示唆された source 候補を加える。レファ協・リサーチ・ナビで示唆された source 候補を加えて、初手の実検索 source を 2〜4 個に絞る。`ndl_search` / `japan_search` は専門 DB を押しのける固定順序ではない。

```text
既定セット:
- ndl_search    — NDL Search 参加機関を広く確認する
- japan_search  — 昭和館・地域/文化資源系・雑誌目次などの入口を確認する

追加候補:
- レファ協・リサーチ・ナビが示唆した専門 DB / source
- ドメイン判定で必要な個別 source
```

その後、見つかった媒体名・著者名・件名・巻号を使って `ndl_catalog` / `ndl_digital` / `ndl_articles` / `cinii_articles` / `cinii_books` などへ分解する。

`japan_search` は既定横断に含まれない。人物回想、雑誌目次、地域アーカイブ、昭和館、博物館・文化資源系の可能性がある調査では、必ず明示的に候補に入れる。
`ndl_search` / `japan_search` は新規テーマの初手に固定で含める。調査前情報収集で `nijl_articles`、`kokusho`、`ninjal_bibliography`、`nihu_bridge`、`irdb`、`jdcat`、`national_archives`、`jacar` などが強く示唆された場合は、既定セットに追加して初手計画に入れる。

## 横断検索の使い方

横断検索には **NDL モード（ndl_search）** と **ラウンドロビンモード（source 未指定）** の 2 つがある。ただし新規テーマの実検索初動は `ndl_search` + `japan_search` + 調査前情報収集で示唆された専門 DB / source とする。ラウンドロビンモードは補助的に使う。

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

**使う場面:** 「ざっと存在確認したい」「どのくらいあるか把握したい」「地方アーカイブ・青空文庫も含めて広く見たい」。新規テーマの既定セットとして使う。

### ラウンドロビンモード: `jp_lit_search`（source 未指定）

ネイティブ API を持つ文献系 source を並列呼び出し（ラウンドロビン）。著者情報・所蔵・PDF リンクなどが充実する。

対象:
```
ndl_catalog / ndl_digital / ndl_articles / ndl_articles_online
/ cinii_articles / cinii_books / jstage_articles / nihu_bridge
```

**使う場面:** 8 source を同じ query で比較する強い理由があるとき。例: 文献系 source 全体に同時に当てて重複候補を見たい、`nihu_bridge` を含む文献系ミックス検索を明示的に行いたい、source 別に分解する前の補助スキャンをしたい。

**避ける場面:** 新規テーマの初手、人物名だけの探索、回想記事・雑誌目次・地域アーカイブ・文化資源が疑われる探索。これらは `ndl_search` + `japan_search` を既定セットにし、調査前情報収集で示唆された専門 DB / source を追加して計画する。

---

以下は横断検索に含まれない（source 指定が必要）:
- `japan_search` — ポータル系、昭和館・地域資料・文化財・美術に特化して使う
- `irdb` — 機関リポジトリ、論文調査で明示的に追加（NDL モードでも薄いメタデータで含まれる）
- `jdcat` — 研究データカタログ
- `kokkai_minutes` / `teikoku_minutes` — 会議録
- `national_archives` — 国立公文書館DA。官庁資料、内閣・太政官・省庁、特定歴史公文書
- `jacar` — JACAR。外交、軍事、旧外地、植民地、朝鮮・台湾・関東州、戦前期官吏/軍人/外交官関係資料
- `nijl_articles` — 国文学論文・国文研論文・日本文学研究論文
- `kokusho` — 国書・古典籍・写本・版本の書誌、著作、所在
- `ninjal_bibliography` — 日本語研究・日本語教育文献・国語教育文献

---

## テーマのドメイン判定と推奨 source

テーマのドメインを判定して使う source を決める。
判定結果は Step 5（検索方針提示）でユーザーに示すこと。

| ドメイン | 判定の手がかり | 積極的に使う source |
|---------|--------------|-------------------|
| 国文学・日本語学・歴史・民俗・考古 | 固有名詞が古典的、時代名・地域名が含まれる | `nihu_bridge`（必須）+ `ndl_digital` + `nijl_articles`（国文学論文）+ `kokusho`（古典籍）+ `ninjal_bibliography`（日本語研究）+ `japan_search`（物質文化・地域資料が含まれる場合）|
| 社会科学・統計・調査データ | 「調査」「統計」「データ」「アンケート」 | `jdcat` を追加 |
| 理工系・医学系 | 英語混じり、数値・実験の記述 | `jstage_articles` を優先 |
| 紀要・学位論文・報告書 | 「修士論文」「紀要」「研究報告」 | `irdb` を優先 |
| 美術・文化財・地域資料・博物館資料 | 「作品」「文化財」「地域」「コレクション」「博物館」「民具」「遺跡」「浮世絵」 | `japan_search`（主力）+ `jp_lit_search_illustrations` + `nihu_bridge`（民俗・考古補完）|
| 議会・法令・官庁資料 | 「法律」「答弁」「審議」「議会」 | `kokkai_minutes` / `teikoku_minutes`。官庁原資料・特定歴史公文書なら `national_archives` |
| 公文書・アジア歴史資料 | 「内閣」「太政官」「省庁」「公文書」「外交」「軍事」「旧外地」「植民地」「朝鮮」「台湾」「関東州」「外務省外交史料館」「防衛研究所」 | 国内官庁・特定歴史公文書は `national_archives`、近現代アジア・外交・軍事・旧外地は `jacar` |
| 人物回想・雑誌目次・一般誌記事 | 人名単独、回想、追想、雑誌名、昭和戦後一般誌、掲載号探索 | `ndl_search` + `japan_search` → `ndl_articles` / `ndl_catalog` / `cinii_books` |
| 地方人物・地方紙・地方雑誌・郷土資料 | 出身地、在住地、発行地、旧地名、県史・市町村史、郷土人物、地域紙、ミニコミ誌 | `ndl_search` + `japan_search` + レファ協 / リサーチ・ナビで地域候補を作り、地方公共図書館ルートへ進む |
| 全般（判定できない） | — | `ndl_search` + `japan_search` を既定セットにし、レファ協・リサーチ・ナビで示唆された source を加える |

---

## 目的別 source 優先順位

### 図書・雑誌の所蔵確認

```
1. ndl_catalog   — NDL + 都道府県立・政令市立図書館
2. cinii_books   — 大学図書館（holdings に所蔵館リスト）
3. ndl_digital   — デジタル公開状況確認
```

### 雑誌論文・紀要

```
1. cinii_articles    — 人文社会系が充実
2. jstage_articles   — 理工系・医学系 + PDF直リンク
3. ndl_articles      — 古い記事・雑誌記事索引
4. nijl_articles     — 国文学論文・日本文学研究論文
5. ninjal_bibliography — 日本語研究・日本語教育文献・国語教育文献
6. irdb              — 機関リポジトリ（紀要・学位論文・報告書）
```

### 戦後以降の一般誌・新聞・論壇記事

```
1. ndl_articles / ndl_articles_online  — オープンに使える雑誌記事索引の入口
2. ndl_search / ndl_catalog            — 誌名・巻号・所蔵の手がかり
3. cinii_articles / irdb                — 学術論文・紀要側の周辺研究
4. kokkai_minutes                       — 政治・制度・事件名が絡む場合の補助
```

### 参考書誌・索引・有料DBでの追加確認

人文系調査は無料オンライン資料だけで完結しないことが多い。次に当てはまる場合、特にレファ協・NDL リサーチ・ナビが参考図書・専門索引・契約 DB を示唆している場合は、回答の `参考書誌・有料DBの次アクション` に `参考書誌確認` または `要有料DB確認` を積極的に残す。

- 週刊誌、月刊誌、総合雑誌、論壇誌、文芸誌、サブカルチャー誌、業界誌などの一般誌記事が主対象
- 新聞記事、広告、事件報道、人物インタビュー、書評欄、雑誌の特集記事を探している
- 戦後以降、特に 1950 年代以降の世論・受容・流行・メディア言説を追う調査
- NDL / CiNii / J-STAGE / IRDB では周辺情報しか出ず、一般誌・新聞側の欠落がありそう
- リサーチ・ナビやレファ協が、参考書誌、専門索引、年鑑、目録、事典、契約 DB、館内限定 DB を勧めている

候補は、調査内容に応じて参考書誌・専門索引・年鑑・目録・事典、または `ざっさくプラス`、`大宅壮一文庫`、新聞系 DB（朝日クロスサーチ、ヨミダス、毎索、日経テレコン等）を挙げる。MCP から直接接続できないものは、確定結果ではなく「人間が次に確認する場所」として扱う。

毎回の定型注意にはしない。ただしレファ協・リサーチ・ナビで示唆された場合、または参考書誌・索引・雑誌記事・新聞記事・戦後以降の一般言説が調査目的に効く場合は、確認先と検索語案を出す。無料オンラインで確認できた範囲と、未確認だが重要なオフライン/契約 DB 導線を分けて書く。

### 地方公共図書館ルート

地方人物、地方紙、地方雑誌、郷土資料、地域団体資料、市町村史、県史、地方行政資料が絡む場合は、地域資料サービスとして扱う。まず人物名だけでなく、地名、旧地名、出身地、在住地、活動地、発行地、媒体名、団体名を分けて地域候補を作る。

カーリル Remote MCP が使える環境では、まず Web 検索で実在する地域図書館、地域パスファインダー、新聞・雑誌所蔵一覧、郷土資料ページを拾う。人名はまず出身地・居住地・活動地・郷土人物としての地域を割り、地域から図書館へ進める。文学館、記念館、資料館、専門図書館、資料室への直接導線は補助として探す。媒体名・団体名からは所蔵館や資料室の導線も探す。そのうえで `search_libraries` に実在館名やネットワーク名を渡し、該当都道府県立図書館、市区町村中央館、県内/広域の図書館ネットワーク、発行地・活動地に対応する中央館、郷土資料室・分館、隣接自治体や旧郡域の館、専門図書館・資料室の `systemid` を確認し、`search_books` へ進む。カーリル MCP の `search_books` は最大15館までなので、全国総当たりではなく、地域推定後に候補館を優先づけて使う。

REST API は ISBN 既知の所蔵確認に限る。人物名・地名・地方紙名・地方雑誌名から資料を発見するキーワード蔵書検索には使わない。カーリル MCP が使えない場合は、地域パスファインダー、各館 OPAC、新聞所蔵一覧、レファレンス相談を次アクションに残す。

詳細は `reference/regional-public-library-research.md` を参照する。

### デジタル化一次資料・古典籍

```
1. ndl_digital               — 主力
2. kokusho                   — 国書・古典籍・写本・版本の同定
3. jp_lit_search_fulltext    — デジコレ OCR 全文横断
4. jp_lit_search_kokusho_fulltext — 国書DB収録本文スニペット
5. jp_lit_search_kokusho_image_tags — 国書DB画像タグ
6. nihu_bridge               — 人文学専門 DB（国文研・国民博・etc.）
```

### 専門 DB の自然言語読み替え

- 国文学論文、国文研論文、日本文学研究論文: `nijl_articles`
- 国書・古典籍、写本・版本: `kokusho`
- 国書DBで本文検索、古典籍本文中の語: `jp_lit_search_kokusho_fulltext`
- 国書DBの画像タグ、古典籍の挿絵タグ、図像タグ: `jp_lit_search_kokusho_image_tags`
- 日本語研究・日本語教育文献・国語教育文献: `ninjal_bibliography`

これらはすべて既定横断外。ユーザーの依頼文が上の語を含む場合だけ、追加 source として明示指定する。

有料 DB、文化資源 DB、地域アーカイブ DB は固定 source 化しない。契約 DB は `要有料DB確認`、文化資源・地域アーカイブは `japan_search` / `nihu_bridge` / リサーチ・ナビ / レファ協で入口を作る。

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

### 公文書・アジア歴史資料

```
national_archives — 国立公文書館DA。官庁資料・内閣・太政官・省庁・特定歴史公文書・国立公文書館所蔵資料
jacar             — JACAR。外交・軍事・旧外地・植民地・朝鮮・台湾・関東州・外務省外交史料館・防衛研究所・戦前期官吏/軍人/外交官
```

リサーチ・ナビ／レファ協が国立公文書館DAまたはJACARを推奨している場合も、追加 source 候補にする。どちらも通常の文献探索の主力ではなく下位導線。画像本体・IIIF・OCR は取得せず、公式レコード URL と目録メタデータで同定する。

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
| `nijl_articles` | 既定横断外。HTML best-effort。本文・PDF・OPAC 詳細追跡は対象外 |
| `kokusho` | 既定横断外。manifest URL は保持するが、manifest 本体・画像・本文一括取得は対象外 |
| `ninjal_bibliography` | 既定横断外。本文リンク URL は保持するが、本文 PDF・外部本文は対象外 |
| `national_archives` | 既定横断外。画像本体・IIIF・OCR・contentDownload は対象外。403 は VPN・ネットワーク制限の可能性 |
| `jacar` | 既定横断外。画像本体・IIIF・OCR・aj/contentDownload は対象外。403 は VPN・ネットワーク制限の可能性 |

---

## source 組み合わせパターン

### 「本文が読みたい」

```
ndl_digital（メタ） → available=true → jp_lit_search_fulltext / jp_lit_search_pages
kokusho（書誌） → 国書DB収録本文の語なら jp_lit_search_kokusho_fulltext
```

### 「論文を網羅したい」

```
cinii_articles + jstage_articles + ndl_articles + nijl_articles + ninjal_bibliography + irdb
```

### 「古い語で探したい」

```
ndl_digital + jp_lit_search_fulltext + nihu_bridge（normalize=true）
```

### 「画像・図版を探したい」

```
jp_lit_search_illustrations → japan_search（美術・文化財）
国書DBの古典籍画像タグなら jp_lit_search_kokusho_image_tags
```

### 「文献と現物（美術品・文化財）の両方を調べたい」

```
cinii_articles / ndl_catalog（文献）
+ japan_search（現物・資料）
+ nihu_bridge（民俗・考古の専門 DB）
```
