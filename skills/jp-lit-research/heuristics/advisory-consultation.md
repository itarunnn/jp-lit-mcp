# 調査前情報収集（advisory-consultation）

レファ協とリサーチ・ナビを、検索前の**調査計画生成**に使うためのルール。
ここで得た情報は「答え」ではなく、Step 5 でユーザーに提示する調査計画の材料として扱う。

---

## 目的

この手順で作るものは次の 5 つだけ。

- `keyword_candidates` — 追加で試す検索語候補
- `source_candidates` — 優先して叩く source 候補
- `reference_tools` — 辞典・索引・参考図書などの補助資料
- `suggested_sequence` — 調査順序の候補
- `first_pass_plan` — 今回まず実行する検索計画

---

## いつ使うか

未知の文献・資料・調べ方を探索する調査では、実検索の前に原則としてこの手順を使う。レファ協とリサーチ・ナビを見て、最初に叩く source、検索語、見るべき索引・参考図書を決めてから MCP 検索へ進む。

省略してよいのは、タイトル・著者・ISBN・NCID・DOI などが明確で、単純な所蔵確認・書誌確認だけを行う場合。省略後に 0 件、ノイズ過多、初出・掲載号・一般誌記事探索へ分岐したら、この手順に戻る。

| intent | 実行条件 |
|--------|---------|
| `research_guide` | 常に実行 |
| `topic_literature_review` | 実行 |
| `historical_term_search` | 実行 |
| `bibliography_lookup` | 単純な所蔵・書誌確認は省略可。初出、掲載号、雑誌記事、同定困難、0 件時は実行 |
| `fulltext_page_lookup` | 省略 |
| `image_illustration_search` | 美術・文化財・地域資料の場合のみ実行 |

`topic_literature_review` であっても、人名単独、回想記事、雑誌目次、一般誌記事、初出、掲載号探索、0 件・ノイズ過多の再計画では省略しない。レファ協は「類似質問と調査プロセス」、リサーチ・ナビは「分野別の調査順序と見るべき索引」を補うために使う。

---

## 抽出ルール

### 1. レファ協を確認する

```
jp_lit_search_guides_manuals(query=テーマ, limit=3)
jp_lit_search_guides_cases(query=テーマ, limit=3)
```

#### `jp_lit_search_guides_manuals` から取るもの

- `search_keywords` → `keyword_candidates`
- `guide_headings` → 資料類型の候補
- `reference_sources` → `source_candidates` と `reference_tools`

`manuals` は「どんな資料・索引・参考図書から始めるべきか」を決める材料として重く扱う。

#### `jp_lit_search_guides_cases` から取るもの

- `answer_process` → `suggested_sequence`
- `reference_sources` → `reference_tools`
- タイトル / 要約 / 見出しに出る類似表現 → `keyword_candidates`

`cases` は「どういう切り口で再検索するか」「どんな順番で追うか」を決める材料として使う。

### 2. リサーチ・ナビを確認する（Web 検索）

リサーチ・ナビは API / MCP source ではなく Web 上の調べ方案内として扱う。まず Web 検索で `site:ndlsearch.ndl.go.jp/rnavi <固有名詞または主題語>` を試す。固有名詞 query が不発なら `site:ndlsearch.ndl.go.jp/rnavi <調査類型> 調べ方`、`人物文献 伝記 探す`、`雑誌記事 探し方`、`新聞記事 探し方`、`日本文学 論文 調べ方` のように抽象化する。

ドメインが明らかな場合は、下記テーブルから最も近い URL も開いて確認する。
対応する URL がなければ `https://ndlsearch.ndl.go.jp/rnavi/humanities/` のインデックスまたはリサーチ・ナビトップを開いて関連ガイドを探す。

