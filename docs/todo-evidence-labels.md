# TODO: 文献調査レポートの確認ラベルを誤用しにくくする

作成日: 2026-06-14

状態: 反映済み

反映先:

- `skills/jp-lit-research/SKILL.md`
- `skills/jp-lit-research/reference/03-evidence-and-output.md`
- `skills/jp-lit-research/heuristics/evidence-grading.md`
- `skills/jp-lit-research/workflows/fulltext-page-lookup.md`
- `skills/jp-lit-research/heuristics/query-expansion.md`
- `skills/jp-lit-research/heuristics/failure-modes.md`
- `skills/jp-lit-research/reference/01-core-workflow.md`
- `skills/jp-lit-research/heuristics/source-selection.md`
- `docs/usage-guide.md`
- `tests/skillGuide.test.ts`

## 背景

Stewart Culin の日本における受容を調査した際、回答内で `確認済み` という語を本文確認と関連性確認の両方に近い意味で使ってしまい、次の区別が曖昧になった。

- 本文または該当箇所を読んだ
- 目次・章題・要旨・抄録で関連文献であることを確認した
- NDL Search などで検索ヒットしただけで、関連性は未確定

`skills/jp-lit-research/` の現行ルールには `確認: 書誌 / 要旨 / 目次 / 本文` と `本文: 未確認 / アクセス制限 / 確認済み` の区別がすでにあるが、`確認済み` という単語が複数レイヤーに出るため、短い報告で丸めると誤読を誘いやすい。

## 対応方針

- 単独の `確認済み` を文献リストの主要ラベルとして使わない。
- 候補ごとに `確認:` と `本文:` を必ず併記する運用へ寄せる。
- 3段階評価の `確認済み` は、必要なら `書誌確認済み` または `候補確度: 高` のような名称へ変更する。
- 検索結果だけで本文・要旨・目次のいずれも確認できていないものは、`検索ヒットのみ / 関連性未確定` として明示する。
- `availability.online=true`、デジコレリンク、PDF/HTML 入口の存在を本文確認として扱わない、という既存ルールを出力例にも反映する。

## 修正候補

- `skills/jp-lit-research/SKILL.md`
  - 最終回答前チェックに「単独の `確認済み` を使っていないか」を追加する。
  - `検索ヒットのみ / 関連性未確定` ラベルを本文確認ラベルとは別に定義する。
- `skills/jp-lit-research/reference/03-evidence-and-output.md`
  - 3段階評価の `確認済み` を改名するか、候補確度ラベルであることをより強く書く。
  - リスト出力例に `確認:` と `本文:` の併記を必須として明示する。
  - `検索ヒットのみ` の例を追加する。
- `skills/jp-lit-research/heuristics/evidence-grading.md`
  - `確認済み（Confirmed）` の名称を見直す。
  - 「書誌・候補としての確からしさ」と「内容把握の確からしさ」を混同しない例を追加する。

## 追加TODO: デジコレOCR検索の複合語仕様を明記する

Stewart Culin 調査中に、次世代デジタルライブラリー OCR 全文検索で `キューリン 博士`、`キュウリン 博士`、`キユーリン 博士` のような空白入り query が 0 件になる一方、単独語ではヒットすることを確認した。

API仕様上、Book API `book/search` の `keyword` および Page API `page/search` の `q-contents` は「検索キーワード」とされるだけで、空白AND、`AND` 演算子、ブール検索は明示的に提供・保証されていない。repo 側の `jp_lit_search_fulltext` / `jp_lit_search_pages` も query を分解せず、そのまま上流 API に渡している。

### 追記候補

- `skills/jp-lit-research/workflows/fulltext-page-lookup.md`
  - `jp_lit_search_fulltext` では空白ANDや `AND` を仕様として期待しないことを明記する。
  - 複合語で 0 件でも「両語が同一資料に存在しない」と判断せず、単語単位で検索して後段でスニペット・本文・資料内検索を確認する運用を書く。
  - `jp_lit_search_pages` は既知 PID 内で複合語が当たる場合があるが、AND 仕様として扱わず補助確認に留める、と書く。
- `skills/jp-lit-research/heuristics/query-expansion.md`
  - 人名・歴史語・表記ゆれ探索では、複合検索語より単語単位の検索語展開を優先する注意を追加する。
- `skills/jp-lit-research/heuristics/failure-modes.md`
  - デジコレ OCR 全文検索で複合語 0 件の場合は、検索語を単語単位に戻す failure mode を追加する。

### 受け入れ条件

