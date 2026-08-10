# 速報Web発見証拠の設計

作成日: 2026-08-10

状態: 承認済み。既存のWeb補助確認を維持しつつ、速報性が高く消えやすい投稿を「典拠」ではなく「調査の発端」として記録する。

## 目的

Yahoo!リアルタイム検索などで見つけた刊行直後の論争、未発表資料への言及、イベント、研究者の反応を、既存の調査 `session_id` に由来付きで保存する。投稿は書誌的事実や学術的評価の確証にせず、出版社、雑誌、NDL、CiNiiなどで正式確認する次の調査行動へ接続する。

この変更は新しいWeb検索機能を追加するものではない。jp-lit Skillが従来から使っているWeb補助確認に、速報性と不安定性を明示する記録契約を加える。

## 採用方式

既存の `EvidenceRef` を後方互換のまま拡張する。独立した `web_discoveries[]`、新しいMCPツール、Yahoo専用adapterは作らない。

速報Web発見は、通常は `jp_lit_update_session_trace` の `open_questions[].evidence_refs` または `next_actions[].evidence_refs` に保存する。候補判断へ結び付ける場合も、Web投稿だけを根拠に `adopt` せず、`needs_followup` の根拠として扱う。

### 比較した方式

1. **既存 `EvidenceRef` を拡張する。** 調査の発端と正式確認の次アクションを同じtrace内で結び付けられ、既存sessionとの互換性も保てる。
2. **`SessionTrace.web_discoveries[]` を追加する。** 独立一覧にはしやすいが、既存のopen question / next action / decisionと責務が重複する。
3. **説明文だけで記録する。** 変更は小さいが、投稿者、時刻、検索語、安定性を検証・再利用できない。

方式1を採用する。

## EvidenceRef contract

既存の一般的な `EvidenceRef` は変更せず受理する。`evidence_type: "agent_web"` を指定する場合だけ、次の構造化項目を必須にする。

| field | value / meaning |
|---|---|
| `evidence_type` | 固定値 `agent_web` |
| `stability` | 固定値 `ephemeral` |
| `discovery_source` | 検索サービス名。例: `Yahoo!リアルタイム検索` |
| `query` | 実際に使った検索語 |
| `url` | 発見した投稿のURL |
| `author` | 画面上で確認した投稿者名またはアカウント表記 |
| `published_at` | 画面上で確認した投稿日時。ISO 8601 |
| `checked_at` | エージェントが投稿を確認した日時。ISO 8601 |
| `linked_urls` | 投稿から到達したリンク先URL。1件以上 |
| `quote_or_summary` | 既存field。発見理由の短い要約に限る |

`checked_at` は観察時刻であり、親のtrace要素にstoreが付ける `created_at` はsessionへ保存した時刻である。両者を混同しない。

速報Web用fieldの一部だけを一般 `EvidenceRef` に混在させない。完全な `agent_web` recordか、従来形式のrecordのどちらかとしてschema validationする。

## 調査フロー

1. 通常の文献DB調査を主経路として開始する。
2. 刊行直後の反応、論争、イベント、未発表資料への言及が探索に有効な場合だけ、既存Web補助確認の一経路として速報Web検索を使う。
3. 投稿を見つけたら、投稿URL、投稿日時、投稿者、検索語、確認日時、リンク先を `agent_web` evidenceとして同じ調査 `session_id` に保存する。
4. 投稿が示唆した資料や掲載情報を、出版社、雑誌、NDL、CiNiiなどの適切なsourceで確認する。
5. 最終回答では「速報Webでの発見」と「正式sourceで確認した事実」を分ける。正式確認できなかった情報は候補または未確認事項として残す。

例: Yahoo!リアルタイム検索で研究者の投稿を発見し、投稿から書評と雑誌掲載情報へ進んだ場合、投稿自体は調査経路の証拠、書評・雑誌・書誌DBは各主張の証拠として別々に記録する。

## Skillとrunbook

`skills/jp-lit-research/SKILL.md` には、速報Web検索をWeb補助確認の条件付き分岐として短く追加する。詳細は新しい `reference/04-ephemeral-web-discovery.md` に置く。

runbookには次を含める。

- 使う条件と使わない条件
- `agent_web` recordの保存例
- Web投稿を確証にしない評価境界
- 出版社、雑誌、NDL、CiNii等への裏取り順序
- 投稿消失、日時不明、リンク先不達時の記録方法
- 自動取得、継続監視、網羅クロールを行わない境界

Yahoo!の画面構造は不安定なため、恒久的なmachine endpointとして扱わない。新しいadapter、専用MCP tool、スクレイパーは追加しない。

## Export

Markdown exportの既存 `renderEvidenceRefs` に、`agent_web` metadataを人間可読に表示する処理を追加する。親の `Open Questions`、`Next Actions`、`Decisions` の階層は変えない。

JSON exportは拡張fieldをそのまま保持する。CSL JSONは文献管理用なので速報Web metadataを混ぜない。

## 互換性

- 既存session JSONと従来形式の `EvidenceRef` はmigrationなしで読み続ける。
- 新fieldは `agent_web` recordにだけ必要で、既存tool callには影響しない。
- `session_id` は調査履歴の明示handle、`cache_key` は保存済みtool resultの識別子、MCP transport stateは通信層として引き続き分離する。
- 速報Web recordはcache identityを持たず、既存のsession traceに保存する。

## エラー処理

- `agent_web` で必須fieldがない、固定値が異なる、日時やURLが不正: input schema error。
- 投稿日時を確認できない: 推測値を入れず、recordを保存せずに未確認事項として残す。
- リンク先がない、または確認できない: 完全な `agent_web` recordとして保存せず、通常のWeb補助確認メモまたはopen questionに留める。
- 投稿やリンク先が後から消えた: 保存済みの確認日時と短い要約は発見経路として残すが、消失した内容を事実確認済みに昇格しない。

## TDDと検証

実装前に次を失敗させる。

1. 完全な `agent_web` evidenceをschemaが受理し、session traceへ保存できる。
2. 必須field欠落、`stability`の誤値、不正な日時・URLを拒否する。
3. 従来形式の `EvidenceRef` が引き続き受理される。
4. Markdown exportに検索サービス、検索語、投稿者、投稿日時、確認日時、投稿URL、リンク先、`agent_web` / `ephemeral` が出る。
5. Skillが速報Webを既存Web補助確認として扱い、正式sourceでの裏取りを要求する。
6. runbookが新規adapter・専用MCP tool・自動取得を禁止範囲として示す。

対象testの後にfull test、build、script typecheck、offline MCP smoke、`git diff --check`を実行する。

## 対象外

- Yahoo!リアルタイム検索のadapterまたは専用MCP tool
- Yahoo!やSNSの恒久APIとしての利用
- 投稿本文の網羅収集、継続監視、スクレイピング
- 投稿内容だけによる書誌確定、真偽判定、学術的評価
- 投稿画像、削除済み投稿、ログインsessionの保存
- package version bump、push、npm publish、GitHub Release
