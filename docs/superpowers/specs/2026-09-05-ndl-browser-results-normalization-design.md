# デジコレ・ブラウザ観測結果の共通候補化 設計

## 目的

公開版 `jp-lit-mcp` で、国立国会図書館デジタルコレクション（以下、デジコレ）の公式画面をエージェントがブラウザ確認した結果を、API 検索結果と同様にローカル cache / session へ保存し、統合、重複整理、注釈、Markdown / JSON / CSL JSON export に利用できるようにする。

利用者には一つの候補リストとして提示する一方、API 応答とブラウザ上の観測を同じ根拠強度として扱わない。内部 API、ブラウザ実装、認証情報は公開 MCP に組み込まない。

## 現状と課題

- `jp_lit_search` は共通 `SearchItem` を返し、cache / session、`jp_lit_refine_results`、`jp_lit_search_cache_index`、`jp_lit_export_view`、session annotation / export に接続している。
- `jp_lit_search_fulltext` は次世代デジタルライブラリー API 固有の item schema を返し、`jp_lit_refine_results` の対象外である。
- デジコレ公式画面のブラウザ確認は Skill と公開文書に権限・記録方法があるが、結果を構造化して MCP の候補処理へ渡す入口がない。
- 現在の `jp_lit_refine_results` と `jp_lit_search_cache_index` は `jp_lit_search` cache だけを読む。
- repo 内 Skill は次世代 API とデジコレ公式画面の範囲を分離しているが、現在インストールされている Skill の複製には古い説明が残る場合がある。

## 採用方針

### 採用: ブラウザ操作と観測記録を分離し、候補 result adapter で合流する

1. ブラウザ操作は Codex、Claude Code、Cursor 等のエージェント実行環境が担う。
2. 公開 MCP は新しい `jp_lit_record_ndl_browser_search` で、クライアントが渡した観測結果だけを検証・正規化・保存する。
3. `jp_lit_search`、`jp_lit_search_fulltext`、`jp_lit_record_ndl_browser_search` を candidate-producing tool として登録する。
4. source 固有 output を共通 `SearchItem[]` に射影する result adapter を置き、refine / cache index / export から利用する。
5. 利用者向け表示は共通候補リストにし、取得経路と確認範囲は provenance と evidence state で示す。

この方式なら、MCP package はブラウザや認証済み session に依存せず、エージェント側に browser capability がある場合だけ公式画面の欠落範囲を補完できる。

## 不採用案

### Skill の表示テンプレートだけを揃える

実装量は小さいが、ブラウザ結果を再整理、重複統合、注釈、export できず、「他 API と同じ体験」にならないため不採用とする。

### MCP にブラウザ操作を内蔵する

ブラウザ実装、OS、既存 Chrome profile、認証状態に公開 package が依存し、未ログイン検索とログイン済み閲覧の権限境界も曖昧になるため不採用とする。

### デジコレ画面内部 endpoint を利用する

公開・文書化 API ではなく、現在の公開境界と矛盾するため不採用とする。

## 公開 tool

### `jp_lit_record_ndl_browser_search`

デジコレ公式画面で観測した一回の全文検索結果を記録する local-write tool とする。外部通信は行わない。

主な入力:

```ts
{
  session_id: string;
  query: string;
  checked_at: string; // ISO 8601
  login_state: "logged_out" | "logged_in_existing_session";
  page: number;
  reported_total: number | null;
  total_relation: "reported_exact" | "reported_approximate" | "observed_lower_bound";
  filters: {
    access_scopes: Array<"public" | "transmission" | "ndl_onsite_only">;
    material_types: string[];
    raw_labels: string[];
  };
  items: BrowserSearchObservationItem[];
}
```

`items` は最大 100 件とする。各 item は次を受け付ける。

