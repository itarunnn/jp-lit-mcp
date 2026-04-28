# jp-lit-research Skill 対話型アドバイザリー強化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** jp-lit-research スキルを「検索実行スクリプト」から「司書的な対話型アドバイザー」に強化する。ユーザーが「調べて」と言ったとき、なぜそのDBを使うかを説明し、調査方針を提案し、選別過程を明示できるようにする。

**Architecture:** スキルファイルは `.cursor/skills/jp-lit-research/` 以下の Markdown のみ。新規 heuristics ファイルを2つ追加し、既存ファイルを更新する。コードの変更はない。

**Tech Stack:** Markdown（スキル定義）、WebFetch（実行時に NDL リサーチ・ナビを参照）

---

## ファイル構成

| 操作 | ファイル | 内容 |
|------|---------|------|
| 新規作成 | `heuristics/db-characteristics.md` | 各 DB の特性・強み・弱みの説明文 |
| 新規作成 | `heuristics/clarifying-questions.md` | 曖昧な依頼への問い返しガイダンス |
| 更新 | `SKILL.md` | 問い返し・DB説明への参照を Step に追加 |
| 更新 | `heuristics/source-selection.md` | Japan Search 動線強化、ドメイン判定精緻化 |
| 更新 | `workflows/research-guide-lookup.md` | 分野別調査シナリオ拡充 |

---

## Task 1: DB特性ファイルの作成

**Files:**
- Create: `.cursor/skills/jp-lit-research/heuristics/db-characteristics.md`

各 DB について「なぜこれを使うか」をユーザーに説明できる文章を書く。
README.md の実装メモ・制約・source-selection.md を参照して作成する。

- [ ] **Step 1: 各 DB の特性を整理して db-characteristics.md を作成する**

以下の構成で作成する：

```markdown
# DB 特性・選択理由

このファイルは Step 5（検索方針提示）でユーザーに「なぜこのDBか」を説明するための知識源。

## ndl_catalog
NDL（国立国会図書館）が運営する蔵書目録。NDL 本館・都道府県立・政令市立図書館の所蔵も含む。
日本国内で出版されたほぼすべての図書・雑誌のメタデータが揃っており、所蔵確認の出発点として最も信頼性が高い。
**向いている用途:** 図書の書誌確認・所蔵確認・出版年特定
**制約:** 雑誌記事単位の索引は ndl_articles を使う

## ndl_digital
NDL デジタルコレクションの資料。館内限定・図書館送信資料も含む全メタデータを返す。
next_digital_library.available=true の資料は OCR 全文・図版検索まで利用できる。
**向いている用途:** 近代以降の一次資料・全文読み取り・図版確認
**制約:** available=false（館内限定等）は OCR ツール利用不可

## ndl_articles
NDL 雑誌記事索引。主に 1948 年以降の雑誌記事を収録。古い雑誌記事の網羅性が高い。
getRecord は CiNii CRID へのフォールバックあり。journal_title は best-effort 抽出（巻号混入の場合あり）。
**向いている用途:** 古い雑誌記事・戦後期の論文索引
**制約:** 巻号・頁は source_metadata のみ（SearchItem には含まれない）

## cinii_articles
NII（国立情報学研究所）運営の論文 DB。人文社会系の充実度が高く、DOI・CRID などの永続 ID が揃っている。
**向いている用途:** 人文社会系論文の網羅的収集・書誌確認
**制約:** sort は issued_date のみ対応

## cinii_books
大学図書館の所蔵を横断する図書 DB。holdings に所蔵館リストが入る。
**向いている用途:** 大学図書館での所蔵確認・入手可能館の特定

## jstage_articles
JST（科学技術振興機構）が運営する電子ジャーナルプラットフォーム。PDF 直リンクあり。
理工系・医学系が中心だが、人文社会系雑誌も一部含む。
**向いている用途:** PDF で本文を入手したい・理工医系論文
**制約:** sort 未対応、summary（アブストラクト）常に null

## irdb
国内の機関リポジトリを横断する DB。紀要・学位論文・テクニカルレポートなど、商業誌未掲載の「灰色文献」が充実。
**向いている用途:** 学位論文・機関紀要・報告書
**制約:** 横断検索の既定対象外（source=irdb で明示指定が必要）

## nihu_bridge
NIHU（人文学・社会科学振興機構）傘下 7 機関（国文研・国民博・国語研・日文研・人環・国民博・NIHU本部）の
100 以上の専門 DB を一括横断する。異体字同定（normalize=true）で旧字・異体字を自動正規化。
含まれる DB 例: 国書データベース、日本語歴史コーパス、総合資料学、民俗資料など。
**向いている用途:** 国文学・日本語学・日本史・民俗・考古の専門調査
**制約:** sort 未対応。横断検索のデフォルト対象だが、standard では明示的に呼ぶこと

## jdcat
人文学・社会科学の研究データカタログ。調査データ・統計・アンケート原票などを収録。
availability.online=true は配布元 URI があることを意味するが、無条件公開の保証ではない。
**向いている用途:** 社会調査・統計データ・研究データの所在確認
**制約:** 横断検索の既定対象外

## japan_search
文化庁・国立博物館・美術館・地域アーカイブなど多機関の資料を横断するポータル。
テキスト文献だけでなく、美術品・文化財・地域資料・地図・音源なども含む。
nihu_bridge と補完関係にあり、物質文化・造形芸術・地域資料はこちらが充実。
**向いている用途:** 文化財・美術品・博物館所蔵資料・地域アーカイブ・浮世絵
**制約:** 横断検索の既定対象外。テキスト論文より資料・モノ系が強い

## kokkai_minutes / teikoku_minutes
国会会議録（第 1 回〜現在）と帝国議会会議録（1890〜1947 年）。speech 単位で全文検索できる。
**向いている用途:** 立法過程・政治史・戦前戦後の議会審議
**制約:** ユーザーが明示指定した場合のみ使用
```

