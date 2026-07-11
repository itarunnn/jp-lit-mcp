# CONCERNS

## 運用

- 既定は report-only。`assisted-fix` はこのスレッドで明示許可された範囲だけに使う。
- push、release、publish、外部サービスwriteは自動実行しない。
- 各項目に status、evidence、action、verification、next step を残す。

## Active

### C-001 Cache path traversal
- classification: assisted-fix
- status: resolved
- evidence: `tool` / `cache_key` に加え、current/legacy cache root自体または`cache/v1`の親directoryを外部へ向けるjunctionで、read/write/delete/clear/list/prune/search-indexがbaseDir実体外へ到達する再現あり
- action: cache path共有helperを`baseDir + root + target`境界へ変更し、lexical containmentとreal baseDirをanchorにしたroot/target realpath containmentを検証。baseDir自体がjunctionの正常運用は許容
- verification: current 7 route・legacy 6 routeのroot/parent junction 26-case negative matrix、baseDir junction positive control、既存current/legacy回帰test、全test suite、buildで確認
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
- evidence: 当初は`workflow_dispatch`のraw inputをbashの`run:`へ直接展開し、修正後もraw inputでcheckoutした対象内validator/package.jsonによる自己検証だった。同名branchとtagを区別せず、tag refがpeelするcommitとtarget `HEAD`の一致も証明していなかった
- action: workflow実行元`${{ github.sha }}`を`trusted/`へ分離checkoutし、そのvalidatorのtag-only modeでraw inputをprecheck。validated outputから完全修飾`refs/tags/<tag>`だけを`package/`へcheckoutし、tag refの存在と`^{commit}`でpeelしたcommit＝target `HEAD`を確認後、trusted validatorのfull modeでpackage version完全一致を検証。`npm view`はE404または該当versionなしだけを続行し、その他はfail closedにした
- verification: tag-only/full validatorのpositive/negative child-process testと、YAML parserでtrusted checkout→env-only precheck→qualified tag checkout→tag ref/peeled commit＝HEAD→trusted version確認→未公開確認→target限定npm ci/build/test/publishの構造・順序を確認。target cache dependency pathと全npm stepの`package/` working directoryも固定し、localではregistryへの`npm view`と`npm publish`を実行していない
- next step: push後のmanual workflow初回実行でTrusted Publishingとnpm CLIの実際のnot-found出力を確認し、追加のnot-found形式が必要なら明示的なcontractとして追加

### C-009 Session lifecycle and in-process lost updates
- classification: assisted-fix
- status: resolved
- evidence: 明示的にcurrent sessionを切り替えるtoolがなく、同一process内でappend/annotate/trace updateが並行するとread-modify-write間でentryやtraceを失う再現があった。同一cache keyの並行writeも共有`.tmp`を奪い合い、rename失敗やtemp残留が起きた
- action: `jp_lit_start_session`を追加し、実在する旧currentだけをarchiveへ保持してからrandom suffix付きIDの新currentを開始する。SessionStoreのcurrent初期化・start・append・annotate・trace updateを単一in-process queueへ通し、失敗後もqueueを継続する。session persistはarchiveを先に、current pointerを最後に書き、session/cache共通のatomic replacement helperで置換失敗時に旧targetを復旧する。復旧も失敗した場合はbackupを削除せず、そのpathをerrorへ含める。cache writeはPID+UUIDのtempと同一target単位queue、finally cleanupを使う
- verification: fresh storeの初回startが1 sessionだけ作ること、start後の旧session read、concurrent append、start→append順序、mutation失敗後のqueue継続、legacy/new ID、same-key concurrent cache write、失敗時temp cleanup、atomic replace失敗時のrestoreとrestore失敗時のbackup保持、deterministic offline smokeでstart後の旧session exportを確認
- next step: session file構造またはmutation method追加時は、同じqueueとarchive-first/current-last順序を維持し、並行testを追加する

### C-010 Partial cross-source search
- classification: assisted-fix
- status: resolved
- evidence: source 未指定の既定8 source横断検索が`Promise.all`で、1 sourceのtimeoutや不正payloadで成功sourceの候補も含めて全体rejectしていた
- action: source順の`Promise.allSettled`集約へ変更し、1 source以上のfulfilledを正常結果としてmerge。失敗は固定の利用者向けmessageと明示source再試行hintを持つ`source_errors`へ分離し、全adapter reject時だけ`CrossSourceSearchError`にした。明示single-sourceのerror identityは維持
- commit: `fix: preserve partial cross-source search results`
- verification: focused REDで6件の失敗を確認後、63/63 pass。timeout/http/invalid_payload/unknown分類、source/source_errors順、0件fulfilled、全reject、明示single-source、output schema、response/cache/session非漏洩をtestし、buildとscripts typecheckがpass
- remaining risk: 部分成功は通常cacheに保存される。自動TTLや失敗sourceだけの再試行はなく、明示source検索または`force_refresh=true`が必要
- next step: 横断source追加時は順序、error分類、all-failure matrixとcache semanticsを同時に更新する

