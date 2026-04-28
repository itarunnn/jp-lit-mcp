Skill作るなら、リサーチ・ナビとレファ協はかなり良い出発点。
ただ、それだけだと「NDL職員・図書館員の調査パターン」には寄るけど、**MCPにどう検索させるか** という実装知識までは足りない。なので、参考資料は3層に分けるのがよさそう。

## 追加で参考にすると良いもの

### 1. NDLのレファレンスサービス研修資料

これはかなり見る価値ある。
NDLは「人文情報の調べ方」や「科学技術情報の調べ方」などのレファレンス研修資料を公開している。2026年公開の「人文情報の調べ方―応用編―」では、人文分野のレファレンス傾向、生成AIの動向、NDL提供ツールの応用的な使い方、所蔵調査・書誌的事項調査・情報源紹介・簡易な事実調査の4類型を扱っている。([国立国会図書館][1])

これはSkill設計に直結する。
特に「質問をどう分類するか」の参考になる。

```text
質問タイプ分類:
- 所蔵調査
- 書誌的事項の確認
- 文献紹介
- 事実調査
- 調査方法の案内
- 本文・ページ特定
- 画像・図版探索
```

Skillにはこの分類を入れるといい。

---

### 2. NDL遠隔研修教材

NDLの遠隔研修ページには、法令・判例、議会資料、官庁資料などの調べ方教材がある。たとえば、議会資料では会議録、議案、予算・決算、質問主意書・答弁書など、官庁資料では白書、公的統計、審議会資料などの探し方が扱われている。([国立国会図書館][2])

これは社会科学寄りのSkillにかなり有用。

特にMCP用Skillなら、

```text
「これは論文検索だけでは足りない」
→ 会議録
→ 官庁資料
→ 白書
→ 統計
→ 法令
→ 公文書
```

みたいな分岐ルールを作れる。

---

### 3. レファレンス支援コーナー

NDLには図書館員向けの「レファレンス支援コーナー」があり、各種分野のレファレンスサービスに役立つ情報を紹介している。([国立国会図書館][3])

これはレファ協・リサーチナビと同じく、「回答そのもの」より **調査の型** を学ぶ材料として使うとよい。

---

### 4. リサーチ・ナビのAPI仕様

リサーチ・ナビは現在、レファレンス協同データベースの検索用API 2.0から検索できる。リサーチ・ナビデータを検索する場合は、検索区分に `manual` または `collection` を指定し、提供館コード `lib-id=1110001` で絞る形が案内されている。([国立国会図書館サーチ（NDLサーチ）][4])

これは重要。
Skillの参考資料として読むだけでなく、**MCPまたはSkill側から調査ガイドを検索する補助ツール** にできる。

たとえば、

```text
ユーザー: 明治期の新聞記事を探したい
Skill:
1. refsearch type=manual, lib-id=1110001, query=新聞 明治
2. リサーチ・ナビの該当ガイドを読む
3. そこで示されたDB順にMCP検索
```

みたいにできる。

---

### 5. Japan Searchの開発者向け情報

すでにJapan Search対応済みだけど、Skillの参考にするなら、Japan Searchの「アイテム参照API」「連携DB」「テーマ別検索」あたりを見るといい。Japan Searchの参照APIは、アイテム、連携データベース、連携機関、ギャラリー、テーマ別検索などのメタデータを扱う。([ジャパンサーチ][5])

Japan Searchは「検索対象」というより、

```text
どの機関・どのDBに資料がありそうかを見る
```

ために使うとよさそう。

Skill側では、Japan Searchを既定横断に入れず、

```text
資料種別が美術・文化財・地域資料・画像・博物館資料っぽいときだけ使う
```

くらいが良いと思う。

---

### 6. JPCOARスキーマ / IRDB技術情報

