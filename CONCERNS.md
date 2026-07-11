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

### C-006 CiNii appid contract
- classification: assisted-fix
- status: resolved
- evidence: CiNii Research公式APIでは`appid`必須だが、現行endpointは未設定でも応答する場合があり、docsとruntimeの扱いが曖昧だった
- action: CiNii 3 source明示またはsource未指定の検索は未設定でもadapterを呼んで結果を返し、`CINII_APP_ID_REQUIRED` warningを付与。明示的な非CiNii sourceと設定済み環境では付与しない。KAKENは未設定時に実行不可のまま維持
- verification: direct tool contractに加え、in-memory MCP経路の`createServer(env)`で未設定・空白・設定済みの3ケースを検証し、CiNii adapterの結果継続とwarning有無を固定。4本のapp別install docsは公式必須・互換検索のwarning付き続行・KAKEN実行不可・旧推奨表現不在をcontract testで確認。focused tests、全suite、build、secret-flowの`rg`確認でserverからsearch toolへ渡るのはtrim済みの設定有無booleanだけで、persistence/cache/session/snapshot側にappid実値の参照が無いことを確認
- next step: CiNii公式APIの認証要件または未設定応答が変わった場合にadapter動作とwarning契約を再確認

### C-007 Supported runtime and dependency verification
- classification: assisted-fix
- status: resolved
- evidence: Node.js 18を最低versionとして案内し、CIがなく、scripts配下のTypeScriptを独立してtypecheckしていなかった。更新前auditはproduction 6件、full 9件のadvisoryを報告した
- action: Node.js floorとdoctor/docsを22へ統一し、scripts用tsconfigと`typecheck:scripts`を追加。Windows/UbuntuとNode 22/24のmatrixでclean install、build、scripts typecheck、test、deterministic offline smokeを実行するCIを追加。offline smokeは固定fixtureをcacheへseedし、network-deny guard下で検索cache hitからannotation、session trace/list、exportまで検証。dependencyは現行range内で更新
- verification: `npm ci`、build、scripts typecheck、601件のtest、network故障注入、deterministic offline MCP smokeがpass。YAML parserでCIのtrigger/job/runs-on/matrix/steps階層を検証。production/full auditはいずれも0件で、既存direct dependency rangeは変更せず、CI test用のdev-only `yaml`だけを追加
- next step: GitHub Actions初回実行でWindows/Ubuntu・Node 22/24の4 jobを確認し、supported matrix変更時はdocs・engine・contract testを同時更新

### C-008 npm publish ref injection and registry failure handling
- classification: assisted-fix
- status: resolved
- evidence: `workflow_dispatch`の`package-ref`をbashの`run:`へ直接展開しており、stable tag・package version一致・既公開versionを検証していなかった
- action: checkoutのaction input以外ではdispatch inputを`env`経由に限定し、child process validatorでstable `vX.Y.Z`とpackage version完全一致を検証。`npm view`成功は既公開として停止し、非zeroはE404または該当versionなしだけを未公開として続行し、network/auth/registry障害はfail closedにした
- verification: validatorのpositive/negative child-process testと、YAML parserによるWindows `pwsh`、env参照、validator→package version確認→未公開確認→publish順序、fail-closed分岐の構造testで確認。localではregistryへの`npm view`と`npm publish`を実行していない
- next step: push後のmanual workflow初回実行でTrusted Publishingとnpm CLIの実際のnot-found出力を確認し、追加のnot-found形式が必要なら明示的なcontractとして追加

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