### C-011 Cached external tool annotations
- classification: assisted-fix
- status: resolved
- evidence: 16 cached external toolを`readOnlyHint=true` / `idempotentHint=true`としていたが、cache hitでもsessionを更新し、miss/refreshではcacheを作成・置換する
- action: 外部sourceを変更しない非破壊操作であることと、local cache/sessionを書き換えることを分離し、16 toolを`readOnlyHint=false`、`idempotentHint=false`、`destructiveHint=false`、`openWorldHint=true`へ統一。descriptionと公開referenceもexternal read / local bookkeeping writeへ更新
- verification: `CACHED_TOOL_NAMES`をsource of truthにしたregistry contractで16 toolの4 annotation値とdescriptionを固定。local純read 5 toolはread-onlyを維持
- next step: cached tool追加時はcache/session副作用と`CACHED_TOOL_NAMES`、annotations、descriptionを同時更新する

## Report-only backlog

### C-101 デジコレ本体内部APIの公開面への混入防止
- classification: report-only
- status: monitored
- evidence: local-only `docs/research/dl-ndl-internal-api-local.md`
- action: 公開MCP・package・CIへ組み込まない
- verification: package allowlistが`docs/research/`を含まないことに加え、`src/**/*.ts`と`.github/workflows/*.yml`、`package.json.files`から実効展開したREADME・公開docs・skills・install scripts・dist等に具体endpoint 2値が無いことをdistribution testで確認。非配布の設計文書は検査対象外
- next step: 境界変更時に人間レビュー

### C-102 Cross-process session locking
- classification: report-only
- status: open
- evidence: 複数MCP processが同じcwdを共有する場合のlock未実装。current/archive/cacheは各file内ではunique temp+renameで置換し、fallback失敗時は旧target復旧またはbackup保持を行うが、複数fileをまとめたtransactionではなく、Windows fallbackではtarget→backup→tempの間に短いgapもあり得る
- action: 今回は同一SessionStore instance内のmutation serialization、archive-first/current-last、失敗後も継続するqueueまで。process間lockとjournal/recovery protocolは導入しない
- verification: 同一processのconcurrent appendとstart→append順序、queue failure recovery、旧archive保持、same-key cache concurrent writeはtestで確認。別process間の競合は未検証で、保証しない
- remaining risk: 複数MCP processが同cwdを使うと、file単位のatomic replacementでもsession全体のlost updateやcurrent/archive間の不整合を防げない
- next step: 同じcwdを複数MCP processで同時利用する運用が必要になった場合、lock fileまたはOS lockと、current/archiveのjournal/recovery方式を別specで設計する

### C-103 OCR payload duplication
- classification: report-only
- status: open
- evidence: normalized pages、raw、text contentで大容量payloadが重複
- action: 今回の互換修正範囲外
- verification: pending
- remaining risk: 大きい資料でcache・出力・MCP responseの容量とメモリ使用量が増える
- next step: resource linkまたはpagination設計を別spec化

### C-104 NDL Search detail endpoint contract
- classification: report-only
- status: open
- evidence: `ndl_search` / `ndl_digital`の詳細取得は`/api/bib/external/search`のJSON/XML shapeと`f-token`に依存し、fixtureで現行shapeを固定しているが、versionedな公開contractとしての安定性は保証されていない
- action: 今回はendpoint変更や代替APIへの自動移行を行わない
- verification: adapter unit contractでURL組み立てとJSON/XML正規化を維持。live網羅確認は行っていない
- remaining risk: upstreamのendpoint停止、token方式、response shape変更でdetail取得が壊れる
- next step: 公開仕様または代替経路を確認し、移行は別specと実fixtureで設計する

### C-105 HTML parser versioned contract
- classification: report-only
- status: open
- evidence: J-STAGE detail、IRDB、国立公文書館DA、JACAR、国文研論文DB、NINJAL文献DB、KAKEN詳細などの複数parserがHTML meta/tag/表構造のbest-effort抽出に依存し、upstream shapeのversioned contractがない
- action: parser共通化、DOM library導入、live巡回を今回の修正に含めない
- verification: 現行fixtureとadapter unit testを維持。各upstreamの最新HTMLとの一括照合は未実施
- remaining risk: HTML改修が非例外の0件やfield欠落として現れ、破壊を検知できない可能性がある
- next step: sourceごとにfixture取得日、shape fingerprint、必須field、劣化時diagnosticを別spec化する

### C-106 Central tool/schema files
- classification: report-only
- status: open
- evidence: `src/lib/schemas.ts`は約1500行、`src/server.ts`は約800行で、公開toolの型・schema・registrationが中央fileに集中している
- action: Task 8では`source_errors`の最小追加に限定し、file分割やregistry再設計は行わない
- verification: build、scripts typecheck、tool manifest/output schema contractで今回の追加範囲を確認
- remaining risk: 並行開発時のconflict、schemaとtool配線の更新漏れ、review範囲の拡大
- next step: tool domainごとのschema/registration module境界を別specで設計する
