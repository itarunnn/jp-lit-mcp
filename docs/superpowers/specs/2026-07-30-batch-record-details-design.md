# 複数レコード詳細取得 設計

## 目的

`jp_lit_search` で得た複数候補について、書誌詳細、閲覧経路、次世代デジタルライブラリーの OCR 利用可否を、エージェントが候補ごとに `jp_lit_get_record` を呼び直さず確認できるようにする。

特に `source=ndl_digital` では、候補を利用者へ提示したり OCR・ブラウザ確認へ進んだりする前に、次をまとめて確認できる状態を目指す。

- `content_access.manual_viewing` による個人送信、図書館送信、国立国会図書館館内限定の閲覧経路
- `source_metadata.next_digital_library.available` による MCP の OCR 系ツール利用可否
- 詳細レコードで補完される書誌情報と公式 URL

この機能は、MCP の tool call 往復を減らすクライアント側の一括制御である。上流 source に一括取得 API があるとみなしたり、未キャッシュの複数 ID を1回の上流リクエストで取得したりするものではない。

## 検討した案

### 案1: `jp_lit_get_record` を単件・複数件の共用にする

`source_id` と `source_ids`、単件出力と複数件出力の union が必要になる。既存クライアントの入力・出力契約が複雑になり、単件利用の互換性確認範囲も広がるため採用しない。

### 案2: `ndl_digital` 専用の一括取得 tool を作る

今回の主目的には合うが、内部処理は既存の汎用レコード詳細取得と同じである。source ごとに同種の tool を増やす設計になりやすいため採用しない。

### 案3: 同一 source の複数 ID を受ける `jp_lit_get_records` を追加する

既存の単件契約を保ち、同じ source の候補だけを安全な上限内でまとめられる。単件キャッシュも再利用でき、`ndl_digital` 以外の候補確認にも使えるため採用する。

## 公開インターフェース

### 入力

```ts
{
  source: SourceName;
  source_ids: string[]; // 1件以上10件以下
  force_refresh?: boolean; // 既定 false
}
```

- `source` は既存 `jp_lit_get_record` と同じ source enum を使う。
- 1回の呼び出しでは全 ID に同じ `source` を適用する。source が異なる候補は source ごとに分ける。
- `source_ids` は各要素を trim し、空文字を拒否する。
- 安全上限は入力時点で10件とする。重複を含めて10件を超える入力は拒否する。
- trim 後に重複する ID は、最初の出現だけを残す。出力順はこの一意化後の入力順とする。
- `force_refresh=true` は全 ID の単件キャッシュを迂回し、各詳細を上流 source から再取得する。

### 出力

```ts
{
  source: SourceName;
  requested_count: number;
  unique_count: number;
  success_count: number;
  error_count: number;
  items: Array<
    | {
        source_id: string;
        status: "ok";
        record: RecordOutput & {
          cache: {
            hit: boolean;
            cache_key: string;
            saved_at: string;
            refresh_hint: string | null;
          };
        };
      }
    | {
        source_id: string;
        status: "error";
        error: {
          category:
            | "not_found"
            | "invalid_request"
            | "timeout"
            | "http"
            | "invalid_payload"
            | "unknown";
          message: string;
        };
      }
  >;
}
```

- `requested_count` は入力配列の件数、`unique_count` は trim・一意化後の件数とする。
- `success_count + error_count === unique_count` を常に満たす。
- `items` は一意化後の入力順を保つ。成功と失敗を別配列に分けず、各 ID の結果を同じ位置関係で確認できるようにする。
- 成功要素の `record` は既存 `recordOutputSchema` の全フィールドに加え、単件キャッシュの `cache.hit`、`cache.cache_key`、`cache.saved_at`、`cache.refresh_hint` を必須で含む。
- 個別取得の失敗は tool 全体を失敗させず、該当 ID の `status="error"` として返す。
- エラー message は category ごとの固定された安全な説明とし、上流応答本文や例外 message をそのまま公開しない。

エラー分類は次の対応とする。

| category | 対応する失敗 |
| --- | --- |
| `not_found` | `NotFoundError` |
| `invalid_request` | `InvalidRequestError` |
| `timeout` | `UpstreamTimeoutError` |
| `http` | `UpstreamHttpError` |
| `invalid_payload` | `UnsupportedPayloadError` |
| `unknown` | 上記以外の予期しない個別処理エラー |

入力 schema 自体の不正は通常どおり tool call を失敗させる。個別 `source_id` の source 固有検証失敗は `invalid_request` として部分失敗にする。

## キャッシュと session

一括結果全体の新しいキャッシュは作らない。`jp_lit_get_record` の既存単件キャッシュを ID ごとに再利用する。

そのため、`jp_lit_get_record` の tool handler から、次の責務を共有関数として抽出する。

1. `force_refresh` を cache key 対象から外す。
2. cache namespace `jp_lit_get_record` で `runCachedTool` を実行する。
3. live 時は `recordService.getRecord` と `recordOutputSchema` 検証を行う。
4. `withToolCache` で単件の cache 情報を付与し、`RecordOutput` を返す。

単件 tool と一括 tool は同じ共有関数を使う。これにより次を保証する。

- 単件で取得済みの ID を一括呼び出しでも cache hit にできる。
- 一括取得した ID を後続の単件呼び出しでも cache hit にできる。
- ID の並び順や部分集合が違っても、該当する単件キャッシュを再利用できる。
- `force_refresh=true` は各 ID の単件キャッシュを迂回する。
- 個別取得エラーはキャッシュしない。

`runCachedTool` の現行契約に従い、cache hit または live 成功した ID は `jp_lit_get_record` の session entry として記録する。個別取得エラーと一括 wrapper 自体には session entry を追加しない。