IRDBを今後入れるなら、JPCOARスキーマは見た方がいい。
JPCOARスキーマは日本の機関リポジトリのメタデータ相互運用性を高めるための規格で、ガイドラインやFAQが公開されている。([IRDB][6])
IRDB側も、OAI-PMHで機関リポジトリのメタデータを収集し、対象メタデータはJPCOARスキーマまたはjunii2をサポートする必要があると説明している。([IRDB Support][7])

これはSkillというより、MCPの正規化設計に効く。

```text
Skill側で重視する項目:
- resource_type
- title
- alternative_title
- creator
- contributor
- publisher
- date
- subject
- description
- identifier
- DOI
- fulltext URL
- rights
- repository
```

---

## Skillは「検索手順を選ぶ」役にするのが良い

MCP本体は今のREADME通り、検索・取得に徹している。
その上に載せるSkillは、**どの順番で、どのsourceを、どんな検索語で使うかを決める層** にするといい。

つまり、Skillはこういう役割。

```text
MCP:
- DBを検索する
- レコードを取得する
- OCR本文を取る
- ページを特定する
- 図版を探す

Skill:
- 質問タイプを分類する
- 検索対象DBを選ぶ
- 検索語を展開する
- 検索順序を決める
- 見つからない場合の次手を決める
- 典拠の強さを評価する
```

要するに、**図書館員的な調査戦略** をSkillに入れる。

## Skillの中身はこう分けると良い

### 1. intent分類

最初にユーザーの依頼を分類する。

```text
bibliography_lookup:
  書名・論文名・著者・刊行年などの確認

holding_lookup:
  どこに所蔵されているか

fulltext_lookup:
  本文中に語が出るか

page_location:
  どのページに出るか

historical_term_search:
  古い語・表記ゆれを含む検索

topic_literature_review:
  テーマに関する文献を集める

primary_source_search:
  一次資料・史料・会議録・公文書を探す

image_illustration_search:
  図版・挿絵・画像を探す

research_guide:
  何を使って調べればよいか
```

これがないと、全部 `jp_lit_search` に投げがちになる。

---

### 2. source選択ルール

たとえばこんな感じ。

```text
近代以降の図書・雑誌:
  ndl_catalog → ndl_digital → cinii_books

論文・紀要:
  cinii_articles → jstage_articles → ndl_articles → irdb

古い雑誌記事:
  ndl_articles → ndl_digital → ndl_catalog

本文中の語を探す:
  jp_lit_search_fulltext → jp_lit_search_pages → jp_lit_get_text_coordinates

図版・挿絵:
  jp_lit_search_illustrations → japan_search

所蔵確認:
  ndl_catalog → cinii_books

調べ方が不明:
  research_navi → refcoop → その後にMCP検索
```

IRDBを追加したら、論文・紀要系ではかなり上位に置いていい。

---

### 3. 検索語展開ルール

ここが一番Skillらしい部分。
人文社会系では、検索語がそのままだと弱い。

例：

```text
現代語:
  ポーカー

表記ゆれ:
  ポーカ
  ポーカア
  ポーケル

漢字・旧語:
  骨牌
  西洋骨牌
  賭博
  賭技
  遊戯
  遊戲
  トランプ
  かるた
  カルタ
```

Skillには、検索語展開をこういう形式で書くといい。

```yaml
term_expansion:
  default:
    - exact
    - orthographic_variants
    - old_character_variants
    - related_terms
    - broader_terms
    - narrower_terms

  historical_japanese:
    - 旧字
    - 異体字
    - カタカナ表記ゆれ
    - 翻訳語
    - 明治・大正期の言い換え
    - 当時の分類語
```

LLMに完全自動で語を出させると幻覚も出るので、

```text
推測語は「候補」として扱う
実際にヒットした語だけを採用する
検索ログに残す
```

というルールが必要。

---

### 4. 検索の深さを段階化する

Skillには「軽く探す」と「本気で調査する」を分けた方がいい。

