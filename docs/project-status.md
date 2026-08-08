# 実装状況

2026-08-09 時点の状態:

- 公開ツール 29 種・対応 source 20 種・テスト 733 件すべて通過
- `npm test` / `npm run build` / `npm run typecheck:scripts` / `npm run smoke:mcp:offline` は通過済み
- カーリル図書館MCP用の `npm run smoke:calil-mcp` を追加済み。これは Codex の MCP 設定とは別の Node smoke script。Codex CLI では `codex mcp add calil --url https://mcp-beta.calil.jp/mcp` と `codex mcp login calil` による直結を確認済み。初回 OAuth 認可後、新しい Codex セッションから `mcp__calil__.search_libraries` を呼べる
- live smoke matrix は `jdcat` の上流メンテ時を除き通過実績あり。`nijl_articles` / `kokusho` / `ninjal_bibliography` の明示 live smoke も 2026-05-11 に通過
- GitHub リポジトリ公開済み: `https://github.com/itarunnn/jp-lit-mcp`
- `npx -y jp-lit-mcp` による MCP 起動導線を整備済み
- `npx -y jp-lit-mcp install-skills <app>` による Skills インストール導線を整備済み
- `npx -y jp-lit-mcp doctor` による軽量診断を整備済み
- README / install docs / usage guide / source-usage-conditions を整備済み
- ライセンスは `MIT`

## 実装済み

- 書誌検索・所蔵確認・デジコレ OCR / 全文 / 図版検索は実装済み
- 同じ source の選別済み候補1〜10件を、順序を保った部分成功と単件 cache/session 共有で詳細取得する `jp_lit_get_records` を実装済み
- レファレンス協同データベース（CRD）は `jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases` として実装済み
- ローカルキャッシュ、明示的な調査セッション開始（`jp_lit_start_session`）、調査セッション保存（`jp_lit_annotate_session`）、Markdown / JSON / CSL JSON エクスポート（`jp_lit_export_session`）に対応済み
- 検索・取得・照合・典拠補助などの cached tool と annotation / trace / session export は、調査案件を指す `session_id` を必須入力として明示 routing する。`session_id` は MCP transport の `Mcp-Session-Id` や結果保存用 `cache_key` とは別で、`current.json` はローカル互換用 mirror に限定する
- 過去セッション一覧（`jp_lit_list_sessions`）、過去セッション検索（`jp_lit_find_sessions`）、`session_id` 指定 export に対応済み
- 保存済み検索結果の一覧・検索・再整理・view export・削除・古い cache の pruning（`jp_lit_list_cache` / `jp_lit_search_cache_index` / `jp_lit_refine_results` / `jp_lit_export_view` / `jp_lit_delete_cache` / `jp_lit_prune_cache`）に対応済み
- Web NDL Authorities から典拠候補・別名義・分類由来の件名標目候補・安全な検索ヒントを返す補助 tools（`jp_lit_resolve_authority` / `jp_lit_find_authority_terms_by_classification`）を追加済み
- Web NDL Authorities の件名語から NDC / NDLC 分類記号を提案し、CiNii Books `category` filter に渡せる `jp_lit_suggest_classification_codes` を追加済み。`jp_lit_search` は CiNii 系検索の 0 件・ローマ字 query と、source を問わない広い結果集合に `diagnostics` を返す
- KAKEN から研究課題・研究成果報告書 PDF・成果リストの手がかりを返す補助 tool（`jp_lit_search_kaken_projects`）を追加済み。KAKEN は `jp_lit_search` の source ではなく、文献確定前の検索語展開・報告書確認の入口として扱う
- Crossref / OpenAlex で単一文献候補を DOI・タイトル・著者・刊行年から照合する補助 tool（`jp_lit_enrich_record`）を追加済み。外部 provider は `jp_lit_search` の source ではなく、既存候補の書誌確認を補強する用途に限定する
- `jp_lit_refine_results` は、保存済み `jp_lit_enrich_record` cache を任意で重複クラスタへ重ね、DOI・provider status・match confidence を表示できる。これは外部 API の再照会ではなく、本文確認や重要度評価でもない
- `cinii_dissertations` を CiNii Research 統合後の博士論文・学位論文 source として追加済み。既定横断には含めず、学位論文を探す意図があるときに明示指定する
- Skill の調査行動に関する feedback を受け取るための issue templates と feedback guide を整備済み

## 最近の更新