```ts
{
  pid: string; // 数字のみ
  title: string;
  volume: string | null;
  authors: string[];
  publisher: string | null;
  published: string | null;
  viewer_url: string; // https://dl.ndl.go.jp/pid/<pid> 系だけ
  access_scope:
    | "public"
    | "transmission_unspecified"
    | "individual_transmission"
    | "library_transmission"
    | "ndl_onsite_only"
    | "unknown";
  access_label: string;
  snippets: Array<{
    text: string;
    locator_type: "content_index" | "koma" | "filename" | "unknown";
    locator: string | null;
  }>;
  item_fulltext_state: "not_checked" | "unavailable" | "available" | "searched";
  hit_locations: string[];
  content_state: "not_checked" | "restricted" | "viewer_available" | "page_image_checked";
  print_file_state:
    | "not_checked"
    | "unavailable"
    | "dialog_available"
    | "generation_requested"
    | "pdf_ready"
    | "saved";
}
```

制限:

- snippets は item ごとに最大 5 件、各 500 文字までとする。
- hit locations は item ごとに最大 20 件、各 120 文字までとする。
- schema は strict とし、cookie、password、user ID、氏名、画像、スクリーンショット、PDF path を受け付ける拡張 field を置かない。
- URL は HTTPS かつ host が `dl.ndl.go.jp` で、URL 中の PID と入力 PID が一致することを検証する。
- `reported_total=null` の場合は output の `total` を観測 item 数とし、`total_relation=observed_lower_bound` を必須にする。
- `reported_total` がある場合は item 数以上でなければならない。
- `content_state=page_image_checked` は「実際に該当画像を見た」ことを表す。viewer control が表示されたことだけなら `viewer_available` に留める。
- `print_file_state=saved` は保存操作を観測した状態だけを表し、ファイル本体や path はこの cache に含めない。

主な output:

```ts
{
  query: string;
  source: "ndl_digital";
  page: number;
  limit: number;
  total: number;
  items: SearchItem[];
  observation: {
    method: "browser";
    service: "ndl_digital_collections";
    checked_at: string;
    login_state: "logged_out" | "logged_in_existing_session";
    reported_total: number | null;
    total_relation: "reported_exact" | "reported_approximate" | "observed_lower_bound";
    observed_count: number;
    filters: { ... };
  };
  cache: ToolCacheInfo;
}
```

各 item は `source="ndl_digital"` とし、`source_id="R100000039-I<PID>"` に正規化する。`source_metadata` には PID と次の browser observation を保持する。

```ts
{
  pid: string;
  candidate_origins: ["ndl_digital_browser"];
  browser_observations: [{
    checked_at: string;
    login_state: string;
    query: string;
    access_scope: string;
    access_label: string;
    snippets: Array<...>;
    item_fulltext_state: string;
    hit_locations: string[];
    content_state: string;
    print_file_state: string;
  }];
}
```

tool annotation は local cache / session を更新するため `readOnlyHint=false`、同じ入力でも session bookkeeping があるため `idempotentHint=false`、削除や上書きをしないため `destructiveHint=false`、外部通信しないため `openWorldHint=false` とする。

## 共通 candidate result adapter

`src/lib/candidateResults.ts` に candidate-producing tool の正本を置く。

```ts
const CANDIDATE_RESULT_TOOLS = [
  "jp_lit_search",
  "jp_lit_search_fulltext",
  "jp_lit_record_ndl_browser_search"
] as const;

type CandidateResultRef = {
  tool: CandidateResultTool;
  cache_key: string;
};
```

この module は tool ごとの cache output を読み、次を返す。

```ts
{
  ref: CandidateResultRef;
  query: string;
  total: number;
  source: SourceName | null;
  items: SearchItem[];
}
```

- `jp_lit_search`: 既存 item をそのまま使う。
- `jp_lit_search_fulltext`: PID を `ndl_digital` の canonical source ID に変換し、固有 field と highlights を `source_metadata` に保持する。既存 tool output は変更せず、adapter 上だけで共通化する。
- browser record: output の共通 item を使う。

adapter が不正な cache payload を読んだ場合は、その result ref を黙って無視せず invalid-payload error とする。

## refine と統合規則

`jp_lit_refine_results` に次の selector を追加する。

