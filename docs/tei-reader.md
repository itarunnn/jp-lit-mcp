# TEIの使い方: 文学資料・歴史史料の構造を読む

jp-litの任意CLIで、保存したTEI/XMLの情報・章や歌の一覧・構造付き抽出・文書内参照を確認する。書誌探索は既存MCP、取得版と来歴・読解の判断は`jp-lit-tei` Skill、XML処理はPython readerが担う。

## 研究で使う場面

主な読者は、日本文学・日本史の資料を調べ、本文と校訂情報を確認する研究者を想定する。TEIは本文の区切り、異読、訂正、注記、人名・地名などをXMLのタグで表すための形式で、採用するタグや粒度は資料ごとに異なる。最初に手元のXMLの構造と書誌・底本の記述を確かめる。

| 研究上の問い | 調べる構造と位置 | readerで行うこと |
| --- | --- | --- |
| 作品のある章、歌集のある歌を読む | `div`、`lg`、`l`などの区切り・番号 | 単位を一覧にし、候補の位置を確かめて抽出する |
| 異表記や訂正を検討する | `choice`の`orig/reg`や`sic/corr`、`subst`の`del/add` | 各枝と元の属性を保って取り出す |
| 日記・書簡・記録の一項目を読む | XMLが採用する項目・段落・日付のタグ | 対象範囲を抽出し、人名・地名・注記のタグも確認する |
| 本文と注記、画像への参照を確認する | `xml:id`、`target`、`facs`など | 文書内の解決状態と、外部参照の未確認状態を分ける |

日付の換算、人物・地名の同定、異読の採否、底本との校合は研究上の判断として別に行う。readerが返すタグと参照先は、XMLの記述に基づく確認材料として使う。

## AIに依頼して読む

`jp-lit-tei` Skillを導入したAIアプリへ、対象のXMLのpathと研究上の問いを伝える。CLIを実行できるアプリで使う。MCPは資料の書誌を探す際に利用し、取得済みXMLの読解はreaderだけでも行える。

文学資料の依頼例:

```text
jp-lit-teiを使って、次のXMLの書誌・底本の記述と章一覧を確認してください。
第一章を抽出し、異読・訂正・注記を分けて示してください。
本文の採用や現代語訳は、元の枝を示した後で相談したいです。
XML: J:\Research\tei\sample.xml
```

歴史史料の依頼例:

```text
jp-lit-teiを使って、次の日記TEIの項目の区切りと日付の記述を確認してください。
対象項目を特定して抽出し、人名・地名・校訂注のタグを原位置付きで示してください。
日付の換算や人物同定は、XMLの記述とこちらの解釈を分けてください。
XML: J:\Research\tei\diary.xml
```

公開TEIを探す依頼では、作品・史料名、編者、底本、対象範囲を伝える。公開元の案内、取得版、利用条件を確認し、ローカルに保存したXMLを読解対象にする。AIには、取得URL・版ID・hash、採用した単位のlocator、抽出範囲、原構造と解釈、画像の実見・校合の状態を残すよう依頼する。

## 導入

