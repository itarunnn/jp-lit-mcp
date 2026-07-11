# 全体レビュー指摘対応 設計

作成日: 2026-07-11

## 目的

2026-07-11 の全体レビューで確認した問題を、既存の公開インターフェースと利用者データを可能な限り維持しながら修正する。修正はセキュリティ境界、接続 DB/API のずれ、依存関係・CI・公開手順、session/search resilience の順に行い、各段階を TDD と独立レビューで検証する。

push、GitHub Release、npm publish は本作業の範囲に含めない。

## 採用方針

単一の隔離ブランチ内で、独立してレビュー可能な4段階の変更として進める。

検討した代替案は次のとおり。

1. セキュリティと API drift だけを直す最小 hotfix
   - 公開上の緊急問題は短時間で閉じられるが、CI と session/search の既知問題が残る。
2. 検証済み問題を段階的に修正する方式（採用）
   - 各段階を個別にテスト・レビューでき、問題が出た場合の切り分けが容易。
3. tool registry、schema、persistence を同時に組み直す全面 refactor
   - 長期的な整理にはなるが、今回の修正範囲を超え、既存 contract の回帰リスクが大きい。

## 1. セキュリティ境界

### cache path containment

MCP から渡る `tool` と `cache_key` を、filesystem path の構成要素として無検証で使わない。

- 公開 schema では cache 対象 tool を既知の tool ID に限定する。
- 公開 schema では cache key を実際の生成形式 `sha256-` + 64桁小文字16進数に限定する。
- `FileCache` 自体でも、すべての read/write/delete/clear target が cache root 内であることを検証する。
- 絶対 path、`..`、Windows separator、UNC、symlink/junction を利用した root 外アクセスを拒否する。
- legacy cache root の読み取り・削除互換性は維持する。

安全性の不変条件は「利用者入力から到達できる cache filesystem 操作は、current または legacy cache root の外へ出ない」である。

### export overwrite

通常の相対出力は `exports/` 配下に限定し、既存ファイルを既定では上書きしない。外部 absolute path を必要とする既存用途は `allow_external_path=true`、既存ファイルの上書きは `overwrite=true` を明示した場合だけ許可する。

## 2. 接続 DB/API drift

### デジコレ本体の内部 API

デジコレ本体の `https://dl.ndl.go.jp/api/item/search` と `https://dl.ndl.go.jp/api/fulltext/search` は、公開・文書化 API ではなく、個人調査で公式 viewer の確認候補を発見するためのローカル専用経路として扱う。

- `src/`、公開 MCP tool、npm package、公開 docs、batch workflow、CI、live smoke matrix へ組み込まない。
- ユーザーが「裏API」「デジコレ本体全文検索」「MCPで拾えない限定資料」等を明示した個人調査でのみ、git 管理外の `docs/research/dl-ndl-internal-api-local.md` を参照する。
- 低頻度・小さい `pageSize` に限定し、網羅クロール、一括収集、定期実行を行わない。
- 本文・画像取得、cookie/session 利用、閲覧制限回避には使わない。
- 保存・報告対象は書誌、PID、公開範囲、最小限のスニペット、公式 viewer URL までとする。
- 結果は `内部 API 候補` と表示し、採用・引用には公式 viewer での人間確認を要求する。
- package distribution test で `docs/research/` が配布対象外であることを固定する。

公開機能の OCR 検索・全文取得は、引き続き文書化された次世代デジタルライブラリー API に限定する。内部 API の公開機能への混入リスクは `CONCERNS.md` に `report-only` で記録する。

### J-STAGE

J-STAGE WebAPI の pagination を、現行公式仕様どおり `start=(page - 1) * limit + 1` と `count=limit` で構築する。`page` パラメータは送信しない。

- unit test で page 2 が `start=limit+1` になることを固定する。
- live smoke で page 1 と page 2 の先頭 `source_id` が異なることを確認する。
- API note を現行仕様へ更新する。

### CiNii

`CINII_RESEARCH_APP_ID` 未設定時も現在の検索動作は維持する。ただし、HTTP 200 が公式な無登録利用許可を意味しないことを明示する。

- CiNii を含む検索結果の `diagnostics` に、`level="warning"`、`code="CINII_APP_ID_REQUIRED"` の警告を追加する。
- `doctor` は未設定をサーバー全体の失敗にはしないが、CiNii/KAKEN の設定不足として明確に表示する。
- README、usage guide、reference、API note の「推奨」「省略可」を、現在の互換動作と公式条件を分けた説明へ統一する。
- appid の値そのものはログ、cache、diagnostics に保存しない。