```text
quick:
  横断検索 1回
  上位10件
  明らかな候補のみ提示

standard:
  source別検索
  表記ゆれ2〜3種
  書誌詳細取得
  典拠つき要約

deep:
  リサーチ・ナビ/レファ協確認
  表記ゆれ展開
  NDL/CiNii/J-STAGE/デジコレ/次世代デジコレを順に検索
  本文検索
  ページ特定
  未発見の場合も検索過程を報告
```

ユーザーが「調べて」「探して」くらいなら `standard`。
「本気で」「網羅的に」「発表・論文用に」なら `deep`。

---

### 5. 典拠評価ルール

検索結果をそのまま出すとAI検索っぽくなるので、Skill側で典拠の強さを評価する。

```text
強い:
  公式DBの書誌
  DOIあり
  NDL/CiNii/J-STAGE/IRDBで一致
  本文OCRで確認済み
  ページ画像で確認済み

中:
  書誌のみ
  OCRヒットのみ
  Japan Search経由のメタデータ
  レファ協の事例に出た資料

弱い:
  タイトル類似
  LLM推測による関連語
  OCR断片だけ
  出典不明のWeb情報
```

特にデジコレOCRは誤認識があるので、

```text
OCR全文ヒットだけでは断定しない
重要箇所はページ画像または座標OCRで確認する
```

を入れた方がいい。

---

## Skillファイルの構成案

Claude / ChatGPT系のSkillにするなら、1ファイルに全部詰めるより、手順を短く分けるのが良い。

```text
jp-lit-research-skill/
  SKILL.md
  workflows/
    bibliography_lookup.md
    topic_literature_review.md
    historical_term_search.md
    fulltext_page_lookup.md
    image_illustration_search.md
    research_guide_lookup.md
  sources/
    ndl.md
    ndl_digital.md
    next_digital_library.md
    cinii.md
    jstage.md
    japan_search.md
    irdb.md
    research_navi.md
    refcoop.md
  heuristics/
    query_expansion.md
    source_selection.md
    evidence_grading.md
    failure_modes.md
```

`SKILL.md` は薄くして、細かい作法は下位ファイルに逃がす。
MCPと同じで、Skillも肥大化させない方がいい。

## SKILL.mdの骨子

こんな感じ。

```markdown
# Japanese Humanities/Social Sciences Literature Research Skill

## Purpose
Use the jp-lit MCP server to search Japanese humanities and social sciences literature, primary sources, digitized materials, articles, books, OCR full text, and illustrations.

## Core principle
Do not rely on a single search. Choose sources based on the user's intent, expand historical/orthographic variants, and distinguish bibliographic evidence from full-text/page-level evidence.

## Workflow
1. Classify the request.
2. Choose search depth: quick / standard / deep.
3. Select sources.
4. Expand query terms.
5. Search metadata first.
6. If needed, search OCR full text.
7. If needed, locate pages and retrieve OCR coordinates.
8. Grade evidence.
9. Report results with source, query terms, and uncertainty.

## Default source order
...
```

## かなり大事なルール

Skillには、次の禁止ルールを入れた方がいい。

```text
- 最初から全source横断しない
- Japan Searchを既定横断として使いすぎない
- OCRヒットだけで本文内容を断定しない
- 類似タイトルだけで同一資料と判断しない
- 旧字・異体字・カタカナ揺れを試さずに「見つからない」と言わない
- NDL Searchとデジコレと次世代デジコレを同じものとして扱わない
- レファ協の回答を一次情報として扱わない
```

最後のやつは重要。
レファ協は調査事例として強いけど、最終典拠ではない。そこに挙がっている資料を見に行くための導線として使う。

## リサーチ・ナビ / レファ協の使い方

この2つは、検索結果として出すより **調査計画を作る前処理** に使うのが良い。

```text
1. ユーザー質問を受ける
2. まずリサーチ・ナビ / レファ協で調べ方を確認
3. そこで挙がったDB・資料群・分類語を抽出
4. MCPで実検索
5. 見つかった資料を典拠付きで返す
```

つまり、

```text
リサーチ・ナビ / レファ協 = 調査ルートの発見
MCP = 実際の資料検索
LLM = 結果の統合と説明
```

