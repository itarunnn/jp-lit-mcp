# 次世代デジタルライブラリー接続フェーズ計画

## 目的

`ndl_digital` の書誌レコードから、次世代デジタルライブラリー API の `Book API` / `Page API` / `fulltext` 系へ安全に接続できるようにする。

このフェーズでは、まず `接続キーの解決` と `本文系ツールの土台` を作る。曖昧検索による資料照合は行わない。

## 方針

- `ndl_digital` の全件を次世代 API に接続できる前提は置かない。
- 次世代 API への接続は `PID` ベースの厳密一致のみ採用する。
- `title` や `publisher` による曖昧検索 fallback は v1 では採用しない。
- 既存の `jp_lit_search` / `jp_lit_get_record` は壊さず、本文系は別ツールで追加する。

## 調査結果の前提

- 次世代 API の PID は、デジコレの `永続的識別子` の数値部分と対応する想定。
- ただし次世代 API の収録対象は、インターネット公開かつ主として著作権保護期間満了資料に限られる。
- 現行 `ndl_digital` fixture に含まれる `1000732` / `1012769` は、次世代 `Book API` では `HTTP 500` となり未解決だった。
- よって、`ndl_digital -> 次世代 API` は「一部の資料のみ接続可能」として設計する必要がある。

## スコープ

### このフェーズでやる

- `ndl_digital` record から次世代 PID を解決する resolver を追加
- `jp_lit_get_record` の返却に、次世代接続可否を示す補助情報を追加
- 本文系ツールの初版を追加
  - `jp_lit_get_text_coordinates`
  - `jp_lit_get_fulltext`
  - 必要なら `jp_lit_get_page`
- 次世代 API の `Book API` / `Page API` / `fulltext-json` を使う adapter を追加
- fixture / API note / README / smoke を追加

### このフェーズでやらない

- タイトルベースの曖昧照合
- `ndl_search` / `ndl_catalog` / `ndl_articles` からの直接接続
- 図版検索や特徴ベクトル API の利用
- ZIP ダウンロードの完全サポート
- 画像本体の大量取得

## 目標 API 形

### 1. record への補助情報追加

`jp_lit_get_record(source=ndl_digital, ...)` の返却に、`source_metadata.next_digital_library` を追加する。

想定:

```json
{
  "source_metadata": {
    "next_digital_library": {
      "pid": "897115",
      "available": true,
      "reason": null,
      "book_api_url": "https://lab.ndl.go.jp/dl/api/book/897115"
    }
  }
}
```

未接続時:

```json
{
  "source_metadata": {
    "next_digital_library": {
      "pid": "1000732",
      "available": false,
      "reason": "not_indexed_in_next_digital_library",
      "book_api_url": "https://lab.ndl.go.jp/dl/api/book/1000732"
    }
  }
}
```

### 2. 本文系ツール

#### `jp_lit_get_fulltext`

- 引数
  - `source`
  - `source_id`
- 返却
  - `pid`
  - `pages`
    - `page`
    - `contents`
    - `coordjson`

初版では `Book API fulltext-json` をそのまま正規化する。

#### `jp_lit_get_text_coordinates`

- 引数
  - `source`
  - `source_id`
  - `page`
- 返却
  - `pid`
  - `page`
  - `contents`
  - `coordjson`

初版では `Page API` を優先し、ページ単位で返す。

## 実装タスク

### Task 1: PID resolver 追加

- 追加:
  - `src/sources/nextDigitalLibrary/resolvePid.ts`
- 内容:
  - `identifiers.ndljp` から数値 PID を抽出
  - fallback で `viewer_url` の `/pid/{n}` を抽出
  - 取得できなければ `null`

### Task 2: 次世代 API adapter 追加

- 追加:
  - `src/sources/nextDigitalLibrary/adapter.ts`
  - `src/sources/nextDigitalLibrary/mapBook.ts`
  - `src/sources/nextDigitalLibrary/mapPage.ts`
- 内容:
  - `getBook(pid)`
  - `getPage(pid, page)`
  - `getFulltextJson(pid)`

### Task 3: availability 判定追加

- 変更:
  - `src/sources/ndlDigital/mapRecord.ts`
  - `src/lib/schemas.ts`
- 内容:
  - `source_metadata.next_digital_library` を追加
  - `Book API` を叩いて `available` を判定
  - 200 以外は `false`

### Task 4: 本文系ツール追加

- 追加:
  - `src/tools/jpLitGetFulltext.ts`
  - `src/tools/jpLitGetTextCoordinates.ts`
- 変更:
  - `src/server.ts`
- 内容:
  - MCP tool を公開
  - `source=ndl_digital` のみ初期対応

### Task 5: fixture / 文書 / smoke

- 追加:
  - `tests/nextDigitalLibrary.*`
  - fixture
  - README
  - smoke

## リスク

### 1. 次世代 API の収録対象外

- `ndljp/pid` が取れても `Book API` が失敗する資料がある。
- 対応:
  - `available=false` を返す
  - ツール呼び出し時は `InvalidRequestError` ではなく `not available` を返す

### 2. タイトル fallback の誤結合

- 同名資料が多く、巻・年度差分で誤る。
- 対応:
  - v1 では採用しない

### 3. payload の大きさ

- `fulltext-json` は資料全体を返すため重い。
- 対応:
  - ページ単位ツールを別に持つ
  - 将来 `page_from` / `page_to` を追加検討

### 4. API の実験的性質

- 構造や availability が変わる可能性がある。
- 対応:
  - `raw` を残す
  - `source_metadata` に `api_version_note` を残せるようにする

## 完了条件

- `ndl_digital` record から PID を安定抽出できる
- 次世代 API 収録対象なら `available=true` を返せる
- `jp_lit_get_text_coordinates` がページ単位で座標付き OCR を返せる
- `jp_lit_get_fulltext` が資料全体の OCR JSON を返せる
- fixture / build / tests / smoke が通る
