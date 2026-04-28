# ndl_digital → 次世代デジタルライブラリー bridge v1 計画

## 目的

`ndl_digital` の書誌レコードを入口にして、公開範囲で利用可能な `次世代デジタルライブラリー API` の OCR / 座標 / ページ情報へ接続する。

このフェーズでは、`デジコレ画像だけ` を独立実装するのではなく、`ndl_digital -> PID 解決 -> 次世代 API` の橋渡しを優先する。

## 判断の前提

- 登録利用者向け本文画像は、ブラウザ調査の結果 `token 付き /contents/...jpg` と Cookie / session に依存していた。
- したがって、`登録利用者向け画像` を stateless な MCP API として扱うのは v1 では不適切。
- 一方で、公開範囲の資料については `次世代デジタルライブラリー API` から OCR / 座標 / ページ情報が得られる。
- そのため、`パブリックしか扱えないなら次世代を先にやる方が価値が高い`。

## ゴール

1. `ndl_digital` record から次世代 PID を解決できる
2. 次世代 API 収録対象かどうかを `jp_lit_get_record` の返却で分かる
3. 公開範囲の資料について
   - ページ単位の OCR / 座標
   - 資料単位の OCR JSON
   を MCP ツールで取得できる

## スコープ

### やること

- `ndl_digital` 用の PID resolver
- 次世代 `Book API` / `Page API` / `fulltext-json` adapter
- `jp_lit_get_record` への bridge 情報追加
- 新規ツール
  - `jp_lit_get_text_coordinates`
  - `jp_lit_get_fulltext`

### やらないこと

- 登録利用者向け本文画像の取得
- Cookie / session を使う画像取得
- タイトル検索による次世代 PID の曖昧照合
- `ndl_search` / `ndl_catalog` / `ndl_articles` からの直接 bridge
- 図版 API や ZIP 一括取得

## 接続戦略

### 1. 主キー

`ndl_digital` record から次の順で PID 候補を解決する。

1. `identifiers.ndljp`
   - `info:ndljp/pid/{n}` の数値部分
2. `content_access.viewer_url`
   - `https://dl.ndl.go.jp/pid/{n}` の数値部分
3. `url`
   - ここからは解決しない

### 2. availability 判定

- `Book API /dl/api/book/{pid}` が `200` を返したら `available=true`
- それ以外は `available=false`
- `500` も `not_indexed_in_next_digital_library` として扱う

### 3. fallback

- `title` / `publisher` / `year` による曖昧検索 fallback は採用しない
- 理由:
  - 同名別巻・別年度が多い
  - 誤結合リスクが高い

## 追加する返却情報

`jp_lit_get_record(source=ndl_digital, ...)` の `source_metadata` に追加:

```json
{
  "next_digital_library": {
    "pid": "897115",
    "available": true,
    "reason": null,
    "book_api_url": "https://lab.ndl.go.jp/dl/api/book/897115"
  }
}
```

未接続時:

```json
{
  "next_digital_library": {
    "pid": "1000732",
    "available": false,
    "reason": "not_indexed_in_next_digital_library",
    "book_api_url": "https://lab.ndl.go.jp/dl/api/book/1000732"
  }
}
```

## 追加するツール

### `jp_lit_get_text_coordinates`

- 用途
  - ページ単位で OCR と座標を取る
- 入力
  - `source`
  - `source_id`
  - `page`
- 出力
  - `pid`
  - `page`
  - `contents`
  - `coordjson`
  - `raw`

### `jp_lit_get_fulltext`

- 用途
  - 資料単位の OCR JSON を取る
- 入力
  - `source`
  - `source_id`
- 出力
  - `pid`
  - `pages`
  - `raw`

## 実装タスク

### Task 1: PID resolver

- 追加
  - `src/sources/nextDigitalLibrary/resolvePid.ts`
- 内容
  - `ndljp` と `viewer_url` から PID を抽出
  - utility test を追加

### Task 2: 次世代 adapter

- 追加
  - `src/sources/nextDigitalLibrary/adapter.ts`
  - `src/sources/nextDigitalLibrary/mapBook.ts`
  - `src/sources/nextDigitalLibrary/mapPage.ts`
- 内容
  - `getBook(pid)`
  - `getPage(pid, page)`
  - `getFulltextJson(pid)`

### Task 3: ndl_digital record bridge

- 変更
  - `src/sources/ndlDigital/mapRecord.ts`
  - `src/lib/schemas.ts`
  - 必要なら `src/lib/types.ts`
- 内容
  - `source_metadata.next_digital_library` を追加
  - availability を `Book API` 結果で埋める

### Task 4: MCP ツール追加

- 追加
  - `src/tools/jpLitGetTextCoordinates.ts`
  - `src/tools/jpLitGetFulltext.ts`
- 変更
  - `src/server.ts`
- 内容
  - `source=ndl_digital` のみ初期対応

### Task 5: fixture / docs / smoke

- 追加
  - fixture
  - test
  - README
  - smoke

## リスク

### 1. 次世代 API 収録対象外

- PID が解決しても `Book API` が失敗する
- 対応:
  - `available=false`
  - `reason` を返す

### 2. payload が重い

- `fulltext-json` は大きい
- 対応:
  - `page` 単位ツールを別に持つ
  - 全文は必要時のみ呼ぶ

### 3. 将来の登録利用者向け画像対応との混同

- 本フェーズは `公開範囲` に限定
- 対応:
  - README と schema に明記

## 完了条件

- `ndl_digital` record に `next_digital_library` 情報が出る
- `jp_lit_get_text_coordinates` が公開範囲の資料で動く
- `jp_lit_get_fulltext` が公開範囲の資料で動く
- tests / build / smoke が通る