```ts
result_ref?: CandidateResultRef;
result_refs?: CandidateResultRef[];
```

既存 `cache_key` / `cache_keys` は `tool="jp_lit_search"` の省略記法として維持する。`session_id` selector は session 内の candidate-producing tool 全てを対象にする。selector 群は従来どおり一種類だけ指定できる。

output には `base_result_ref` / `base_result_refs` を追加し、`totals_by_base` に `tool` を追加する。既存 `base_cache_key` / `base_cache_keys` は後方互換用に維持するが、複数 tool を扱う場合の正本は result ref とする。

### 同一資料の統合

`key_by=source_record` で同じ canonical `source + source_id` が複数 result にある場合は、一件へ統合する。

1. 書誌 field は `jp_lit_search`、browser record、`jp_lit_search_fulltext` の順で、最初の非空値を採用する。
2. 配列 field は正規化した値で重複除去する。
3. `source_metadata.candidate_origins` と `browser_observations` は全 result から和集合にする。
4. access、snippet、閲覧・全文検索・印刷状態は browser observation として保持し、API 書誌 field を上書きしない。
5. 同じ source record の item を二重表示しない。
6. `duplicate_key` / `title_author_year` による別 source 間の近似一致は自動統合せず、従来どおり重複候補にする。

複数 browser snapshot がある場合は全観測を保持し、表示上の現在状態には `checked_at` が最新の観測を使う。過去の観測を削除しない。

## cache index、annotation、export

- `jp_lit_search_cache_index` は candidate result adapter を使って三種類の cache を検索する。
- index item に `tool` を追加し、top-level に `result_refs` を追加する。既存 `cache_keys` は互換用に維持する。
- `source` filter は adapter 後の logical source に適用する。
- session annotation は browser item も `source="ndl_digital"` と canonical source ID で選択できる。
- `jp_lit_export_view(view="refined_results")` は result refs をそのまま受け付ける。
- refined Markdown は source に加えて acquisition、公開範囲、本文確認、資料内全文検索、印刷用 PDF 状態を表示する。
- JSON export は全 provenance を保持する。
- CSL JSON は通常の `ndl_digital` 図書として書き出し、browser observation は bibliographic field に混ぜない。選択 note と provenance の短い要約だけを note に含める。

## ユーザー体験

エージェントは API とブラウザの結果を同じ候補形式で提示する。

```md
1. 斉藤隆夫『帝国憲法大要』憲政公論社, 1926
   - source: NDLデジタルコレクション, PID 1907653
   - 発見: NDL Search API / デジコレ全文検索（ブラウザ）
   - 公開範囲: 送信サービスで閲覧可能
   - 確認: 全文検索ヒット / 本文画像
   - 本文: 確認済み
   - 該当コマ: 67–73
   - 印刷用PDF: ダイアログ確認、未生成
```

最終回答では候補一覧を経路別に分断しない。ただし検索概要と調査ログでは、API と browser の total、取得件数、抽出件数、確認日時を別行で示す。

browser capability がない場合、または利用許可がない場合は tool に架空の観測を渡さず、「デジコレ公式画面は未確認」と報告する。

## Skill と公開文書

次を同時更新する。

- `skills/jp-lit-research/SKILL.md`
- `skills/jp-lit-research/workflows/fulltext-page-lookup.md`
- `skills/jp-lit-research/reference/01-core-workflow.md`
- `skills/jp-lit-research/reference/03-evidence-and-output.md`
- `README.md`
- `docs/usage-guide.md`
- `docs/reference.md`
- `docs/project-status.md`

Skill は次を指示する。

1. デジコレ本体の網羅性が必要なら、許可済み browser search を API と独立に実施する。
2. browser 結果を会話内だけで終わらせず、新 tool で同じ session に記録する。
3. API / browser cache を `jp_lit_refine_results(session_id=...)` で統合する。
4. 候補一覧は共通形式で表示し、来歴と確認範囲を item 内に残す。
5. ログイン、閲覧、PDF generation の権限段階を分ける。