| ドメイン | URL |
|---------|-----|
| 人文（全般・入口） | https://ndlsearch.ndl.go.jp/rnavi/humanities/ |
| 雑誌の総目次・バックナンバー | https://ndlsearch.ndl.go.jp/rnavi/humanities/post_559 |
| 文学作品の初出・書誌確認 | https://ndlsearch.ndl.go.jp/rnavi/humanities/post_101094 |
| 人物・伝記文献 | https://ndlsearch.ndl.go.jp/rnavi/humanities/post_101121 |
| 美術・浮世絵・図版 | https://ndlsearch.ndl.go.jp/rnavi/humanities/post_697 |
| 宗教・仏教・大蔵経 | https://ndlsearch.ndl.go.jp/rnavi/humanities/post_101024 |

取るもの:

- 推奨する索引・参考図書・DB → `source_candidates` / `reference_tools`
- 調査上の注意点・基本順序 → `suggested_sequence`
- 分野固有の主題語 → `keyword_candidates`
- 試した Web 検索 query とヒット / 不発の状態 → trace / 調査ログ

リサーチ・ナビは query 候補そのものより、**分野全体の入口・調査順序・見るべき資料類型**の補正に重みを置く。

リサーチ・ナビが参考書誌、専門索引、年鑑、目録、事典、契約 DB、館内限定 DB、商用新聞 DB などを勧めている場合は、MCP の `source` として扱わず `reference_tools` に入れる。人文系調査は無料オンライン資料だけで完結しないことが多いため、示唆された参考図書・有料 DB は弱い補足にせず、Step 5 の計画と最終回答の `参考書誌・有料DBの次アクション` に `参考書誌確認` または `要有料DB確認` として積極的に示す。リサーチ・ナビで推奨されていたことを根拠として添え、人間が試しやすい確認先と検索語案を出す。

### 3. 結果を Step 5（方針提示）に組み込む

1・2 で得た情報を、次の優先順位で統合する。

#### 優先順位

- 調査順序:
  - リサーチ・ナビ > `guides_cases.answer_process` > 分野別シナリオ
- source 候補:
  - リサーチ・ナビ > `guides_manuals.reference_sources` > 分野別シナリオ
- query 候補:
  - `guides_manuals.search_keywords` > `guides_cases` の類似表現 > リサーチ・ナビの主題語
- 参考資料:
  - `guides_manuals.reference_sources` > `guides_cases.reference_sources`

#### 制約

- レファ協やリサーチ・ナビの本文を結論として扱わない
- 長文引用をしない
- `reference_tools` と `source` を混同しない
- `ndl_search` / `japan_search` は新規テーマの既定セットとして扱い、リサーチ・ナビやレファ協が示した専門 DB / source を追加する
- レファ協・リサーチ・ナビが示した参考図書・専門索引・有料 DB は、無料オンライン未完結を補う主要な次アクションとして計画に入れる
- 固有名詞 query が不発なら、抽象度を上げた調べ方 query を試してから初手計画を作る
- 初手 query は 2〜5 個まで

統合後に `first_pass_plan` を作り、Step 5 でユーザーに提示する。

提示テンプレート（方針の冒頭に含める）:
```
▍調査前情報収集
- レファ協の類似事例: 〇〇（着眼点: ...）
- レファ協で得たキーワード候補: ...
- リサーチ・ナビの推奨調査順序: ...

▍今回の調査計画
- 使う source: ...
- 検索語: ...
- 参考書誌・有料DBの次アクション: ...
- 調査順序: ...
- 初手で確認すること: ...
```

---

## 結果がない場合

- レファ協でヒット 0 件: 上位語・類義語でリトライし、それでもなければスキップ
- リサーチ・ナビに対応ページなし: `site:ndlsearch.ndl.go.jp/rnavi ...` の抽象 query とインデックス（`rnavi/humanities/`）確認を試す。見つからなければスキップし、試した query と「対応ページなし」を trace / 調査ログに残す

---

## 位置づけ

- レファ協 / リサーチ・ナビ = 調査計画の材料
- 検索用 MCP = 実際の資料検索
- Skill = 材料を検索計画へ変換して、確認後に実検索へ進める