という役割分担。

## MCPに追加したくなるけど、Skill側でいいもの

次のものは、MCP本体に入れず、まずSkill側のルールでよいと思う。

```text
- どのDBを先に使うか
- 検索語をどう展開するか
- どの程度網羅的に調べるか
- OCRヒットをどう評価するか
- レファ協をいつ使うか
- Japan Searchをいつ使うか
- 見つからない時の報告テンプレ
```

逆に、MCP本体に入れるべきなのは、

```text
- 新しいDB source
- レコード取得
- APIレスポンス正規化
- PDF URL / IIIF URL / OCR座標などの取得
```

この分離が崩れなければ、MCPもSkillも肥大化しにくい。

## 最初に作るべきSkillワークフロー

最初はこの5つで十分だと思う。

```text
1. 文献を探す
2. 書誌事項を確認する
3. デジコレ本文から語を探す
4. 古い語・表記ゆれで探す
5. 調べ方を調べる
```

特に4番が、このMCPの差別化ポイントになる。

## 例：ポーカー史調査用の動き

```text
ユーザー:
戦前日本のポーカー文献を探して

Skill:
1. intent = historical_term_search + topic_literature_review
2. terms = ポーカー / ポーカ / ポーカア / 骨牌 / 西洋骨牌 / トランプ / 賭博 / 遊戯 / 遊戲
3. sources:
   - ndl_digital
   - jp_lit_search_fulltext
   - ndl_articles
   - ndl_catalog
   - cinii_articles
   - cinii_books
4. first pass:
   metadata search
5. second pass:
   OCR fulltext search
6. page-level confirmation:
   search_pages → get_text_coordinates
7. output:
   confirmed / likely / weak候補に分ける
```

これが普通のAI検索との差になる。

## まとめ

追加で参考にするなら、優先度はこれ。

```text
1. NDLレファレンスサービス研修「人文情報の調べ方」
2. NDL遠隔研修教材
3. レファレンス支援コーナー
4. リサーチ・ナビAPI仕様
5. レファ協API仕様
6. JPCOARスキーマ / IRDB技術情報
7. Japan Search開発者向け情報
```

Skill設計としては、

```text
MCP = 検索・取得
Skill = 調査戦略・検索語展開・DB選択・典拠評価
```

に分けるのが一番良い。

最初から巨大Skillにせず、**「人文社会系日本語文献調査の作法」だけを薄く入れて、具体的なDB操作はMCPに任せる**。
これがいちばん壊れにくいと思う。

**確信度：0.9**
理由：リサーチ・ナビ、レファ協、NDL研修資料、NDL遠隔研修、JPCOAR/IRDB、Japan Searchの公式・準公式情報で、調査ガイド・API・メタデータ設計の位置づけを確認できた。実際のSkill仕様は使う実行環境によって微調整が必要だけど、「MCPは取得、Skillは調査戦略」という分離はかなり堅い。

[1]: https://www.ndl.go.jp/library/training/guide/260310_02?utm_source=chatgpt.com "令和7年度レファレンスサービス研修「人文情報の調べ方"
[2]: https://www.ndl.go.jp/library/training/remote?utm_source=chatgpt.com "遠隔研修のページ"
[3]: https://www.ndl.go.jp/library/news/260414_05?utm_source=chatgpt.com "レファレンス支援コーナー"
[4]: https://ndlsearch.ndl.go.jp/rnavi/about/help?utm_source=chatgpt.com "リサーチ・ナビについて"
[5]: https://jpsearch.go.jp/static/developer/webapi/ch2_inquiry_api.html?utm_source=chatgpt.com "2.1 アイテム参照 API"
[6]: https://schema.irdb.nii.ac.jp/ja?utm_source=chatgpt.com "JPCOARスキーマガイドライン"
[7]: https://support.irdb.nii.ac.jp/ja?utm_source=chatgpt.com "IRDB学術機関リポジトリデータベース サポート - 国立情報学 ..."
