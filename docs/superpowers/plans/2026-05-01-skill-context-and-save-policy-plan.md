# Skill の保存方針・コンテキスト管理計画

## 背景

`advice.md` は、長い調査で検索結果を会話コンテキストに抱え続けず、隠し保存物と圧縮メモを併用する設計を提案している。

ただし、この提案をそのまま全面採用すると、現行の `cache` / `session` / `export` 設計と責務が重複しやすい。
また、この repo の MCP は単体利用も重要であり、モデル都合の圧縮ロジックを MCP に入れるのは不適切である。

そのため本計画では、`advice.md` を批判的に採択し、**MCP は検索・取得・保存のまま維持し、圧縮と再読込の判断は Skill 側に限定する** 方針を採る。

## `advice.md` の評価

### 採用する点

- 会話に生の検索結果を長く保持しない
- 長い調査では、要点だけを圧縮して次に進む
- 必要な場面だけ cache / session / export を読み直す
- negative search を調査過程の一部として残す

### 採用しない点

- MCP 側へ会話圧縮専用の schema を追加すること
- 独立した `manifest` や `.research/` をすぐ導入すること
- サブエージェント前提で Skill を設計すること
- モデル都合の圧縮ルールを MCP の正式出力に混ぜること

## 現状の責務分離

### MCP

- 検索・取得・正規化済み結果の返却
- cache 保存
- session 保存
- ユーザー明示時の export

### Skill

- source 選択
- 検索語展開
- 調査順序の決定
- 典拠評価
- 会話中に何を残し、何を要約するかの判断

## 外部環境調査の結論

2026-05-01 時点の公開情報を前提にすると、サブエージェントや background agent はアプリごとに扱いが揺れる。

- Codex は App / CLI / IDE をまたぐ形で Skill や MCP の共有導線があるが、運用体験は入口ごとに異なる
- Cursor には Background Agents 系の機能があるが、通常の local Skill / MCP 導線と同一前提で配布すると説明が重くなる
- Claude Code 系も agent 機能の有無や呼び方を配布前提に固定しにくい

このため、**配布物としての Skill は単独エージェントで成立することを必須条件にし、サブエージェントは上級者向けの任意運用に留める**。

## 基本方針

1. MCP は圧縮しない
2. Skill が会話圧縮ルールを持つ
3. サブエージェントは optional として扱う
4. 既存の `cache` / `session` / `export` を再利用し、保存層は増やさない

## 実施計画

### Phase 1: Skill 運用原則の明文化

対象:

- `skills/jp-lit-research/SKILL.md`
- `skills/jp-lit-verification/SKILL.md`
- 必要に応じて workflow / heuristics

追加する原則:

- 生の検索結果を会話に大量貼り付けしない
- 長い調査では要点だけを簡潔にまとめて次に進む
- 断定、引用、candidate の格上げ、競合解消、export 作成時だけ cache/session を再確認する
- negative search は session / export に残っている前提で扱い、同じ失敗探索を無駄に繰り返さない
- サブエージェントは任意であり、Skill の成立条件ではない

### Phase 2: README / usage guide の整理

対象:

- `README.md`
- `docs/usage-guide.md`

追記する内容:

- MCP は検索・取得・保存を担う
- 会話圧縮や要約の仕方は Skill / agent 側の責務
- session 保存は調査ログであって、会話圧縮のための専用データ構造ではない
- サブエージェントは optional

### Phase 3: export 機能の整理と拡充

この段階は **MCP 側の正式機能として進めてよい**。
ただし、export を実際に作るかどうかを決める主体はエージェントであり、MCP はそのための共通整形機能を提供する。
理由は、ここで扱うのが会話圧縮ではなく、**内部保存された原本からユーザー向けの整形ビューを生成する機能** だからである。

#### 現状

現状の `jp_lit_export_session` は次だけを持つ。

- format: `markdown` / `json`
- `include_unselected`
- 現在 session 全体を一括出力

これは最低限の export としては機能しているが、次の用途にはまだ弱い。

- 採用候補だけ欲しい
- 候補から外したものだけ欲しい
- ヒットしなかった検索や空振りをまとめて見たい
- 文献検証 Skill の判定表だけ出したい
- 調査過程を「人に渡せるログ」として整理したい

#### 基本方針

- `MCP` の検索出力自体は変えない
- `.cache/` と `sessions/` を原本として使う
- `exports/` はその原本から作る派生ビューと位置づける
- export 実行はエージェントが `jp_lit_export_session` を呼んで行う
- 会話圧縮専用の概念は export schema に入れない

