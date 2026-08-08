# 明示的調査セッションハンドル設計

作成日: 2026-08-08

状態: 承認済み。ユーザーの session / cache / transport ID の整理と、明示 `session_id` 化の実装依頼を正本とする。

## 目的

`jp_lit_start_session` が返す `session_id` を、複数回の tool call を一つの調査案件へ束ねる明示的な application state handle として使う。検索・取得・注釈・trace 更新・session export は対象 `session_id` を引数で受け取り、process-global な `current.json` を公開 API の書込先・読取元として暗黙利用しない。

この変更により、同じ server process を使う複数の調査案件が並行して進んでも、検索履歴・採用資料・注釈・判断理由が別セッションへ混入しないようにする。

## ID の責務

| ID | 責務 | 保存・転送 |
|---|---|---|
| 旧 MCP の `Mcp-Session-Id` | client と server の transport-level 接続 | jp-lit の調査状態には使わない |
| jp-lit の `session_id` | 一連の検索、採否、注釈、trace を束ねる調査案件 | `jp_lit_start_session` が発行し、後続の stateful tool 引数で渡す |
| jp-lit の `cache_key` | 個々の検索・取得結果の保存場所 | cache identity と session entry の参照に使う |

`session_id` は cache identity ではない。同一 tool・同一検索入力は、異なる調査セッションから呼ばれても同じ `cache_key` と保存済み結果を共有できる。

## 採用方式

### 比較した方式

1. **全 stateful call で `session_id` を必須化する。** 書込先と読取元が常に明示され、呼出し忘れは schema error になる。公開 API は破壊的に変わる。
2. **`session_id` を optional にし、未指定時は current へ fallback する。** 既存 client は壊れないが、暗黙 state が残り、並列安全性を利用者の注意に依存させる。
3. **transport 接続ごとに current を分ける。** application state を transport lifecycle に再結合し、新しい MCP の sessionless / explicit handle 方針と逆行する。

方式1を採用する。jp-lit は 0.x 系であり、今回の目的は互換 fallback の延命ではなく、調査案件を明示 handle で安全に分離することにある。

## 公開 tool contract

### セッション作成

`jp_lit_start_session` は引き続き `session_id`、作成時刻、初期 trace を返す。以後、agent / client はこの値を調査案件の終了まで保持する。

### cache を作り session entry を記録する tool

`runCachedTool` を使う全 tool と、それを複数回呼ぶ `jp_lit_get_records` は、入力に必須の `session_id` を追加する。

- `jp_lit_search`
- `jp_lit_get_record`
- `jp_lit_get_records`
- `jp_lit_enrich_record`
- `jp_lit_get_text_coordinates`
- `jp_lit_get_fulltext`
- `jp_lit_search_pages`
- `jp_lit_search_fulltext`
- `jp_lit_search_illustrations`
- `jp_lit_search_kokusho_fulltext`
- `jp_lit_search_kokusho_image_tags`
- `jp_lit_search_guides_manuals`
- `jp_lit_search_guides_cases`
- `jp_lit_resolve_authority`
- `jp_lit_find_authority_terms_by_classification`
- `jp_lit_suggest_classification_codes`
- `jp_lit_search_kaken_projects`

`force_refresh` と同様に `session_id` は upstream query と cache identity から除外する。ただし `force_refresh` と異なり、`SessionStore.appendEntry` の対象指定には必ず使う。

### session を更新・出力する tool

次の tool でも `session_id` を必須化する。

- `jp_lit_annotate_session`
- `jp_lit_update_session_trace`
- `jp_lit_export_session`

`jp_lit_refine_results` は `session_id`、`cache_key`、`cache_keys` のいずれかを必須とし、current の最新検索へ fallback しない。`include_enrichment=true` では、対象 `session_id` または明示的な `enrichment_cache_keys` も必要とする。`jp_lit_export_view(view="refined_results")` は同じ selector contract を引き継ぐ。

全 session を列挙・検索する `jp_lit_list_sessions` / `jp_lit_find_sessions`、全 cache を対象にできる inventory tool は、目的上 global query なので `session_id` を必須化しない。

## 永続化設計

`SessionStore` の mutation は対象 `session_id` を任意の内部引数として受け取れるようにする。公開 tool は常に明示 ID を渡すが、既存の store-level tests と内部互換のため、ID 省略時の current 操作は private compatibility path として残す。

明示 ID がある mutation は `<sessions>/<session_id>.json` を読み書きする。`current.json` は次の用途だけに残す。

- 旧ローカルデータとの互換
- `jp_lit_start_session` が最後に作成した session のエイリアス
- store-level の内部互換 API

非 current の session を更新しても `current.json` の指す ID は変えない。current と同じ ID を更新した場合だけ、archive と current の内容を同期する。

同一 `SessionStore` instance 内の mutation は既存の promise queue で直列化する。複数 process / 複数 replica 間の file lock や共有 DB は本設計の対象外である。

## データフロー

1. client が `jp_lit_start_session` を呼び、`session_id=A` を受け取る。
2. client が検索 tool に `session_id=A` と検索入力を渡す。
3. tool は `session_id` と `force_refresh` を cache input から分離する。
4. `runCachedTool` は検索入力だけから `cache_key` を計算し、cache hit / miss を処理する。
5. `runCachedTool` は session entry を `SessionStore.appendEntry(entry, A)` へ渡す。
6. 注釈、trace、export も `A` を明示して同じ調査案件を操作する。

同じ検索を `session_id=B` で行った場合、手順4の `cache_key` と検索結果本体は共有するが、手順5の entry は B にも独立して記録する。

## エラー処理

- `session_id` 未指定・形式不正: Zod の tool input validation error。
- 存在しない `session_id`: `SessionStore.readById` の not-found error を返し、新しい current session を自動作成しない。
- 注釈対象 entry が指定 session にない: 既存の `Session entry not found` を返す。
- refine selector がない、または複数 selector を同時指定: validation error。
- explicit mutation 失敗後: 既存 mutation queue は次の operation を継続する。

## 互換性と移行

公開 tool input は破壊的に変わる。既存 client / prompt / Skill / smoke fixture は、最初に `jp_lit_start_session` を呼び、返却 ID を後続 call へ渡すよう更新する。

保存済み session / cache の schema は変更しない。既存 `current.json`、archive session、cache envelope、`cache_key` は migration なしで読み続けられる。

## テスト戦略

TDD で次を先に失敗させる。

1. 非 current session を明示更新しても current が切り替わらない。
2. 同じ検索入力を異なる session で実行すると、cache は共有され、両 session に entry が残る。
3. 全 cached tool schema が `session_id` 未指定を拒否する。
4. annotate / trace / export が指定 session だけを操作する。
5. refine が current fallback を拒否する。
6. batch record lookup が各内部 lookup へ同じ `session_id` を渡す。
7. deterministic offline MCP smoke が start で得た ID を全 stateful call に引き回す。

対象 tests の後に `npm test`、`npm run build`、`npm run typecheck:scripts`、`npm run smoke:mcp:offline`、`git diff --check` を実行する。

## 対象外

- Streamable HTTP transport の導入
- 2026-07-28 MCP wire protocol 全体への SDK 移行
- authentication / authorization context と `session_id` の結合
- 複数 process / replica 間の共有 storage と分散 lock
- session TTL、destroy tool、garbage collection
- package version bump、npm publish、GitHub Release
