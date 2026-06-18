# 日本文学研究メタデータ検索 メモ

対象サービス:

- https://nihonbungaku-metadata.lophorina.me/

位置づけ:

- `日本文学研究メタデータ検索` は、日本文学研究の学会誌から抽出した論文メタデータを横断検索できる個人運営の研究支援プロジェクト。
- 2026-06-18 確認時点で、Web フロントエンドは `data/corpus.json` と `data/facets.json` を読み込む。
- `data/corpus.json` には、論文タイトル、著者、雑誌、巻、年、カテゴリ、キーワード、被論者、作品、時代区分、LLM 生成と見られる要旨、ページ、J-STAGE URL などが含まれる。
- ただし、サービス側は外部システムとの連携向け検索 API について、利用希望時に連絡する導線を示している。`jp-lit-mcp` は、未確認のまま外部連携 API や公開 JSON を source adapter として組み込まない。

ローカル MCP での基本方針:

- `jp-lit-mcp` は利用者の端末で動くローカル MCP サーバとして配布される。
- この source を将来実装する場合も、repo や npm package に共通 API キーを同梱しない。
- 利用者が提供元から許諾または API キーを得て、環境変数 `NIHONBUNGAKU_METADATA_API_KEY` に設定する形を基本にする。
- API キー未設定時は、この source を無効化し、提供元への連絡が必要であることをエラーまたは doctor 表示で案内する。
- 個人調査のローカルキャッシュは許容範囲を確認したうえで最小化し、メタデータの再配布・ミラー化・公開検索サービス化はしない。

想定 source 名:

- `nihonbungaku_metadata`

将来 adapter を実装する場合の境界:

- 検索対象は論文メタデータに限る。
- 本文、PDF、画像、ログインが必要なノート、投稿 API、Supabase 認証、コミュニティノート作成 API は扱わない。
- `summary` にはサービス由来の要旨を入れる場合があるが、LLM 生成メタデータであり、引用・判定前に元論文または J-STAGE 等の公式レコードを確認する。
- `source_metadata` には `journal`, `volume`, `category`, `keywords`, `subjects`, `works`, `period`, `pages`, `jstage_url` を保持する。
- `url` はサービス側の安定した record URL が確認できるまで、`jstage_url` または検索画面 URL を優先する。

実装前に確認すること:

- 外部連携 API の正式な endpoint、認証方式、rate limit、利用登録方法。
- API キーを利用者ごとに取得してよいか。
- 検索結果・詳細結果のローカルキャッシュ可否と保存期間。
- 出典表示、サービス名表示、J-STAGE 等の元リンク表示の要件。
- LLM 生成メタデータ、分類、要旨を MCP 経由で再表示してよい範囲。
- npm package として配布されるローカル MCP からの利用が、提供元の想定する外部連携に含まれるか。

初期実装を見送る理由:

- 個人運営プロジェクトであり、API 連携は連絡前提と読める。
- 公開 JSON を取得できることは確認できるが、それを配布 MCP の source として自動利用してよい根拠にはならない。
- `jp-lit-mcp` の既存方針では、利用条件・保存条件・表示条件が source ごとに実装へ影響するため、許諾と仕様確認を先に置く。