repo 内 Skill 更新後、`node scripts/install-skills.mjs codex` で `~/.agents/skills/` を更新する。Codex が別の `~/.codex/skills/jp-lit-research` 複製も発見する現在環境では、同じ repo source から両方を同期し、主要ファイルの hash と文言を比較する。Skill の削除は行わない。

## エラー処理

- 不正 PID、非 HTTPS URL、host 不一致、PID 不一致: validation error。
- item 上限、snippet 上限、文字数上限超過: validation error。黙って切り捨てない。
- `reported_total` と item 数の矛盾: validation error。
- `reported_total=null` と exact / approximate の組合せ: validation error。
- 存在しない session: 既存 session not-found error。
- candidate result 以外の tool を result ref に指定: validation error。
- cache not found: result ref を含む明示 error。
- browser UI の総件数が読めない: `observed_lower_bound` と item 数で保存し、0件や正確な総数と表現しない。
- browser 操作失敗: record tool を呼ばず、session trace に未確認事項と次 action を残す。

## 互換性

- 既存 tool 名と既存 `jp_lit_search` / `jp_lit_search_fulltext` output は変更しない。
- `SearchItem` の既存必須 field は変更しない。
- refine / cache index output への追加 field は additive とする。
- legacy `cache_key` / `cache_keys` selector と既存 export input を維持する。
- cache file format version は現行を維持し、既存 cache migration は行わない。
- 新 tool を cache allowlist、session bookkeeping、MCP manifest、package test に追加する。

## テスト戦略

TDD で次を先に失敗させる。

1. browser input schema の正常系と strict negative matrix。
2. PID / URL canonicalization、件数関係、snippet / locator 上限。
3. browser result の共通 `SearchItem` mapping。
4. new tool の cache miss / hit、session entry、annotation 保持。
5. Next Digital fulltext cache の candidate adapter mapping。
6. legacy cache selector の互換性。
7. result refs と session selector による三種類の統合。
8. 同一 PID の field 補完、provenance 和集合、browser observation 保持。
9. cache index の tool-aware 検索。
10. Markdown / JSON / CSL JSON export。
11. MCP tool schema、tool annotations、tool description。
12. Skill / README / usage guide / reference の契約文言。
13. package distribution に内部 endpoint、browser runtime、認証情報処理が混入しないこと。

最終 gate:

```powershell
npm test
npm run build
npm run typecheck:scripts
npm run smoke:mcp:offline
git diff --check
git status --short --branch
```

repo Skill とインストール済み Skill の hash / 文言比較も別に実行する。ログイン済み browser の CI 自動化は行わず、2026-09-05 の手動 smoke で確認した viewer、資料内全文検索、印刷ダイアログの状態遷移を fixture / contract test に落とす。

## 対象外

- デジコレ画面内部 endpoint の利用または公開
- MCP server 自身による Chrome / Browser / Playwright / Computer Use の起動
- ログイン、パスワード、二要素認証、CAPTCHA の自動化
- Cookie、session token、利用者ID、氏名の取得・保存
- 本文画像、スクリーンショット、生成 PDF の cache 格納
- 館内限定資料の遠隔閲覧やアクセス制限回避
- ブラウザ結果の全件クロール保証
- package version bump、GitHub push、Release、npm publish

## 実装対象の概略

- Add: `src/lib/candidateResults.ts`
- Add: `src/tools/jpLitRecordNdlBrowserSearch.ts`
- Modify: `src/lib/schemas.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/persistence/cacheIdentity.ts`
- Modify: `src/tools/jpLitRefineResults.ts`
- Modify: `src/tools/jpLitSearchCacheIndex.ts`
- Modify: `src/tools/jpLitExportView.ts`
- Modify: `src/lib/persistence/cslJson.ts`
- Modify: `src/server.ts`
- Modify: public docs / Skill / tests

中央化している `schemas.ts` / `server.ts` の全面分割は既存 concern の範囲に留め、今回の機能に必要な candidate result module だけを新設する。