`jp_lit_get_records` 専用の cache directory は存在しないため、`CACHED_TOOL_NAMES` には追加しない。一方で、外部 read と単件 cache/session write を行う公開 tool なので、MCP annotations は `CACHED_EXTERNAL_ANNOTATIONS` とし、tool description でも副作用を説明する。

## 実行制御

- 一意化後の最大10件を、固定 concurrency 2 で処理する。
- concurrency は利用者入力にしない。上流 source への過剰な並列照会を避け、tool の安全特性を固定する。
- retry、ページング、検索結果からの自動全件収集は行わない。
- 上流照会数は、原則として「キャッシュにない一意 ID の件数」である。source adapter が1件の詳細化に複数 endpoint を使う場合は、その内部照会も発生しうる。
- batch は tool call の往復削減であり、上流 API の rate limit や利用条件を緩和しない。

## Skill の既定挙動

`jp-lit-research` では、`ndl_digital` の検索結果を次のように扱う。

1. 検索結果全件ではなく、利用者へ提示する候補、OCR 利用を検討する候補、ブラウザ確認の要否を判断する候補へ先に絞る。
2. 候補が1件なら `jp_lit_get_record`、2〜10件なら `jp_lit_get_records` を使う。
3. 10件を超える場合は、重要候補へ絞るか、必要性が説明できる小さい chunk に分ける。生の検索結果全件を自動詳細化しない。
4. `manual_viewing` と `next_digital_library.available` を読み、MCP 内で取得できる範囲、公式画面で確認する価値、必要な閲覧権限を候補ごとに整理する。
5. 一括詳細取得は MCP 内の処理であり、デジコレ公式画面のブラウザ利用許可を意味しない。公式画面を操作する場合は既存のブラウザ権限契約に従う。

これにより、`ndl_digital` の検索を行うたび無条件に全件詳細化するのではなく、回答や次段階に使う候補だけは原則として詳細確認する運用にする。

## 実装対象

- `src/lib/schemas.ts`
  - batch input、cache 必須の成功 item、失敗 item、batch output schema と型を追加する。
  - MCP 登録用の top-level object schema と、件数不変条件を検証する内部 schema を分ける。
- `src/tools/jpLitGetRecord.ts`
  - 既存の単件キャッシュ付き詳細取得を共有関数へ抽出する。公開 tool の挙動は維持する。
- `src/tools/jpLitGetRecords.ts`
  - trim 後の一意化、固定 concurrency 2、部分成功、順序保持を実装する。
- `src/server.ts`
  - tool を生成・登録し、入力・出力 schema、description、annotations を公開する。
- `scripts/smoke-mcp.ts`
  - 公開 tool 一覧へ追加し、offline smoke で2件の単件 cache を seed して、順序、cache hit、単件 session namespace を確認する。
- `tests/jpLitGetRecords.test.ts`
  - schema、順序、一意化、上限、部分失敗、error category、cache 共有、force refresh、concurrency をテストする。
- `tests/jpLitGetRecord.test.ts`
  - 共有関数抽出後も単件 tool の契約と cache を維持することを確認する。
- `tests/smokeMcp.test.ts`
  - tool 一覧、公開 schema、source enum、force refresh を確認する。
- `tests/toolDescriptionQuality.test.ts`
  - 29 tool の annotations と batch tool の副作用分類を確認する。
- `README.md`
  - 単件と一括の使い分けを短く案内する。
- `docs/usage-guide.md`
  - 入出力例、部分失敗、上限、`ndl_digital` 候補確認フローを説明する。
- `docs/reference.md`
  - 正式な schema、cache/session、上流照会の境界を説明する。
- `docs/project-status.md`
  - 実測後の公開 tool 数とテスト件数を更新する。
- `skills/jp-lit-research/SKILL.md`
  - 選別後の `ndl_digital` 候補を詳細確認する短い必須契約を置く。
- `skills/jp-lit-research/workflows/fulltext-page-lookup.md`
  - 1件と2〜10件の使い分け、閲覧経路・OCR 可否の読み方、ブラウザ権限との分離を説明する。
- `tests/skillGuide.test.ts`
  - Skill の候補選別、件数別 tool 選択、全件詳細化禁止、ブラウザ権限分離を固定する。
  - README、usage guide、reference、project status の tool 名、上限、cache 境界、上流一括 API との違い、公開 tool 数を固定する。

## 非対象

- `jp_lit_get_record` の入力・出力契約変更
- source の異なる ID を1回で混在させること
- 上流 source 用の新しい一括 API
- 検索結果全件の自動詳細化、全件収集、網羅クロール
- concurrency、retry、batch size の利用者設定
- `ndl_digital` の `manual_viewing` や `next_digital_library` 判定ロジック自体の変更
- デジコレ公式画面のブラウザ操作、ログイン、本文・画像取得
- 個別エラーのキャッシュ

## 検証

1. batch schema と tool の failing test を先に追加し、未実装で RED になることを確認する。成功 item の cache 必須性と `items.length`・status 別件数・合計件数の不変条件には negative test も置く。
2. 共有単件 lookup を抽出し、既存 `jp_lit_get_record` tests が GREEN のままであることを確認する。
3. batch tool を最小実装し、順序、一意化、部分失敗、固定 concurrency、単件 cache 共有、`force_refresh` を focused tests で確認する。
4. server、smoke、tool definition tests を更新し、公開 tool が29件で正しい schema と annotations を持つことを確認する。
5. Skill と公開文書の failing contract test を追加してから、使い分けと境界説明を実装する。
6. 独立レビューで、互換性、上流負荷、部分失敗、cache/session、Skill の過剰自動化を点検する。
7. `npm test`、`npm run build`、`npm run typecheck:scripts`、`npm run smoke:mcp:offline`、`git diff --check` を実行する。
