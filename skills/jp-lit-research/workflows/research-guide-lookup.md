# 調べ方を調べるワークフロー（research_guide）

## 対象となる依頼

- 「何を使って調べればいいかわからない」
- 「〇〇分野の調べ方を教えてほしい」
- 「リサーチ・ナビやレファ協で調べ方を確認したい」
- 「どの DB から始めればいいか」

---

## 基本方針

リサーチ・ナビ / レファ協は **調査ルートの発見** に使う。そこで得た DB リスト・分類語を使って MCP で実検索する。

```
リサーチ・ナビ / レファ協  = 調査ルートの発見
jp-lit MCP               = 実際の資料検索
LLM                      = 結果の統合と説明
```

この workflow では、リサーチ・ナビ / レファ協を見て終わりにしない。そこから

- `keyword_candidates`
- `source_candidates`
- `reference_tools`
- `suggested_sequence`
- `first_pass_plan`

を作り、検索前に必ずユーザーへ提示する。

---

## フロー

### 1. 分野・テーマを特定する

ユーザーの質問から:
- 分野: 歴史 / 文学 / 法律 / 社会学 / 民俗 / 美術 / etc.
- 時代: 古代 / 中世 / 近世 / 近代 / 現代
- 資料種別: 論文 / 図書 / 一次資料 / 統計 / 画像

### 2. 調査前情報収集を行う

[heuristics/advisory-consultation.md](../heuristics/advisory-consultation.md) の手順に従う。
`research_guide` intent では常に調査前情報収集を行う。

- レファ協（`jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases`）で類似事例・マニュアルを確認
- Web 検索でリサーチ・ナビの該当ページを探し、見つかったページまたはドメインに対応する URL を開いて確認
- 得られたキーワード・DB候補・調査手順をステップ 3 の分野別シナリオと照合して、`keyword_candidates` / `source_candidates` / `reference_tools` / `suggested_sequence` を作る

### 3. 分野別調査シナリオ

分野を判定したら、以下のシナリオを参考に調査順序を提案する。

#### 国文学・古典籍

**まずこれ:**
1. `nihu_bridge` で専門 DB 横断（国書データベース・日本語歴史コーパス等を含む。normalize=true で旧字自動対応）
2. `ndl_digital` でデジタル化一次資料を確認（available=true なら全文検索も）
3. `cinii_articles` / `ndl_articles` で二次文献（論文）を収集

**なぜこの順か:** 国文学は nihu_bridge の国文研・国語研 DB が最も専門性が高い。一次資料はデジコレに多く、全文検索で本文から逆引きできる。

---

#### 日本近現代史

**まずこれ:**
1. `ndl_catalog` で図書・単行本を確認
2. `cinii_articles` / `ndl_articles` で論文・雑誌記事
3. `ndl_digital` で官報・雑誌・新聞等の一次資料
4. 議会関連なら `kokkai_minutes` / `teikoku_minutes`

**なぜこの順か:** 近現代史は図書・論文が豊富なため、NDL・CiNii 系 source が重要な入口になる。一次資料はデジコレに多数収録されている。

---

#### 社会科学・社会調査

**まずこれ:**
1. `cinii_articles` / `jstage_articles` で論文
2. `jdcat` で研究データ・調査票・統計
3. `irdb` で学位論文・報告書

**なぜこの順か:** 社会科学は CiNii が網羅的。量的研究なら jdcat で調査データ本体も確認できる。

---

#### 美術・文化財・地域資料・博物館資料

**まずこれ:**
1. `japan_search` で博物館・文化財 DB 横断（文化庁・国立博物館・地域アーカイブを含む）
2. `jp_lit_search_illustrations` で図版検索（デジコレ 860 万点）
3. `nihu_bridge` で国民博・人環の専門 DB（民俗・考古）

**なぜこの順か:** 美術品・文化財・地域資料は japan_search が最も網羅的。nihu_bridge は民俗・考古の補完 DB として使う。

---

#### 日本語学・言語研究

**まずこれ:**
1. `nihu_bridge` で国語研コーパス・方言 DB 横断
2. `cinii_articles` / `ndl_articles` で論文
3. `ndl_digital` + 全文検索で用例確認

**なぜこの順か:** 言語研究は国語研のコーパス・方言 DB が nihu_bridge 経由で使える点が強み。

---

#### 宗教・仏教・神道

**まずこれ:**
1. `nihu_bridge`（大蔵経関連 DB・宗教文献を含む）
2. `ndl_catalog` / `ndl_digital` で図書・一次資料
3. NDL リサーチ・ナビ「大蔵経を調べる」（`https://ndlsearch.ndl.go.jp/rnavi/humanities/post_101024`）を案内

---

#### 文学作品の初出・書誌確認

**まずこれ:**
1. `ndl_articles` で初出雑誌記事を検索（`sort_by=issued_date, sort_order=asc`）
2. `cinii_articles` でも同様に確認
3. `ndl_digital` + `jp_lit_search_fulltext` で全文から逆引き（出版日の古い順に並べ替え）
4. NDL リサーチ・ナビ「文学作品の初出を調べる」（`https://ndlsearch.ndl.go.jp/rnavi/humanities/post_101094`）を案内

**なぜこの順か:** 初出調査は発行年昇順ソートで最初の掲載を特定する。デジコレ全文検索は雑誌原本の確認に有効。単行本の奥付・解題に初出情報が記載されている場合もある。

### 4. 調査計画を組み立てる

ステップ 2 と 3 を統合して `first_pass_plan` を作る。

最低限、次を決める。

- 最初に使う source（`ndl_search` + `japan_search` + 調べ方で示唆された source）
- 初手の検索語（2〜5 個まで）
- 調査順序
- 先に確認すべき参考資料や索引

### 5. 調査計画を提示してから実行する

`research_guide` intent では、検索前に必ず調査計画を提示してユーザーに確認を取る。

提示テンプレート:
```
【調べ方の見取り図】

▍調査前情報収集
- レファ協マニュアル: ...
- レファ協事例: ...
- リサーチ・ナビ: ...（Web検索 query / 参照ページ / 不発なら対応ページなし）

▍今回の調査計画
- 使う source: ...
- 検索語: ...
- 参考書誌・有料DBの次アクション: ...
- 調査順序: ...
- 初手で確認すること: ...

よろしければ開始します。
```

### 6. 実検索する

ユーザー確認後に、`first_pass_plan` に従って検索用 MCP を呼ぶ。

---

## 0件・行き止まり時の再計画

- query が弱い → `keyword_candidates` を追加する
- source が弱い → `source_candidates` を組み替える
- 調査順序が合わない → `suggested_sequence` を見直す
- 一般 DB で弱い → `reference_tools` に出た索引・事典・参考図書を案内する

---

## 調べ方テンプレート（ユーザーへの説明用）

```
【〇〇の調べ方案内】

1. まずメタデータ検索
   → ndl_search / japan_search を既定セットにし、調べ方案内で示唆された専門 DB / source を加える

2. 論文・紀要
   → cinii_articles / jstage_articles / ndl_articles / irdb

3. 図書・単行本
   → ndl_catalog / cinii_books

4. 一次資料・デジタル化資料
   → ndl_digital → available=true なら全文検索も可能

5. 専門 DB
   → （分野に応じて nihu_bridge / jdcat / kokkai_minutes 等）

6. 見つからない場合
   → 表記ゆれ展開 / 全文検索 / 調べ方案内（リサーチ・ナビ）を確認
```