- [ ] **Step 2: SKILL.md の詳細リファレンスセクションにリンクを追加する**

`SKILL.md` の末尾の詳細リファレンスに以下を追加：

```markdown
- [heuristics/db-characteristics.md](heuristics/db-characteristics.md) — DB特性・選択理由
```

---

## Task 2: 問い返しガイダンスファイルの作成

**Files:**
- Create: `.cursor/skills/jp-lit-research/heuristics/clarifying-questions.md`
- Modify: `.cursor/skills/jp-lit-research/SKILL.md`

依頼が曖昧なとき何を聞き返すかを定義する。

- [ ] **Step 1: clarifying-questions.md を作成する**

```markdown
# 問い返しガイダンス（clarifying-questions）

依頼が曖昧なとき、検索を始める前に確認する。standard / deep では特に重要。
quick は即実行でよい（問い返しは不要）。

---

## 問い返しが必要なケース

| 状況 | 確認すべきこと |
|------|--------------|
| 資料種別が不明 | 「論文を探していますか、図書（単行本）ですか、一次資料（当時の文書・史料）も含めますか?」 |
| 時代が不明 | 「対象の時代はいつ頃ですか?（近世・近代・現代など）」 |
| 用途が不明 | 「研究・論文執筆用ですか、それとも概要把握が目的ですか?」 |
| 入手可否の優先度が不明 | 「すぐ読める資料（オンライン公開）を優先しますか、所蔵確認だけでよいですか?」 |
| 専門 DB が有効か不明 | 「〇〇の専門 DB（例: nihu_bridge）まで含めますか、一般的な DB で十分ですか?」 |

---

## 問い返しのタイミング

- **quick**: 問い返さず即実行。結果提示後に「より詳しく調べますか?」と添える
- **standard**: 資料種別・時代が不明なら1〜2点だけ確認してから実行
- **deep**: 調査方針全体を提示してユーザーに確認してから実行

---

## 問い返しの書き方

- 一度に複数の質問をしない（1〜2点まで）
- 選択肢を示す（「論文ですか、図書ですか」のように）
- 「わからなければそのまま進めます」と添えて圧をかけない

例:
```
少し確認させてください。
対象は **論文・雑誌記事** ですか、それとも **図書（単行本）や一次資料（史料）** も含めますか?
わからない場合はそのまま進めます。
```

---

## 問い返し不要のケース

- 「ざっと」「ちょっと」「参考程度に」→ quick として即実行
- タイトル・著者・出版年が具体的に分かっている → bibliography_lookup として即実行
- 「全文検索して」「デジコレで探して」→ fulltext_page_lookup として即実行
```

- [ ] **Step 2: SKILL.md の Step 1（依頼分類）に問い返し参照を追加する**

SKILL.md の Step 1 の末尾に追加：

```markdown
依頼が曖昧で intent や資料種別が判断できない場合は、検索前に問い返す。
詳細は [heuristics/clarifying-questions.md](heuristics/clarifying-questions.md) を参照。
```

- [ ] **Step 3: SKILL.md の詳細リファレンスにリンクを追加する**

```markdown
- [heuristics/clarifying-questions.md](heuristics/clarifying-questions.md) — 問い返しガイダンス
```

---

## Task 3: 分野別調査シナリオの拡充

**Files:**
- Modify: `.cursor/skills/jp-lit-research/workflows/research-guide-lookup.md`

実行時に NDL リサーチ・ナビ（`https://ndlsearch.ndl.go.jp/rnavi/humanities/`）を WebFetch して、
分野別の推奨 DB・調査順序の知識を補完してから書く。

- [ ] **Step 1: NDL リサーチ・ナビの主要分野ページを WebFetch して内容を確認する**

対象:
- `https://ndlsearch.ndl.go.jp/rnavi/humanities/` （人文総覧）
- `https://ndlsearch.ndl.go.jp/rnavi/humanities/post_101094` （文学作品の初出）
- `https://ndlsearch.ndl.go.jp/rnavi/humanities/post_101121` （人物文献）

