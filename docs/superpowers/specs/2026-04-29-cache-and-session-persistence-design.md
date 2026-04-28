# キャッシュとセッション保存の設計

## 概要

この設計は、`ndl-jp-lit-mcp` にローカル永続キャッシュと調査セッション保存を追加するためのものです。

目的は 2 つです。

- 同じ検索・書誌取得・OCR 系呼び出しを何度も繰り返したときに、毎回 upstream を再取得しなくてよい状態を作る
- 会話ログとは別に、再利用しやすい構造化された調査結果をローカルに残す

この機能は公開サーバ用途ではなく、配布された MCP サーバを各ユーザーがローカル実行する前提で設計する。
そのため保存先はホーム配下ではなく、repo 内の隠し領域と明示エクスポート領域を使う。

## ゴール

- 既存ツールの実行結果を repo 内に永続保存できるようにする
- 保存対象は upstream の生レスポンスではなく、パース済み・検証済みのツール出力にする
- 通常利用では内部保存を自動で行い、ユーザーが求めたときだけ人間向けエクスポートを出せるようにする
- 調査セッションには、検索条件・取得結果・候補ラベル・短いメモを保持する
- 既存の `jp_lit_search` / `jp_lit_get_record` / Next Digital Library 系ツールの外部挙動を壊さない

## 非ゴール

- upstream の XML / HTML / JSON 生レスポンスを丸ごと保存すること
- ユーザーアカウント単位の同期や共有
- 複数セッションを横断しての自動統合や重複解消
- セッション一覧 UI やブラウザ UI の追加
- 会話本文そのものを丸ごと永続保存すること

## 採用アプローチ

今回採用するのは「内部 JSON + 明示エクスポート Markdown」の二層構成です。

- 内部保存
  - `.cache/ndl-jp-lit-mcp/` 配下
  - 機械再利用を優先した JSON
- 明示エクスポート
  - `exports/` 配下
  - 既定は Markdown
  - 必要なら JSON も併記可能

この方式を採る理由は、内部再利用と人間向けの可読性を分離できるからです。
内部を Markdown にすると再開や差分更新が不利になり、外部を JSON のみ にすると利用者が読み返しづらい。

## 対象ツール

永続キャッシュとセッション記録の対象は次のツールです。

- `jp_lit_search`
- `jp_lit_get_record`
- `jp_lit_get_text_coordinates`
- `jp_lit_get_fulltext`
- `jp_lit_search_pages`
- `jp_lit_search_fulltext`
- `jp_lit_search_illustrations`

v1 では、すべての対象ツールについて「パース済み・検証済みの `structuredContent`」をキャッシュ単位とする。
ここでいうキャッシュは upstream HTTP 応答そのものではなく、各ツールが最終的に返す構造化出力を保存するものとする。

## 外部挙動

### 既存ツール

既存ツールの入力・出力スキーマは変更しない。
キャッシュヒット時も、呼び出し元から見えるツール名とレスポンス形状は同一とする。

### 新規ツール

v1 ではセッション注釈用と明示エクスポート用に 2 つの新しいツールを追加する。

#### `jp_lit_annotate_session`

役割:

- 現在セッション内の候補へラベルと短いメモを保存する

入力:

- `tool`: 対象結果を生んだツール名
- `cache_key`: 対象結果のキャッシュキー
- `selected_items`: 配列
  - `source`
  - `source_id`
  - `title`
  - `label`
  - `note`
- `notes`: 任意の文字列配列

出力:

- `session_id`
- `updated_at`
- `annotated_count`

このツールは session JSON の注釈層だけを書き換える。
検索結果や書誌結果そのものを再取得したり書き換えたりしない。

#### `jp_lit_export_session`

役割:

- 現在の調査セッションを人間向けに書き出す

入力:

- `format`: `markdown` または `json`。既定は `markdown`
- `output_path`: 任意。未指定時は repo 内 `exports/` 配下へ自動命名で保存
- `include_unselected`: 任意 boolean。既定は `true`

出力:

- `session_id`
- `format`
- `path`
- `exported_at`
- `item_count`

`jp_lit_annotate_session` と `jp_lit_export_session` はどちらも「現在セッション」を対象にする。
セッションの列挙、検索、削除、マージは v1 の対象外とする。

## 保存先

### 内部保存

repo 内の隠しディレクトリを使う。

```text
.cache/ndl-jp-lit-mcp/
  cache/
    v1/
      <tool-name>/
        <cache-key>.json
  sessions/
    current.json
    <session-id>.json
```

### 明示エクスポート

```text
exports/
  <session-id>.md
  <session-id>.json
```

`.gitignore` には少なくとも次を追加する。

- `.cache/ndl-jp-lit-mcp/`
- `exports/`

## キャッシュ設計

### キャッシュキー