- `0.11.0`: jp-lit の `session_id` を MCP transport の `Mcp-Session-Id` や結果保存用 `cache_key` と分離し、調査案件を指す明示的なアプリケーション側 handle として確定した。検索・取得・照合・典拠補助などの cached tool と annotation / trace / session export は `session_id` 必須となり、同じ cache を複数セッションで共有しながら利用記録を指定先へ分離する。非 current session の更新で `current.json` を切り替えず、`jp_lit_refine_results` は `cache_key` / `cache_keys` / `session_id` のいずれか1つを必須 selector として暗黙の current fallback を削除した。Skill、README、reference、offline smoke も明示 handle workflow へ移行した
- `0.10.0`: 検索後に選別した同じ source の1〜10件をまとめて詳細取得する `jp_lit_get_records` を追加。入力順を保つ部分成功、重複 ID の外部照会抑制、`jp_lit_get_record` と共通の単件 cache / session を実装した。これは上流の全件収集 API ではなく、生の検索結果全件を自動詳細化しない。`ndl_digital` 候補では、OCR やブラウザ確認の前に `content_access.manual_viewing` と `source_metadata.next_digital_library.available` を候補ごとに確認する既定手順を Skill とガイドへ追加した。デジコレ本体の公式検索画面を Browser / Chrome で操作する場合は、利用可能なブラウザとアクセス範囲を説明してユーザーの明示確認を得てから実行し、ログイン済み Chrome はその閲覧権限内だけで利用する。公開 API のないデジコレ本体全文検索をブラウザで補う利点と、再現性・自動化・網羅性の制約を明記した
- `0.9.1`: 発掘調査報告書・遺跡・埋蔵文化財・出土遺物は、明示指定した `irdb` を最初に使い、`ndl_search` で広域の書誌・所蔵候補を確認し、NDL 所蔵だけが必要な場合に `ndl_catalog` を使う routing を追加。全国文化財総覧の一部レコードを既存 IRDB / NDL Search 連携メタデータから間接 discovery する境界であり、全国の発掘調査報告書を完全収録するという主張ではない。IRDB search / detail では安全な HTTP(S) provenance URL、DOI・HDL・URI、複数ファイル URL、全国文化財総覧 record metadata を保持し、NDL Search では空の abstract が description fallback を妨げないようにした。全国文化財総覧本体の OAI-PMH harvest、endpoint 呼び出し、リンク先 PDF・画像・Excel・報告書本文の取得は実装していない。MCP SDK と XML parser を修正版へ更新し、production / development dependency の audit 0件を確認した
- `0.9.0`: 全体レビューを反映し、cache / export の path containment と上書き境界、junction / symlink と書込失敗時の復旧、明示的な `jp_lit_start_session`、session 更新の直列化、28 tool の実副作用に沿った annotations を整備した。J-STAGE pagination を現行 `start` contractへ修正し、CiNii appid 未設定時は検索を継続しつつ公式必須の警告を返す。横断検索は一部 source 障害時も成功結果と `source_errors` を返し、全 source 失敗時だけ全体 error とする。Node.js 22以上、Windows / Ubuntu × Node 22 / 24 CI、deterministic offline smoke、audit 0件、publish tag identity検証を追加し、デジコレ本体の画面内部 endpointは公開MCP・公開文書・npm packageへ含めない境界を維持した
- `0.8.0`: `jp_lit_suggest_classification_codes` を追加。Web NDL Authorities の件名語から NDC / NDLC 分類記号を抽出し、CiNii Books `category` filter に渡せる `suggested_category_param` と `jp_lit_search` 呼び出し例を返す。`jp_lit_search` は `filters.cinii.category` を `source=cinii_books` のときだけ受け付け、CiNii 系検索の 0 件・ローマ字 query と、source を問わない広い結果集合に `interpretation` / `diagnostics` を返す
- `0.7.10`: 次世代デジタルライブラリー Book API の `f-ndc` filter について、`f_ndc: "9"` のような短い上位分類指定を `9*` に正規化し、`f_ndc: ""` や空白だけの値は未指定と同じ cache entry に畳むようにした。adapter test では公式パラメータ `f-ndc` / `fc-isClassic` と、非採用 alias（`field` / `ndc` / `isClassic`、Illustration API の `q-contents` / `graphictag`）が URL に混入しないことを固定した
- `0.7.9`: デジコレ OCR 系ツールの検索範囲を明確化。`jp_lit_search_fulltext` は次世代デジタルライブラリー API の OCR 検索であり、デジコレ本体の全文検索画面/API ではなく、「ログインなしで閲覧可能」資料全体の検索でもないことを README / usage guide / reference / tool description に明記した。デジコレ本体の公式検索画面では、ログインなし公開資料、館内限定資料、送信サービス限定資料を含む MCP 範囲外の全文ヒットが見える場合がある。網羅性が必要な調査では、MCP の結果だけで「デジコレ全文にヒットなし」と断定せず、公式画面でのブラウザ検索・手動確認を併用する運用にした。次世代デジタルライブラリー Book API の NDC 上位分類 filter は `9*` のような前方一致で扱い、`f_ndc: "9"` のような短い数字は MCP 側で `9*` に正規化する
- `0.7.8`: NDL デジタルコレクション detail に `content_access.manual_viewing` を追加。`source_metadata.next_digital_library` は MCP が自動 OCR / 全文 API を使えるかの判定として維持し、個人送信対象・図書館送信対象・国立国会図書館内限定のような手動閲覧導線を分けて返す。MCP から全文を自動取得できなくても、NDL の登録利用者ログインや参加館・館内端末で読める可能性をエージェントが説明できるようにした
- `0.7.7`: Gitleaks / Timeahead の repository history scan で JDCat の public schema field ID が `generic-api-key` として検出される偽陽性を確認し、該当 fingerprint だけを `.gitleaksignore` に登録。現行コードでは mapper 内の引数名を `langField` / `textField` に変更し、credential 風の命名を避けた。実 credential の流出ではなく、MCP tool / source の追加・削除もない
- `0.7.6`: `jp_lit_enrich_record` を追加。Crossref は無認証 REST + 任意 `CROSSREF_MAILTO`、OpenAlex は `OPENALEX_API_KEY` 前提で、未設定時は `providers.openalex.status="skipped"` として扱う。`jp_lit_refine_results(include_enrichment=true)` では保存済み照合 cache を重複クラスタに付与できる。`cinii_dissertations` を明示 source として追加し、CiNii Research OpenSearch の `dissertations` search type を使う。既定横断・live smoke matrix には含めず、CSL JSON export では博士論文候補を `type="thesis"` として出力する。未収録・低引用を日本語人文系文献の低重要度とは扱わない
- `0.7.5`: README / install docs / GitHub Skills 導線を整理。Skill-first の導入説明、カーリル図書館MCP、CiNii Research API の `appid` を `CINII_RESEARCH_APP_ID` として MCP server env に渡す説明を初見向けに明文化。MCP tool の追加・削除はなし
- `0.7.4`: `jp-lit-research` の確認ラベルを `候補確度` / `確認` / `本文` に分離。NDL Search 等のヒットのみを関連文献や本文確認済みとして扱わない契約、デジコレ OCR 複合語 0 件の扱い、長期調査の rolling checkpoint / 分担契約を明文化
- `nijl_articles` / `kokusho` / `ninjal_bibliography`: 国文学論文、国書・古典籍、日本語研究・日本語教育文献の専門 DB を明示 source として追加。既定横断には含めず、manifest 本体・画像本体・本文一括取得をしない確認導線として運用
- `jp_lit_search_kokusho_fulltext` / `jp_lit_search_kokusho_image_tags`: 国書DBの本文スニペット検索と画像タグ検索を、書誌 source とは分けた専用 tool として追加。本文全体・画像本体・manifest 本体は取得しない
- 検索・取得系 cached tool の挙動を統一。`force_refresh=true` を明示しない限り cache を優先し、cache hit 時は保存日時と「上流APIへは再検索していません」という導線を返す
- `jp_lit_list_sessions`: 過去の調査セッションを新しい順に一覧し、trace / 採用候補 / source / 作成・更新日時で再開候補を棚卸しできる tool を追加
- `0.3.0`: `national_archives` / `jacar` を明示 source として追加。国立公文書館DA・JACAR の目録確認に対応し、既定横断には含めない慎重な導線として運用
- 保存済み検索結果の refined export で、重複候補クラスタと `search_result_readiness` を確認できる導線を追加
- `jp_lit_search_kaken_projects`: KAKEN の研究課題・研究成果報告書 PDF・成果リスト preview を、文献確定前の補助 tool として追加
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
- 未知の文献・資料・調べ方を探索する調査では、実検索前に調査前情報収集（CRD・NDL リサーチ・ナビ）を行い、結果を計画に反映する
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
- 検討中 source: `nihonbungaku_metadata`。日本文学研究メタデータ検索は有望な日本文学論文メタデータ source だが、個人運営サービスで外部連携 API は連絡前提と読めるため、未許諾の adapter 実装は行わない。将来実装する場合は、利用者ごとの `NIHONBUNGAKU_METADATA_API_KEY` とローカル個人調査用途のキャッシュ境界を前提にする。
- 次の改善候補は `jp_lit_enrich_results` による複数候補の重複統合・証拠 ranking、検索品質 eval