Node.js22以上、[uv](https://docs.astral.sh/uv/getting-started/installation/)、Python3.13.15を使う。TEI readerのPython依存は標準ライブラリのみ。Pythonはuvで用意できる。初回はPythonをdownloadする場合がある。

```sh
uv python install 3.13.15
npx --yes --package=jp-lit-mcp@0.15.0 jp-lit-tei-reader --help
npx --yes jp-lit-mcp@0.15.0 install-skills codex
```

Skills installerはjp-lit-research、jp-lit-verification、jp-lit-teiを導入する。MCPの書誌検索はNode.jsだけで動き、uv/PythonはTEI読解時に必要になる。

`codex`はCodex CLI / App向け。Cursorは`cursor`、Claude Codeは`claude`に置き換える。導入後はアプリで新しい対話を開き、`jp-lit-tei`が見えることを確認する。ここで指定した`0.15.0`はTEI readerを含む版で、既存のMCP設定を変更する必要はない。

source checkoutではrootから次を実行する。

```sh
node scripts/tei-reader.mjs --request request.json
npm run test:tei
```

cloneしたrepository内では`node scripts/tei-reader.mjs`を使う。通常導入の`npx --package=...`はrepository外で実行する。npmが同名のローカルpackageを参照すると、readerの実行名が見つからない場合がある。

Python project単独なら`packages/tei-reader`へ移動し、`uv run --frozen python -m tei_reader --request /absolute/path/request.json`を使える。npm launcherはcallerの相対要求pathを解決し、package外のcacheにPython環境を作る。UV_PROJECT_ENVIRONMENTを指定すると環境配置を変更できる。

## PowerShell 7で一通り試す

この例はrepositoryをcloneしたdirectoryのrootで実行する。付属の[sample.xml](../packages/tei-reader/examples/sample.xml)は操作説明用の合成資料で、第一章に異表記・訂正・注記を含む。保存済み資料で試す場合は`$teiFile`をそのXMLの絶対pathに替え、一覧で得た実際の区切りを使う。

以下を順に実行すると、同じXMLのhashと、readerが返したlocatorを次の操作へ引き継げる。関数は要求JSONをstdinで渡し、CLI終了値・JSON変換・`ok`を確認する。

```powershell
$teiFile = (Resolve-Path './packages/tei-reader/examples/sample.xml').Path

function Invoke-TeiReader {
    param([hashtable]$Request)
    $raw = ($Request | ConvertTo-Json -Depth 20 -Compress) |
        node scripts/tei-reader.mjs --request -
    $exitCode = $LASTEXITCODE
    $response = $raw | ConvertFrom-Json -AsHashtable -ErrorAction Stop
    if ($exitCode -ne 0 -or -not $response.ok) {
        throw "TEI reader: $($response.error.code) (exit $exitCode)"
    }
    return $response
}

# 1. XMLと版を確認し、bodyの位置を得る。
$inspect = Invoke-TeiReader @{
    operation = 'inspect_document'
    file_path = $teiFile
}
$documentHash = $inspect.document.sha256
$body = $inspect.result.body_locators[0]

# 2. body直下の章を一覧にする。
$chapters = Invoke-TeiReader @{
    operation = 'list_units'
    file_path = $teiFile
    expected_sha256 = $documentHash
    scope_xpath = $body.xpath
    relation = 'children'
    element = '{http://www.tei-c.org/ns/1.0}div'
    attribute_equals = @{ type = 'chapter' }
    limit = 20
    offset = 0
}
$chapters.result.items | ConvertTo-Json -Depth 20

# 3. サンプルの最初の章を、返された位置から抽出する。
$chapter = $chapters.result.items[0].locator
$extract = Invoke-TeiReader @{
    operation = 'extract_unit'
    file_path = $teiFile
    expected_sha256 = $documentHash
    locator = $chapter
    view = 'structured'
}
$extract.result | ConvertTo-Json -Depth 100

# 4. その章にある参照を点検する。
$references = Invoke-TeiReader @{
    operation = 'check_references'
    file_path = $teiFile
    expected_sha256 = $documentHash
    scope_xpath = $chapter.xpath
    attributes = @('target', 'facs', 'corresp', 'resp')
    limit = 20
    offset = 0
}
$references.result | ConvertTo-Json -Depth 30
```

付属サンプルは章が1件で、抽出結果に`orig`の「舊」と`reg`の「旧」、`del`の「い」と`add`の「ハ」、`note`が別要素として残る。`note`の`target="#p1"`は`resolved_local`になる。どの枝を読む本文に採用するかは、この結果を見て判断する。

`total_matching`は条件に一致した全件数、`items`は今回のpageで返された候補、`next_offset`は続きの開始位置。複数の候補があるときは番号・見出し・原属性と位置を確認してから選ぶ。実資料ではchapter以外の`type`や歌の`lg`などを使う場合があるため、付属例の区切りをそのまま当てはめない。

## 応答を研究記録へ残す

各操作は`ok`、`document`、`result`を持つJSONを返す。`document.sha256`は読んだXMLの版を確かめる値で、locatorのXPathはそのXML内の位置を示す。引用や読解メモにはXMLの取得元・版・hash、採用したlocator、対象範囲、原文と解釈の区別を残す。

抽出結果の`selection_applied=false`と`reading_text=null`は、元の枝を保持した状態を示す。構造付き結果から読みやすい本文や訳を作る場合も、採用した枝と原位置を別記し、原資料との照合状態を添える。

参照点検の`resolved_local`は、指定XML内の参照先が一意に見つかった状態を示す。外部URLや画像の存在、到達、実見を確認した値へ読み替えない。`ok=true`でも未解決・未確認の参照が残る場合がある。

## 自作例から始める

[sample.xml](../packages/tei-reader/examples/sample.xml)は操作説明用の合成資料。repositoryから取得するか自分のXMLを使い、以下のfile_pathを実際の絶対pathへ置き換える。

```json
{
  "operation": "inspect_document",
  "file_path": "/absolute/path/sample.xml"
}
```

UTF-8でrequest.jsonへ保存してCLIへ渡す。inspectはexpected_sha256を省略できる。以後の操作では応答document.sha256を使い、例の64桁hash部分を置き換える。

```json
{
  "operation": "list_units",
  "file_path": "/absolute/path/sample.xml",
  "expected_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "scope_xpath": "/t:TEI[1]/t:text[1]/t:body[1]",
  "relation": "children",
  "element": "{http://www.tei-c.org/ns/1.0}div",
  "attribute_equals": {"type": "chapter"},
  "limit": 20,
  "offset": 0
}
```

一覧のlocatorを使ってextractする。ここでは自作例の第一段落を示す。

```json
{
  "operation": "extract_unit",
  "file_path": "/absolute/path/sample.xml",
  "expected_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "locator": {
    "document_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "xpath": "/t:TEI[1]/t:text[1]/t:body[1]/t:div[1]/t:p[1]"
  },
  "view": "structured"
}
```

章内だけの参照点検にはscope_xpathを指定する。

```json
{
  "operation": "check_references",
  "file_path": "/absolute/path/sample.xml",
  "expected_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "scope_xpath": "/t:TEI[1]/t:text[1]/t:body[1]/t:div[1]",
  "attributes": ["target", "facs", "corresp", "resp"],
  "limit": 20,
  "offset": 0
}
```

## 位置と構造の保持

locatorはdocument_sha256と正規絶対XPath、一意な場合の補助xml_id。XPathはreaderが返した位置を再利用する。tはTEI、xmlはXML、他namespaceはURI順のn1/n2…でdocument.namespacesに返す。要素・属性名は`{URI}local`、namespaceなし属性はtype/n等の原key。

extractはelement/text/comment/PI順序、属性、元のin-scope namespaceを保持する。choiceのorig/reg・sic/corr、substのdel/add、本文/訓/noteを別要素のまま返す。selection_applied=false、reading_text=null。単一本文を作る場合の枝の選択は読解側の解釈として別記する。

XMLパーサー処理後の論理内容を扱う。CDATA境界、entityの元表記、元prefix、属性順序、byte round-tripは再現範囲から除く。XML名の入力受け入れは使用するパーサーに従う。locatorのXML名は[XML1.0のNCName文字範囲](https://www.w3.org/TR/xml/#NT-NameStartChar)で点検する。

## 範囲と参照

listのchildren/descendantsはscope自身を除外する。checkのscopeは自身と子孫を含み、summary・total_occurrences・paginationも選択範囲。checkのscope省略/nullは全文書。参照先xml:idの一意性と祖先xml:baseは全文書で確認する。

参照statusはresolved_local、unresolved_local、ambiguous_local、empty_fragment_unverified、base_context_unverified、external_unverified、relative_or_bare_unverified。XML空白でtokenを区切り、コンマやUnicodeを補正しない。処理成功でも未解決参照が残る。

## 来歴と確認状態

inspectのprovenance_manifest_pathは任意。台帳はJSON arrayで、local_path/sha256/bytesが必須。local_pathは台帳parent基準で解決し、指定XMLへ一意に一致するrecordを確認する。url/repository/commit/path/retrieved_atは任意string。

manifest_claimsは台帳とlocal bytesの対応。URL/commitは申告来歴として保持する。XML headerの書誌・底本・権利・校合宣言と、公開元をこちらで確認した記録を分ける。README/LICENSE/XMLの記述差は原位置付きで残す。

画像URI/zoneの記述、文書内リンク解決、画像への到達、実見、校合は個別の確認状態。readerは外部資源を取得しない。検証flagはxml_well_formed=true、tei_schema_validated=false、remote_resources_fetched=false、source_collated=false。

## 上限とエラー

よくある問題は、終了値と`error.code`から次の順で切り分ける。

| code / 状況 | 確認することと次の操作 |
| --- | --- |
| `runtime_launch_failed` | Node.js、uv、Python3.13の導入・PATHを確認し、`--help`から再実行する |
| `file_access_error` | XMLまたは要求JSONのpathと読み取り権限を確認する |
| `invalid_request` | 操作名、要求field、hashの形式を確認する。inspect以外は`expected_sha256`を指定する |
| `invalid_xml` | XMLの整形式を確認する |
| `unsupported_document` / `doctype_forbidden` | TEI namespaceの`TEI` rootと、DOCTYPEを含まない対象条件を確認する |
| `hash_mismatch` | 保存XMLと取得版を再確認し、inspectからやり直す。以前のlocatorを新しい版へそのまま流用しない |
| `unit_too_large` / `output_too_large` | 章を節・段落・歌に分け、返す単位やpageを小さくする |
| 参照の未解決・未確認 | 元のtoken、参照先ID、対象範囲を確認し、残る問題を記録する |

要求/manifest64KiB、XML10MiB、深度256、要素10万/全node20万、属性/namespace宣言各20万、XPath索引の全文字列累計16,777,216文字、一覧/参照既定20件・最大100件、抽出2,000要素/4,000node/20,000 payload文字、UTF-8応答1MiB。manifest最大100record。大きい章は節・歌へ分割する。

長い祖先名による索引増幅もdocument_too_complexへ分類する。文字数上限はXPathごとの完全pathを足した値で、Unicode code pointを数える。これは索引文字列の上限であり、process全体のメモリや実行時間のhard limitは提供しない。

通常応答はstdoutのUTF-8 JSON1件とLF。成功0、要求エラー2、XML/hash/上限/locatorエラー3、内部/launcherエラー4。起動環境の問題はruntime_launch_failed。PowerShell 7ではConvertFrom-Json -AsHashtable -ErrorAction Stopを使い、空namespace keyを保持する。CLI終了値とokも確認する。

DOCTYPE、外部実体、XInclude展開、ネットワーク取得、XMLへの書込みは提供範囲から除く。Expat2.7.2以上を実行時確認する。TEI namespaceのTEI rootが対象で、teiCorpus/schema検証は対象外。固定資料と合成fixtureで検証した範囲を超える一般適合や原画像校合を保証しない。

[利用ガイド](usage-guide.md) / [公開Skill](../skills/jp-lit-tei/SKILL.md) / [Python reader](../packages/tei-reader/README.md)
