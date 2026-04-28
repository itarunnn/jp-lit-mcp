# IRDB Filters 拡張計画

**Goal:** `jp_lit_search(source=irdb)` に対して、IRDB 固有の検索条件を追加し、機関リポジトリ資料の探索精度を上げる。

**Scope:**

- `jp_lit_search` に `filters.irdb` を追加
- 初版では `fulltext`, `title`, `author` を対象にする
- `irdb` adapter が OpenSearch パラメータへ写像できるようにする
- schema / test / README / API notes 更新

**Out of Scope:**

- `journal` filter
- `publisher`, `issn`, `dissertationid`, `dissertationaffiliation` などの追加条件
- 既定横断検索への適用
- source ごとの高度 filter 共通化
- IRDB 以外の source への filter 拡張

## 方針

- 外向き API は `jp_lit_search` を維持する。
- source 固有 filter はトップレベルへ増やさず、`filters.irdb` に閉じ込める。
- 初版の公開引数は次の 3 つだけに絞る。
  - `filters.irdb.fulltext`
  - `filters.irdb.title`
  - `filters.irdb.author`
- `filters.irdb` は `source=irdb` のときだけ有効にする。
- 横断検索では `filters.irdb` を受け付けない。

## 想定する入力形

```json
{
  "query": "夏目漱石",
  "source": "irdb",
  "filters": {
    "irdb": {
      "fulltext": true,
      "title": "こころ",
      "author": "夏目漱石"
    }
  }
}
```

## OpenSearch 写像

- `filters.irdb.fulltext=true`
  - `fulltext=1`
- `filters.irdb.title`
  - `title=<value>`
- `filters.irdb.author`
  - `author=<value>`

補足:
- `query` 自体の `q` は維持する。
- `title` / `author` を入れても `query` を必須のまま維持するか、`filters` だけでも許可するかは Task 1 で確定する。
  - 初期案は `query` 必須維持

## Task 1: 入力仕様の確定

- [ ] `searchInputSchema` 拡張方針の確定
- [ ] `filters.irdb` の shape を確定
- [ ] `source=irdb` 以外での扱いを決める
  - 無視
  - validation error
- [ ] `query` 必須維持かどうかを決める

推奨:
- `source=irdb` 以外では validation error
- `query` は初版では必須維持

## Task 2: adapter 実装

- [ ] `SourceAdapter` / `SearchParams` への最小拡張
- [ ] `irdb` adapter で `filters.irdb` を OpenSearch へ写像
- [ ] `fulltext=1` / `title` / `author` の組み合わせをテスト

## Task 3: テスト

- [ ] `tests/jpLitSearch.test.ts`
  - schema で `filters.irdb` を受け付ける
  - `source=irdb` 以外では reject する
- [ ] `tests/irdb.adapter.test.ts`
  - `fulltext`
  - `title`
  - `author`
  の query string が正しく組まれる

## Task 4: 文書

- [ ] README に `filters.irdb` を追記
- [ ] `docs/api-notes/irdb.md` に OpenSearch 写像を追記
- [ ] `既定横断検索では使えない` ことを明記

## 想定リスク

- `jp_lit_search` の schema が source 固有条件で複雑になる
- 将来 source ごとの filter を増やすと `filters` オブジェクトが肥大化する
- `query` と `title` / `author` の役割がユーザーに分かりにくくなる可能性がある

## 完了条件

- [ ] `source=irdb` に対して `filters.irdb.fulltext/title/author` を指定できる
- [ ] OpenSearch へ正しく写像される
- [ ] 既定横断検索に影響しない
- [ ] テストとビルドが通る

## 次の改善候補

- `filters.irdb.journal`
- `filters.irdb.publisher`
- `filters.irdb.dissertationid`
- `filters.irdb.dissertationaffiliation`
- source ごとの `filters.*` を共通設計として整理