つまり、責務は次のとおり。

- cache
  - 正規化済み検索結果・取得結果の本体
- session
  - 採用候補・メモ・検索単位のまとまり
- export
  - MCP が提供する整形機能をエージェントが呼んで作るユーザー向けビュー

#### 拡充対象

##### 1. export profile の導入

`format` とは別に、**何を出すか** を指定する profile を追加する。

当初は複数案を比較したが、現時点の正式 profile は次の 3 つに整理した。

- `full_log`
  - 現行に近い。selected / unselected / notes を含む
- `selected`
  - `selected_items` 全体を出す
- `unselected`
  - 候補に残さなかった項目だけを出す

細分化した profile は利用者を混乱させやすいため、`confirmed_only` や `candidate_review` のような派生ビューはいったん採用しない。
必要になった場合でも、まずは `selected` / `unselected` と Markdown/JSON の運用で足りるかを確認してから再検討する。

##### 2. 出力形式の拡張

現行:

- `markdown`
- `json`

拡張候補:

- `csv`
  - 文献一覧や review queue に向く
- 将来候補:
  - `tsv`
  - `bibtex_like`

第一段階では `csv` 追加を検討対象にする。
ただし、`full_log` のような階層構造は Markdown / JSON が向いているため、すべての profile を CSV に対応させる必要はない。

##### 3. profile ごとの適切な format 制約

profile と format の相性は分ける。

- `full_log`
  - `markdown` / `json`
- `selected`
  - `markdown` / `json` / `csv`
- `unselected`
  - `markdown` / `json` / `csv`
これにより、CSV で無理に深いネストを表現しない。

##### 4. verification skill 向け export

`jp-lit-verification` は表形式の出力と相性がよい。
そのため、将来的には session/export 側で次の表ビューを作れるようにする余地がある。

- 抽出文献
- 推定タイプ
- 検証結果
- 判定理由
- 一致した根拠
- 不一致点
- 確認候補
- 次の手

ただし、これは session に十分な材料が記録されていることが前提であり、直ちに MCP 本体へ追加するのではなく、`jp-lit-verification` の運用実績を見てから判断する。

#### 既存データモデルとの整合

export 拡充は、できるだけ既存構造から導出する。

すでに使える情報:

- `SessionEntry.tool`
- `SessionEntry.input`
- `SessionEntry.selected_items`
- `SessionEntry.notes`
- `SessionEntry.result_ref`
- cache 内 `structured_content.items`

このため、**新しい永続保存層は不要**。

ただし `unselected` をより説明しやすくするために、将来的に session entry へ軽いメタデータを足す余地はある。
例:

- `entry_summary`
- `search_outcome`
- `reviewed`

ただしこれは export 実装で本当に不足が見えた場合に限る。

#### 実装順

1. `export profile` の設計
   - input schema の拡張
   - output schema の整合
2. `full_log` / `selected` / `unselected` を実装
3. Markdown / JSON の profile 別レンダリング
4. `selected` / `unselected` に限定して CSV を追加するか判断
5. README / usage guide に export 例を追記
6. `negative_searches` や `verification_table` のような派生ビューは次段階で検討

#### テスト方針

- `selected` で unselected が除かれること
- `unselected` で selected が除かれること
- `full_log` は現行互換を保つこと
- CSV 追加時は列順と escaping を固定すること
- verification 用 profile を入れる場合、判定理由が欠落しないこと

#### 成功条件

- 既存 MCP の検索出力を変えずに export だけ拡張できる
- ユーザーが「まとめだけ」「確認済みだけ」「候補だけ」を選べる
- 内部保存を原本として再利用し、保存体系を増やさない
- Skill の会話圧縮ロジックと混線しない

## 実装しないこと

- `Research Packet` の永続 schema 化
- `manifest.json` の即導入
- `SessionEntry` への会話圧縮専用フィールド追加
- サブエージェント専用 Skill 分岐

## 成功条件

- MCP 単体利用の自然さを壊さない
- Skill だけで「検索結果を会話に抱え続けない」運用が説明できる
- 各アプリで配布しやすいまま保つ
- 必要なら将来 subagent 運用へ拡張できるが、初期導入では必須化しない

## 次の一手

1. `jp-lit-research` と `jp-lit-verification` の Skill 文面へ運用原則を反映
2. README / usage guide へ責務分離を追記
3. export profile の小さい拡張を実装し、必要なら第2弾を切る
