# 実装状況

2026-05-02 時点の状態:

- 公開ツール 17 種・対応 source 14 種・テスト 360 件すべて通過
- `npm test` / `npm run build` / `npm run smoke:mcp` は通過済み
- live smoke matrix は `jdcat` の上流メンテ時を除き通過実績あり
- README / install docs / usage guide / source-usage-conditions を整備済み
- ライセンスは `MIT`

## 実装済み

- 書誌検索・所蔵確認・デジコレ OCR / 全文 / 図版検索は実装済み
- レファレンス協同データベース（CRD）は `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases` として実装済み
- ローカルキャッシュ、調査セッション保存（`jp_lit_annotate_session`）、Markdown / JSON エクスポート（`jp_lit_export_session`）に対応済み
- 過去セッション検索（`jp_lit_find_sessions`）と `session_id` 指定 export に対応済み
- 保存済み検索結果の一覧・検索・再整理・view export・削除（`jp_lit_list_cache` / `jp_lit_search_cache_index` / `jp_lit_refine_results` / `jp_lit_export_view` / `jp_lit_delete_cache`）に対応済み

## 最近の更新

- `irdb`: HTML の `&#039;` エンティティが `'` に正しくデコードされない問題を修正（`alternative_titles` 等）
- 各 source の資料詳細 URL を拡充済み
  - `jp_lit_search_fulltext` / `jp_lit_search_illustrations` に `viewer_url` を追加
  - `japan_search` / `nihu_bridge` に fallback URL を追加
- 全 source の search 結果で `issued_at`（発行年）を取得できるよう修正済み
  - `japan_search`: `common.datePublished` を使用
  - `nihu_bridge`: `dateCreated[刊行年月]` を優先、登録日（`datePublished`）は除外
  - `jdcat`: JDCat 登録日ではなく調査対象年（Time P フィールド）を使用
- `filters.jdcat` を追加（`source=jdcat` のときのみ有効）
  - `subject` / `geographic` / `contributor` / `title`: Elasticsearch フィールド指定で `q` に AND 結合
  - `temporal` / `creator`: JDCat 独立パラメータとして渡す
- Codex の Skills 配置を公式導線に合わせ、`~/.agents/skills/` へ変更
- Cursor の Skills は repo 内 mirror ではなく、`~/.cursor/skills/` へインストールする導線に整理

## 同梱 Skills

### jp-lit-research

- Claude Code / Codex / Cursor 対応
- 起動語「文献DBで」「文献DBを始めます」で発火。一度発火したらセッション中継続
- 全モードで調査計画を提示してユーザーの確認を取ってから実行する（plan-first）
- 調査前情報収集（CRD・NDL リサーチ・ナビ）は intent に応じて計画生成前に実行し、結果を計画に反映する
- source の選択は語尾ベースの深度判定ではなく、計画確認の対話を通じてユーザーと決める設計
- 検索 MCP（`jp_lit_search` / `jp_lit_get_record` 等）はユーザー確認後のみ実行
- 全報告テンプレートに source（DB名）を付記
- `jp_lit_search` の description にユーザーの自然言語表現→source の読み替えを追記

### jp-lit-verification

- 起動語「文献検証で」「資料検証で」「実在するか確認して」「存在確認して」等で発火
- 他サービスや他セッションの貼り付け文章を対象に、日本語文献・資料の実在性・存在を検証できる
- `ndl_search` を第一関門にして `実在確認済み` / `部分一致` / `非実在の疑い` / `混線の疑い` を表で返す
- 各候補について、判定理由・一致根拠・不一致点を文章で説明する

## 公開前メモ

- GitHub リポジトリ作成・リモート登録・push（ローカルのみ）
- ブランチ名 `master` → `main` への改名
- 公開文面（README・install docs）の最終確認
