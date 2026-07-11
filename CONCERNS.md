# CONCERNS

## 運用

- 既定は report-only。`assisted-fix` はこのスレッドで明示許可された範囲だけに使う。
- push、release、publish、外部サービスwriteは自動実行しない。
- 各項目に status、evidence、action、verification、next step を残す。

## Active

### C-001 Cache path traversal
- classification: assisted-fix
- status: resolved
- evidence: `tool` / `cache_key` がcache root外のJSONへ到達できる再現あり
- action: Task 1でFileCacheとcache inventoryを共有境界にし、prune/list/search-indexを統合
- verification: current/legacyのtraversal・junction・prune/list/search-index回帰test、全test suite、buildがpass
- next step: cache境界を変更する場合に回帰testと実経路containmentを再確認

### C-004 Export path and overwrite boundary
- classification: assisted-fix
- status: resolved
- evidence: session/view exportが任意の`output_path`へ既定で書き込み、既存ファイルも無条件に上書きしていた
- action: 既定の出力先をrepo内`exports/`に限定し、外部pathは`allow_external_path=true`、既存上書きは`overwrite=true`を必須化。relative/absolute/`..`とsymlink/junctionの実経路も共有helperで検証
- verification: focused export test、tool description quality test、全test suite、buildで確認
- next step: export境界を変更する場合に実経路containmentと明示flagのpositive/negative controlを再確認

### C-005 J-STAGE pagination contract
- classification: assisted-fix
- status: resolved
- evidence: J-STAGE WebAPIのページ送りに対し、`page=<n>`を送り`start`を送っていなかった
- action: `start=(page-1)*limit+1`、`count=limit`に変換し、`page`をリクエストから除外。J-STAGE matrixでpage 1/2の先頭`source_id`非一致を検証
- verification: adapter/smoke/package distributionのfocused test 39件、全test suite 585件、buildがpass。J-STAGE 1 sourceの低頻度live checkでpage 1/2の実`source_id`非一致、`failed=0`を確認
- next step: J-STAGE API contract変更時にURL regression testと低頻度live pagination checkを再確認

## Report-only backlog

### C-101 デジコレ本体内部APIの公開面への混入防止
- classification: report-only
- status: monitored
- evidence: local-only `docs/research/dl-ndl-internal-api-local.md`
- action: 公開MCP・package・CIへ組み込まない
- verification: package allowlistが`docs/research/`を含まず、`src/**/*.ts`と`.github/workflows/*.yml`に内部endpointが無いことをpackage distribution testで確認。方針を記載した設計文書はlocal-only memoと同様に検査対象外
- next step: 境界変更時に人間レビュー

### C-102 Cross-process session locking
- classification: report-only
- status: open
- evidence: 複数MCP processが同じcwdを共有する場合のlock未実装
- action: 今回はin-process serializationのみ
- verification: pending
- next step: 実運用で競合が確認された場合にlock方式を設計

### C-103 OCR payload duplication
- classification: report-only
- status: open
- evidence: normalized pages、raw、text contentで大容量payloadが重複
- action: 今回の互換修正範囲外
- verification: pending
- next step: resource linkまたはpagination設計を別spec化
