# 過去セッション検索・再エクスポート設計

## 目的

過去の文献調査セッションについて、次のような問い合わせに答えられるようにする。

- 「前にこの主題を調べたことがあるか」
- 「過去セッションでこのキーワードに触れていたか」
- 「昔の調査結果をもう一度 export したい」

現状は `current session` の保存と export はできるが、過去セッションを検索・指定して扱う正式ツールがない。
そのため本設計では、まず **セッション単位で過去調査を探す** ことを第一段階とし、その次に **見つけたセッションを指定して export する** 流れを整える。

## スコープ

今回の対象は次の 2 点に限定する。

1. `jp_lit_find_sessions`
   - 主題・キーワード・候補タイトル・メモをもとに過去セッションを一覧検索する
2. `jp_lit_export_session(session_id=...)`
   - 現在セッションだけでなく、指定した過去セッションも export できるようにする

今回の対象外:

- 候補アイテム単位の横断検索
- セッション本文の全文閲覧専用ツール
- 削除・アーカイブ整理ツール
- ranking やベクトル検索のような高度な検索

## 背景と判断

### なぜセッション単位を先に作るか

過去調査を振り返る問いは、まず「前に調べたことがあるか」を知りたい場合が多い。
候補アイテム単位で直接返すと、同じセッションの候補が大量に並びやすく、文脈が切れて見えにくい。

そのため第一段階では、まず **セッション単位の一覧** を返す。

各結果には、

- いつの調査か
- 何を調べたか
- 何件候補を残したか
- どのフィールドがヒットしたか

を含める。

その後、必要に応じてそのセッションを export する。

### なぜ検索軸を query / title / notes に絞るか

現行の `SessionDocument` は次を安定して持っている。

- `entry.input`
- `selected_items`
- `notes`

このため、最小実装でも次の検索軸が取れる。

- `entry.input.query`
- `selected_items.title`
- `notes`

これはユーザーが「主題」や「キーワード」で振り返るユースケースに合っている。

## アプローチ比較

### 案 A: セッション一覧 → export の 2 段階

- まず `jp_lit_find_sessions`
- 次に `jp_lit_export_session(session_id=...)`

利点:

- 現在の保存構造と相性がよい
- ユーザーの問いに自然
- 実装が小さく、誤解が少ない

欠点:

- 中身を細かく見るには 2 手必要

### 案 B: 候補アイテムを直接返す

- 過去セッション横断で `selected_items` を直接検索

利点:

- ピンポイント候補にすぐ辿り着ける

欠点:

- 文脈が切れやすい
- 同一セッションの候補が大量に並びやすい
- 「何の調査で出た候補か」が見えにくい

### 採用

今回は **案 A** を採用する。

## データ源

内部保存の原本は既存のままとする。

- セッション:
  - `.cache/ndl-jp-lit-mcp/sessions/current.json`
  - `.cache/ndl-jp-lit-mcp/sessions/<session_id>.json`
- export:
  - `exports/`

新しい保存層は追加しない。

## 追加する MCP 機能

### 1. `jp_lit_find_sessions`

#### 役割

過去セッションを、主題・キーワード・候補タイトル・メモをもとに検索する。

#### 入力

- `query: string`
  - 必須
  - 主題・キーワード検索語
- `limit: number`
  - 任意
  - 既定 `10`
  - 上限 `50`

将来拡張候補:

- `include_current`
- `from_date`
- `to_date`

ただし初期版では入れない。

#### 検索対象

各 `SessionEntry` から次を対象とする。

- `entry.input.query`
- `selected_items.title`
- `notes`

#### マッチ判定

初期版はシンプルな部分一致ベースとする。

- 大文字小文字は正規化
- 全角半角や軽い空白差は正規化してよい
- 高度な形態素解析・曖昧検索は行わない

#### 出力

セッション単位で返す。

各 item に含める候補:

- `session_id`
- `created_at`
- `updated_at`
- `matched_fields`
  - `query`
  - `selected_title`
  - `notes`
- `query_preview`
  - 最初に見つかった `entry.input.query`
- `selected_count`
  - セッション全体の selected 件数
- `note_preview`
  - notes の先頭抜粋

#### 並び順

- `updated_at` 降順

まずは最新順で十分とする。

### 2. `jp_lit_export_session(session_id=...)`

#### 役割

現在セッションに加えて、指定した過去セッションも export できるようにする。

#### 入力追加

- `session_id?: string`

未指定:

- 現行どおり current session を export

指定あり:

- `.cache/ndl-jp-lit-mcp/sessions/<session_id>.json` を読む

#### 互換性

既存の呼び方はそのまま維持する。

- `session_id` を渡さなければ挙動は不変

## SessionStore の変更

現状の `SessionStore` は `readCurrent()` のみで、過去セッション単位の読み出しがない。

最小拡張として次を追加する。

- `readById(sessionId: string): Promise<SessionDocument>`
- `listAll(): Promise<SessionDocument[]>`

責務:

- `readById`
  - 既存 archive JSON の読み出し
- `listAll`
  - `sessions/` 以下の archive を列挙
  - `current.json` は重複回避のため整理して扱う

## 出力スキーマ案

### `jp_lit_find_sessions`

```ts
{
  query: string;
  limit: number;
  total: number;
  items: Array<{
    session_id: string;
    created_at: string;
    updated_at: string;
    matched_fields: Array<"query" | "selected_title" | "notes">;
    query_preview: string | null;
    selected_count: number;
    note_preview: string | null;
  }>;
}
```

### `jp_lit_export_session`

既存に `session_id` を追加するだけで、出力スキーマ自体は変えない。

## エラーハンドリング

### `jp_lit_find_sessions`

- ヒット 0 件
  - 正常系として `total=0`, `items=[]`
- 壊れた archive JSON
  - 読めない session はスキップ
  - 将来必要なら warning 集計を追加

### `jp_lit_export_session(session_id=...)`

- 該当 session が存在しない
  - 明示的エラー
- archive JSON が壊れている
  - 明示的エラー

## README / usage-guide への反映

公開ガイドには次を追記する。

- 過去セッションは内部に残る
- 「前にこういうのを調べたっけ？」に答える機能を持つ
- 自然言語例
  - `過去に女学生 制服で調べたセッションを探して`
  - `前に「常陸国風土記」で調べた結果を探して`
  - `そのセッションを Markdown で書き出して`

## テスト方針

### `SessionStore`

- `readById` が archive を読める
- `listAll` が current / archive を重複なく扱える

### `jp_lit_find_sessions`

- query ヒット
- selected title ヒット
- notes ヒット
- 0 件
- limit 適用

### `jp_lit_export_session`

- `session_id` 未指定で現行互換
- `session_id` 指定で過去 session export
- 存在しない `session_id` でエラー

## ロールアウト順

1. `SessionStore` 拡張
2. `jp_lit_find_sessions` の schema / tool / tests
3. `jp_lit_export_session(session_id=...)` 対応
4. README / usage-guide 更新

## 成功条件

- 主題・キーワードで過去セッションを探せる
- 見つけた過去セッションを指定して export できる
- 現在の保存構造を壊さない
- current session export の既存挙動を維持する