- [ ] **Step 2: research-guide-lookup.md の分野別 DB 表を、調査シナリオ付きに書き換える**

現在の表を以下の形式に拡充する：

```markdown
## 分野別調査シナリオ

### 国文学・古典籍

**まずこれ:**
1. `nihu_bridge` で専門 DB 横断（国書データベース等を含む。normalize=true で旧字自動対応）
2. `ndl_digital` でデジタル化一次資料を確認（available=true なら全文検索も）
3. `cinii_articles` で二次文献（論文）を収集

**なぜこの順か:** 国文学は nihu_bridge の国文研・国語研 DB が最も専門性が高い。
一次資料はデジコレに多く、全文検索で本文から逆引きできる。

---

### 日本近現代史

**まずこれ:**
1. `ndl_catalog` で図書・単行本を確認
2. `cinii_articles` / `ndl_articles` で論文・雑誌記事
3. `ndl_digital` で官報・雑誌・新聞等の一次資料
4. 議会関連なら `kokkai_minutes` / `teikoku_minutes`

---

### 社会科学・社会調査

**まずこれ:**
1. `cinii_articles` / `jstage_articles` で論文
2. `jdcat` で研究データ・調査票・統計
3. `irdb` で学位論文・報告書

---

### 美術・文化財・地域資料

**まずこれ:**
1. `japan_search` で博物館・文化財 DB 横断
2. `jp_lit_search_illustrations` で図版検索（デジコレ 860 万点）
3. `nihu_bridge` で国民博・人環の専門 DB

**なぜ japan_search が先か:** 美術品・文化財・地域アーカイブは japan_search が最も網羅的。
nihu_bridge は民俗・考古に強い補完 DB として使う。

---

### 日本語学・言語研究

**まずこれ:**
1. `nihu_bridge` で国語研コーパス・方言 DB 横断
2. `cinii_articles` / `ndl_articles` で論文
3. `ndl_digital` + 全文検索で用例確認

---

### 宗教・仏教・神道

**まずこれ:**
1. `nihu_bridge`（大蔵経関連 DB を含む）
2. `ndl_catalog` / `ndl_digital` で図書・一次資料
3. NDL リサーチ・ナビ「大蔵経を調べる」を案内
```

---

## Task 4: Japan Search 動線強化

**Files:**
- Modify: `.cursor/skills/jp-lit-research/heuristics/source-selection.md`
- Modify: `.cursor/skills/jp-lit-research/workflows/topic-literature-review.md`

- [ ] **Step 1: source-selection.md のドメイン判定表で Japan Search の発火条件を広げる**

現在の「文化財・美術・地域資料」行を以下に更新：

```markdown
| 美術・文化財・地域資料・博物館資料 | 「作品」「文化財」「地域」「コレクション」「博物館」「民具」「遺跡」「浮世絵」 | `japan_search`（主力）+ `jp_lit_search_illustrations` + `nihu_bridge` |
```

また、「国文学・歴史・民俗」行に japan_search を補助として追加：

```markdown
| 国文学・日本語学・歴史・民俗・考古 | 固有名詞が古典的、時代名・地域名が含まれる | `nihu_bridge`（必須）+ `ndl_digital` + `japan_search`（物質文化が含まれる場合）|
```

- [ ] **Step 2: source-selection.md の source 組み合わせパターンに Japan Search の使い分けを追記する**

```markdown
### 「文献と現物（美術品・文化財）の両方を調べたい」

```
cinii_articles / ndl_catalog（文献）
+ japan_search（現物・資料）
+ nihu_bridge（民俗・考古の専門 DB）
```
```

---

## Task 5: SKILL.md Step 5 への DB説明参照の追加

**Files:**
- Modify: `.cursor/skills/jp-lit-research/SKILL.md`

Step 5（検索方針提示）でユーザーに「なぜそのDBか」を説明できるよう、db-characteristics.md への参照を明示する。

- [ ] **Step 1: SKILL.md Step 5 の提示例を更新する**

現在の提示例の後に追加：

```markdown
各 DB の特性説明は [heuristics/db-characteristics.md](heuristics/db-characteristics.md) を参照。
ユーザーに「なぜそのDBか」を問われたとき、または方針提示時に自発的に説明する。
```

---

## 検証チェックリスト

各 Task 完了後に確認：

- [ ] 「江戸の医療について調べて」→ 問い返し（資料種別）が発生するか、nihu_bridge が提案されるか
- [ ] 「国文学の論文を探して」→ nihu_bridge が standard の提案に入るか
- [ ] 「浮世絵の図版を見たい」→ japan_search + jp_lit_search_illustrations が提案されるか
- [ ] 「なぜ nihu_bridge を使うの?」→ db-characteristics.md の説明が使われるか
- [ ] 「全部見せて」→ 選別前の全件開示ができるか（既存実装で対応済み）