- `jp_lit_search_fulltext(keyword="A B")` の 0 件を、A と B の共起なしと断定しない。
- 調査ログに、単独語検索と複合語検索を分けて記録し、複合語 0 件の解釈を明示できる。
- Culin 例のように `キューリン` 単独ヒットがあるのに `キューリン 博士` が 0 件になるケースを、skill guide test または実例メモとして残す。

## 追加TODO: 長期調査の checkpoint とサブエージェント分担契約を明記する

Stewart Culin 調査では複数回のコンパクションが起きたが、サブエージェント分担は使わず、session trace、TODO、repo レポート、Obsidian ノートによる引き継ぎで継続できた。

一方で、長期の文献探索では、表記ゆれ、時代区分、source、本文確認状態、ノイズ語が増え、単一エージェントの作業文脈だけに依存すると compaction 後に判断基準がずれやすい。スキルでは、サブエージェントの具体的な呼び出し API を固定するのではなく、アプリ横断で使える「分担契約」を定義する。

### 追記候補

- `skills/jp-lit-research/SKILL.md`
  - 長期調査では、一定間隔で rolling checkpoint を作ることを明記する。
  - サブエージェントは「検索・候補整理・ノイズ判定」を担当し、結論・候補ラベル・本文確認状態・受容史上の位置づけは主エージェントが統合判断する、と明記する。
- `skills/jp-lit-research/reference/01-core-workflow.md`
  - compaction に備える checkpoint の最小項目を追加する。
  - サブエージェント機能がない環境では、同じ単位で sequential に処理し、各単位ごとに handoff report を残す、と書く。
- `skills/jp-lit-research/reference/03-evidence-and-output.md`
  - サブエージェント / sequential 担当単位から返す handoff report のテンプレートを追加または強化する。
- `skills/jp-lit-research/heuristics/source-selection.md`
  - 独立した調査線が複数ある場合の分担例を追加する。

### サブエージェント分担を検討する条件

- 独立した調査線が 2 本以上ある。
- source、時代、表記群、媒体、地域、言語などで担当範囲を分けられる。
- 片方の結果を見ないともう片方の検索語が決まらない、という依存が薄い。
- 主エージェントが統合判断を持ち続けられる。

例:

- `戦前デジコレ OCR 担当`
- `J-STAGE / CiNii 現代研究担当`
- `館内確認・雑誌号所蔵担当`
- `表記ゆれ・ノイズ語調査担当`

### 分担依頼テンプレート案

```md
## サブエージェント担当依頼

- 担当範囲:
- 調査目的:
- 使用してよい source:
- 検索語候補:
- 既知の確認済み事項:
- 除外してよいノイズ:
- 禁止事項:
  - 本文未読資料を本文確認済み扱いしない
  - 検索ヒットのみを関連文献と断定しない
  - 複合語 0 件を不在証明にしない
- 必須出力:
  - 検索語
  - source
  - total / 取得件数 / 抽出件数
  - 採用候補
  - 保留候補
  - 除外語・ノイズ
  - 本文確認範囲
  - 未確認事項
  - 次アクション
```

### rolling checkpoint 最小項目案

- 調査目的と現在の scope
- 採用候補 / 保留候補 / 検索ヒットのみ候補
- 本文確認済み / 目次確認 / 書誌確認 / 未確認の区別
- 試した検索語と有効だった検索語
- ノイズ語・除外理由
- source ごとの total / 取得件数 / 抽出件数
- 未確認事項
- 次アクション
- cache key / session id / 関連ファイル

### 受け入れ条件

- 長期調査や compaction 発生後でも、checkpoint だけで調査の現在地、確認済み範囲、次アクションを復元できる。
- サブエージェントを使った場合、各担当の handoff report に source、query、件数、採否理由、本文確認範囲、未確認事項が残る。
- サブエージェントを使わない場合でも、同じ単位で sequential に調査し、担当単位ごとの report を残せる。
- 環境固有の `Task()` 等の呼び出し API に依存せず、アプリ横断で適用できる記述になっている。

## 受け入れ条件

- 文献候補の出力で、本文未読資料が `本文: 確認済み` または単独の `確認済み` と表示されない。
- 目次・要旨・抄録で関連性を確認した資料は、`確認: 目次` / `確認: 要旨` と表示され、本文未確認であることが同じ項目内で分かる。
- NDL Search などの検索ヒットのみの資料は、関連性未確定として保留に残せる。
- 既存テストまたは skill guide test に、本文確認ラベルの誤用を防ぐケースを追加する。