キャッシュキーは次の要素から決定する。

- ツール名
- 正規化済み入力引数
- キャッシュスキーマ版

正規化済み入力は「既定値適用後・検証後・キー順安定化後」の JSON とする。
これにより、同じ意味の入力から常に同じキーが得られる。

### キャッシュ単位

保存する値は upstream の transport payload ではなく、ツール出力の `structuredContent` とする。

例:

- `jp_lit_search`: `SearchOutput`
- `jp_lit_get_record`: `RecordOutput`
- `jp_lit_get_fulltext`: `FulltextOutput`

この方針により、再利用時に source ごとの XML / HTML / JSON 差を再び意識せずに済む。

### キャッシュ有効期間

v1 では TTL を導入しない。
代わりに次の 2 つで整合性を取る。

- キャッシュディレクトリに `v1` の版を持たせる
- 互換性を壊す変更時は版を上げて古いキャッシュを自然に無効化する

理由:

- 文献書誌データは高頻度更新が主用途ではない
- TTL 追加は invalidation 方針まで含めると設計コストが上がる
- まずは再利用性と単純さを優先する

## セッション保存設計

### 基本方針

セッション保存は「現在の調査の構造化ログ」であり、会話ログの代替ではない。
保存対象は、検索条件、取得結果、候補への短い評価、必要に応じた補足メモとする。

### 保存内容

セッション JSON は少なくとも次を持つ。

- `session_id`
- `created_at`
- `updated_at`
- `entries`

`entries` は時系列配列で、各要素は次を持つ。

- `tool`
- `input`
- `cache_key`
- `result_ref`
- `selected_items`
- `notes`

ここでの意味は次のとおり。

- `input`
  - ツールへ渡した正規化済み入力
- `cache_key`
  - 対応するキャッシュファイルへの参照キー
- `result_ref`
  - 必要ならツール結果全体を再取得するための参照
- `selected_items`
  - `SearchItem` / `RecordItem` ベースで保持する候補と評価
  - 初回ツール実行時は空でもよく、`jp_lit_annotate_session` で追記する
- `notes`
  - 1 行程度の短いメモ

### 候補評価

候補ラベルは v1 では自由文字列ではなく、次の限定集合にする。

- `confirmed`
- `strong_candidate`
- `weak_candidate`

表示上は日本語へ整形してもよいが、内部保存値は安定した英字列にする。
理由は、後から programmatic に再利用しやすくするためである。

### 重い結果の扱い

`jp_lit_get_fulltext` や `jp_lit_get_text_coordinates` のような重い結果は、セッション JSON に全文を重複保存しない。
セッション側では `cache_key` と短いメモを持ち、本体はキャッシュファイルを参照する。

これにより、同じ payload をセッションとキャッシュへ二重保存しない。

## データモデル

### キャッシュファイル

```json
{
  "version": 1,
  "tool": "jp_lit_search",
  "cache_key": "sha256-...",
  "saved_at": "2026-04-29T13:00:00+09:00",
  "input": {
    "query": "婦人参政権",
    "page": 1,
    "limit": 48
  },
  "structured_content": {
    "query": "婦人参政権",
    "source": null,
    "page": 1,
    "limit": 48,
    "total": 123,
    "items": []
  }
}
```

### セッションファイル

```json
{
  "session_id": "2026-04-29-001",
  "created_at": "2026-04-29T13:00:00+09:00",
  "updated_at": "2026-04-29T13:20:00+09:00",
  "entries": [
    {
      "tool": "jp_lit_search",
      "input": {
        "query": "婦人参政権",
        "page": 1,
        "limit": 48
      },
      "cache_key": "sha256-...",
      "result_ref": {
        "tool": "jp_lit_search",
        "cache_key": "sha256-..."
      },
      "selected_items": [
        {
          "source": "ndl_catalog",
          "source_id": "123456",
          "title": "婦人参政権論",
          "label": "strong_candidate",
          "note": "テーマ適合。最初に確認する。"
        }
      ],
      "notes": [
        "未選別の全件は export 時に include_unselected=true で出力可能"
      ]
    }
  ]
}
```

## 実行フロー

### 既存ツール呼び出し

1. ツール入力を Zod で検証する
2. 検証後入力からキャッシュキーを計算する
3. キャッシュヒットなら保存済み `structuredContent` を返す
4. キャッシュミスなら既存の service / adapter 経由で live fetch する
5. 結果を `structuredContent` として保存する
6. セッション `entries` を更新する
7. MCP レスポンスを返す

### セッション注釈

1. `jp_lit_annotate_session` で `tool` と `cache_key` を受け取る
2. 対応する session entry を探す
3. `selected_items` と `notes` を追記または置換する
4. `updated_at` を更新して保存する
5. 更新件数を返す

