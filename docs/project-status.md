# 実装状況

2026-05-05 時点の状態:

- 公開ツール 20 種・対応 source 14 種・テスト 391 件すべて通過
- `npm test` / `npm run build` / `npm run smoke:mcp` は通過済み
- live smoke matrix は `jdcat` の上流メンテ時を除き通過実績あり
- GitHub リポジトリ公開済み: `https://github.com/itarunnn/jp-lit-mcp`
- `npx -y jp-lit-mcp` による MCP 起動導線を整備済み
- `npx -y jp-lit-mcp install-skills <app>` による Skills インストール導線を整備済み
- `npx -y jp-lit-mcp doctor` による軽量診断を整備済み
- README / install docs / usage guide / source-usage-conditions を整備済み
- ライセンスは `MIT`

## 実装済み

- 書誌検索・所蔵確認・デジコレ OCR / 全文 / 図版検索は実装済み
- レファレンス協同データベース（CRD）は `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases` として実装済み
- ローカルキャッシュ、調査セッション保存（`jp_lit_annotate_session`）、Markdown / JSON / CSL JSON エクスポート（`jp_lit_export_session`）に対応済み
- 過去セッション検索（`jp_lit_find_sessions`）と `session_id` 指定 export に対応済み
- 保存済み検索結果の一覧・検索・再整理・view export・削除・古い cache の pruning（`jp_lit_list_cache` / `jp_lit_search_cache_index` / `jp_lit_refine_results` / `jp_lit_export_view` / `jp_lit_delete_cache` / `jp_lit_prune_cache`）に対応済み
- Web NDL Authorities から典拠候補・別名義・分類由来の件名標目候補・安全な検索ヒントを返す補助 tools（`jp_lit_resolve_authority` / `jp_lit_find_authority_terms_by_classification`）を追加済み
- Skill の調査行動に関する feedback を受け取るための issue templates と feedback guide を整備済み

## 最近の更新

- 保存済み検索結果の refined export で、重複候補クラスタと `search_result_readiness` を確認できる導線を追加
- `jp_lit_resolve_authority` / `jp_lit_find_authority_terms_by_classification`: Web NDL Authorities から典拠候補・別名義・分類由来の件名標目候補・安全な検索ヒントを返す補助 tools を追加
- `0.1.3`: `doctor` コマンドを追加。Node.js、package version、同梱 Skills、cache / exports 書き込み、`CINII_RESEARCH_APP_ID` の有無を live API なしで診断
- `jp_lit_prune_cache`: 古いローカル cache を dry-run で確認してから削除できる MCP tool を追加
- `0.1.2`: `--help` / `--version` を追加
- `0.1.1`: Windows で `npx -y jp-lit-mcp install-skills <app>` が使える導線を修正
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
- npm package の `bin` / `files` / `prepack` を整備し、通常利用では clone/build せず `npx` から使える導線に変更

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

## 公開後メモ

- npm package 公開済み。公開前は `npm publish --dry-run` と tarball smoke を確認する
- GitHub About / topics / release note は整備済み
- 次の改善候補は Web NDL Authorities、検索品質 eval
