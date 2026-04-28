# JDCat Source 実装計画

**Goal:** `jp_lit_search` / `jp_lit_get_record` に `source: "jdcat"` を追加し、人文学・社会科学系の研究データメタデータを探索できるようにする。

**Scope:**

- `jdcat` source の追加
- search adapter
- record/detail adapter
- 共通スキーマへの正規化
- fixture / adapter test / API notes / README 更新

**Out of Scope:**

- 既定横断検索への投入
- データ本体ダウンロード
- JSON export endpoint の解読
- `jp_research_data_search` のような別ツール化
- 研究データ専用 filter の実装

## 方針

- 初版は `source=jdcat` 指定専用で始める。
- `jp_lit_search` / `jp_lit_get_record` の外形は維持する。
- 研究データは論文・図書と性質が違うため、既定横断検索には入れない。
- 検索入口は公開検索ページまたは stable な公開 endpoint を調査して決める。
- `get_record` は初版では HTML 詳細画面を主経路とする。
- `source_metadata.source_uri` に配布元 URI を保持する。

## Task 0: 入口の確定

- [x] 公開検索の stable endpoint / query parameter を確認
- [x] 詳細画面 HTML から安定取得できる項目を確認
- [x] JSON export が使えるか再確認
- [x] `url` と `source_metadata.source_uri` の役割を確定

Task 0 の現時点メモ:

- 検索フォームは `/search` だが、実体は公開 JSON API `/api/records/`
- 詳細も公開 JSON API `/api/records/{id}` が使える
- export 系 JSON は `401 Unauthorized`
- したがって初版は HTML ではなく公開 JSON API 依存で進める

## Task 1: fixture とマッピング表

- [x] `tests/fixtures/jdcat/` を追加
- [x] search fixture を採取
- [x] detail fixture を採取
- [x] `SearchItem` / `RecordItem` のマッピング表を作る

候補フィールド:

- `title`
- `authors`
- `summary`
- `subjects`
- `material_type`
- `language`
- `issued_at`
- `source_metadata.distributor`
- `source_metadata.distributor_uri`
- `source_metadata.source_uri`
- `source_metadata.access_right`
- `source_metadata.rights`
- `source_metadata.data_type`
- `source_metadata.temporal_coverage`
- `source_metadata.spatial_coverage`

## Task 2: adapter 実装

- `src/sources/jdcat/adapter.ts`
- `src/sources/jdcat/mapSearch.ts`
- `src/sources/jdcat/mapRecord.ts`
- `tests/jdcat.adapter.test.ts`

RED:

- [x] 検索結果を共通 `SearchItem` に正規化できる
- [x] 詳細画面を共通 `RecordItem` に正規化できる
- [x] `source_metadata` に研究データ系の文脈を残せる

## Task 3: MCP 公開面

- [x] `sourceSchema` に `jdcat` を追加
- [x] `jp_lit_search` / `jp_lit_get_record` に統合
- [x] 既定横断検索には加えない

## Task 4: 文書化と検証

- [x] `docs/api-notes/jdcat.md` を更新
- [x] README の source 一覧更新
- [x] `npm test`
- [x] `npm run build`
- [x] 可能なら live smoke を `source=jdcat` 指定で追加

## 想定リスク

- export 系 JSON に直接アクセスできないが、公開 `/api/records/` と `/api/records/{id}` は利用可能
- 研究データは `title` / `author` / `published` の揺れが大きい
- `availability.online` が「メタデータ公開」なのか「データ本体公開」なのかを区別する必要がある

## 完了条件

- [x] `source: "jdcat"` で検索できる
- [x] `source: "jdcat"` で detail 取得できる
- [x] 返却が共通スキーマに乗る
- [x] 既定横断検索に影響しない
- [x] テストとビルドが通る

## 次の改善候補

- 研究データ専用の別ツール化 (`jp_research_data_search`)
- `access_right` / `data_type` / `temporal_coverage` などの filter
- JSON export や OAI-PMH の正式活用
- `nihu_bridge` と合わせた人文学データ探索レイヤーの整理