## 3. 依存関係・CI・publish

### dependency

現在の semver range 内で lockfile を更新し、production audit を0件にすることを目標とする。major dependency upgrade は、現行 range 内更新で解消できない場合だけ個別判断する。

### runtime と CI

- Node.js の公開最低要件を、現行 LTS に合わせて `>=22` とする。
- pull request と main push で、Node 22/24 の build、test、MCP smoke を実行する。
- Windows と Ubuntu の両方で path-sensitive tests を通す。
- `scripts/*.ts` を対象にした typecheck command を追加する。
- live API matrix は通常 CI から分離し、手動または低頻度 schedule で実行する。credential が必要な項目は secret 未設定時に明示 skip する。

### publish workflow

workflow input を shell code へ直接展開しない。publish 対象は `vX.Y.Z` tag に限定し、tag、`package.json` version、npm 未公開 version が一致した場合だけ publish step へ進む。

## 4. session/search resilience

### session lifecycle

新しい調査を明示的に開始する `jp_lit_start_session` を追加する。

- 既存 current session は archive file に残す。
- 新しい session ID は `YYYY-MM-DD-HHMMSS-<8桁hex>` とし、既存の `YYYY-MM-DD-HHMMSS` ID も読み取り互換として受け付ける。任意の `research_goal` と `scope_note` を初期値として受け取れる。
- start operation は additive であり、既存 session/cache を削除しない。
- tool annotations で state change、非破壊、closed-world を公開する。

session の read-modify-write は同一プロセス内で直列化する。cache の一時ファイル名は呼び出しごとに一意にする。複数 MCP process が同じ cwd を共有する場合の完全な cross-process locking は、実装範囲を広げず `CONCERNS.md` の report-only 項目として残す。

### cross-source search

既定横断検索は `Promise.allSettled` 相当で source ごとの成功と失敗を分離する。

- 1 source 以上が成功した場合は正常結果を返す。
- 失敗 source は追加フィールド `source_errors[]` に `source`、`category`（`timeout` / `http` / `invalid_payload` / `unknown`）、利用者向け `message`、再試行案 `hint` を含める。
- すべての source が失敗した場合だけ tool error とする。
- 既存の `items`、`total`、`facets` contract は維持し、failure metadata は追加フィールドとする。

### tool metadata

今回触れる tool から ToolAnnotations を導入し、最終的に全公開 tool の read-only、destructive、idempotent、open-world を registry-level test で固定する。tool description は annotations の代替にはしない。

cached external tool は外部 source 自体を変更しないが、cache hit でもローカル session を更新し、cache miss / refresh ではローカル cache を作成・置換する。SDK の「環境を変更しない」という read-only 契約には該当しないため、16 tool は `readOnlyHint=false`、`idempotentHint=false`、`destructiveHint=false`、`openWorldHint=true` とする。ローカル cache / session を読むだけの tool は read-only を維持する。

## Concern Loop

repo root に `CONCERNS.md` を追加する。

- 今回ユーザーが修正を許可した項目は `assisted-fix` として、状態、変更、検証、次の一手を更新する。
- cross-process locking、OCR payload の多重複製、NDL Search 内部 detail endpoint、HTML parser 群、tool/schema 巨大化は `report-only` として残す。
- 同一 concern で3回失敗した場合は `needs-human` にする。
- push、release、publish、外部サービス write は concern から自動実行しない。

## テストとレビュー

各段階で次の順序を守る。

1. 問題を再現する最小 test を追加し、期待理由で失敗することを確認する。
2. 最小実装で focused test を通す。
3. 関連 test、build、typecheck、MCP smoke を通す。
4. subagent が仕様適合とコード品質を独立レビューする。
5. 指摘を修正し、同じ reviewer gate を再実行する。

最終段階では全 test、build、MCP smoke、npm pack dry-run、audit、J-STAGE/CiNiiを含む低頻度 live checks、Windows/Linux CI定義、git diff/statusを確認する。

## 完了条件

- cache root 外の read/write/delete/clear PoC が再現しない。
- legitimate cache と legacy cache 操作が維持される。
- J-STAGE page 2 が page 1 と異なる結果を取得する。
- CiNii の無appid互換動作を保ちつつ公式必須条件が明示される。
- デジコレ本体の内部 API が公開実装・配布 package・自動 smoke に含まれない。
- production audit が解消され、通常 CI と publish gate が追加される。
- 新しい調査 session を明示開始でき、1 source 障害時も横断検索の正常結果が残る。
- `CONCERNS.md` に修正結果と残存リスクが記録される。
- worktree の全検証が通り、未関連差分がない。