### セッションエクスポート

1. 現在セッションを読み込む
2. 参照しているキャッシュ結果を必要に応じて解決する
3. `selected_items` と未選別候補を整形する
4. Markdown または JSON を `exports/` へ書き出す
5. 保存先パスをレスポンスで返す

## コンポーネント分割

実装は次の責務に分ける。

### 1. キャッシュ基盤

責務:

- キー生成
- JSON 読み書き
- ディレクトリ初期化
- 原子的保存

候補ファイル:

- `src/lib/persistence/cacheKeys.ts`
- `src/lib/persistence/fileCache.ts`

### 2. セッション基盤

責務:

- current session の読み書き
- entry 追加
- ラベル付き候補の保存
- export 対象データの組み立て

候補ファイル:

- `src/lib/persistence/sessionStore.ts`
- `src/lib/persistence/sessionTypes.ts`

### 3. エクスポータ

責務:

- Markdown レンダリング
- JSON export 生成
- 出力ファイル命名

候補ファイル:

- `src/lib/persistence/exportSession.ts`

### 4. セッション注釈

責務:

- session entry の特定
- ラベルとメモの追記
- 重複更新時の上書き規則

候補ファイル:

- `src/lib/persistence/annotateSession.ts`

### 5. ツール統合

責務:

- 各ツールの前後で cache/session を呼ぶ
- 既存の `structuredContent` 生成と整合を取る

候補ファイル:

- `src/tools/jpLitSearch.ts`
- `src/tools/jpLitGetRecord.ts`
- `src/tools/jpLitGetTextCoordinates.ts`
- `src/tools/jpLitGetFulltext.ts`
- `src/tools/jpLitSearchPages.ts`
- `src/tools/jpLitSearchFulltext.ts`
- `src/tools/jpLitSearchIllustrations.ts`
- `src/tools/jpLitAnnotateSession.ts`
- `src/tools/jpLitExportSession.ts`
- `src/server.ts`

## エラーハンドリング

- キャッシュファイルが存在しない
  - 通常のキャッシュミスとして live fetch へフォールバックする
- キャッシュファイルが壊れている
  - 読み取り失敗を握りつぶさず miss 扱いにして再保存する
- セッションファイルが壊れている
  - current session を新規作成し、壊れたファイルは `.invalid` へ退避する
- export 先ディレクトリを作れない
  - 明示的なツールエラーを返す
- ディスク書き込み失敗
  - 元のツール成功を偽装しない。保存失敗はツールエラーとする

最後の方針を採る理由は、ユーザーが「保存された」と誤認するのを避けるためである。

## テスト方針

### 単体テスト

- キャッシュキーが入力順序に依存しないこと
- キャッシュ保存と再読込が round-trip すること
- セッション entry 追加で期待どおりに `updated_at` が更新されること
- Markdown export が候補ラベルとメモを正しく整形すること
- 注釈ツールが既存 entry に対して `selected_items` を正しく更新すること

### 統合テスト

- `jp_lit_search` の 2 回目呼び出しで adapter 呼び出しがスキップされること
- `jp_lit_get_record` 実行後に session file が生成されること
- `jp_lit_annotate_session` でラベルとメモが session に保存されること
- `jp_lit_get_fulltext` 実行後に session は参照のみ持ち、本体重複保存をしないこと
- `jp_lit_export_session` が `exports/` にファイルを作り、パスを返すこと

### 既存回帰

- `npm test`
- `npm run build`
- 必要に応じて `npm run smoke:mcp`

## セキュリティと運用

- 保存先は repo 内固定を既定とし、ホーム配下へは広げない
- upstream の絶対 URL や transport body を別形式で再保存しない
- `raw` の扱いは現行ツール出力の範囲に限定し、新しい保存層で追加の生 payload を作らない
- export はユーザー明示時のみ行う

この設計は「配布されたローカル MCP サーバ」の運用に合わせている。
公開サーバの共有ストレージやマルチユーザー隔離は前提にしない。

## 実装順序

1. 永続化の型とファイルストアを作る
2. `jp_lit_search` / `jp_lit_get_record` に統合する
3. `jp_lit_annotate_session` を追加する
4. Next Digital Library 系ツールへ広げる
5. `jp_lit_export_session` を追加する
6. テスト・`.gitignore`・README を更新する

## 受け入れ条件

- 既存ツールを 2 回実行したとき、2 回目はローカルキャッシュを再利用できる
- `.cache/ndl-jp-lit-mcp/` にキャッシュと session JSON が生成される
- セッションには候補ラベルと短いメモを保持できる
- `jp_lit_annotate_session` で候補評価を後付け保存できる
- `jp_lit_export_session` で `exports/` に Markdown を生成できる
- 明示エクスポートなしでは、ユーザー向けに保存物を露出しない
