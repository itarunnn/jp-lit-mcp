# 次世代デジタルライブラリー API メモ

確認日: 2026-04-27

## 公式仕様の入口

- API説明ページ
  - https://lab.ndl.go.jp/service/tsugidigi/apiinfo/
- サービス概要
  - https://lab.ndl.go.jp/service/tsugidigi/
- 構造化テキスト提供のお知らせ
  - https://lab.ndl.go.jp/news/2025/2025-08-26/

## API 群

- `Book API`
  - 資料検索: `/dl/api/book/search`
  - 資料メタデータ取得: `/dl/api/book/{pid}`
  - 全文テキスト一括取得(JSON): `/dl/api/book/fulltext-json/{pid}`
  - 全文テキスト一括取得(zip): `/dl/api/book/fulltext/{pid}`
  - 構造化テキスト一括取得(zip): `/dl/api/book/layouttext/{pid}`
- `Page API`
  - 資料内検索: `/dl/api/page/search`
  - ページ取得: `/dl/api/page/{pid}_{page}`
  - 構造化テキストページ単位: `/dl/api/page/layout/{pid}_{page}`
- `Illustration API`
  - 図版メタデータ取得: `/dl/api/illustration/{pid}_{page}_{index}`

## 取得できる情報

- 書誌データ
- OCR 全文テキスト
- 各文字列の紙面座標情報
- 図版領域の座標情報
- 図版検索用特徴ベクトル
- 2025-08-26 以降は構造化テキスト XML も提供

## PID の意味

- 仕様ページでは、`Book API` などの `{pid}` は「永続的識別子」の数値部分と説明されている。
- これは国立国会図書館デジタルコレクションの `info:ndljp/pid/...` や `https://dl.ndl.go.jp/pid/...` の数値部分と整合する想定。
- ただし、次世代デジタルライブラリーの収録対象は「インターネット公開」かつ主として「著作権保護期間満了」の図書・古典籍に限られる。

## 実地確認

### 直接取得できた PID

- `https://lab.ndl.go.jp/dl/api/book/897115`
  - `HTTP 200`
  - 返戻の `id` も `897115`
- `https://lab.ndl.go.jp/dl/api/page/897115_1`
  - `HTTP 200`
  - `coordjson` を含む

### 直接取得できなかった PID

- `https://lab.ndl.go.jp/dl/api/book/1000732`
  - `HTTP 500`
- `https://lab.ndl.go.jp/dl/api/book/1012769`
  - `HTTP 500`

上の `1000732` / `1012769` は、現行 repo の `ndl_digital` fixture / live record で使っている `ndljp/pid` だが、次世代 API では解決しなかった。

## 解釈

- `ndljp/pid` の数値部分は、次世代 API 側の PID として使える可能性が高い。
- ただし「使える PID は次世代デジタルライブラリー収録対象に限る」。
- そのため、`ndl_digital` の全 record が次世代 API へ接続できるわけではない。
- `HTTP 500` は「存在しない / 収録対象外」の区別に使いにくいので、クライアント向けには `not available` として扱う方が安全。

## タイトル検索 fallback について

- 次世代 API の `book/search?keyword=...` でタイトル検索はできる。
- ただし同名・別巻・別年度・別版が多く、`ndl_digital` record からタイトルベースで次世代 PID を逆引きすると誤結合の危険が高い。
- 例:
  - `国立国会図書館年報` で検索すると `3048012`, `3048009`, `3048007` など複数の別年度資料が返る。

結論として、v1 の接続戦略では `タイトル検索 fallback は採用しない` 方がよい。

## MCP 設計への含意

- `ndl_digital` record から次世代 API へ接続する v1 の主キーは `pid` のみとする。
- `pid` の候補は次の優先順位で解決する。
  1. `identifiers.ndljp` の数値部分
  2. `content_access.viewer_url` の `/pid/{n}` 部分
  3. `url` の `/books/...` からは解決しない
- PID で次世代 `Book API` が解決した場合のみ、本文系ツールを有効化する。
- PID が解決しない、または `Book API` が 200 を返さない場合は、`next_digital_library` 未対応として返す。
