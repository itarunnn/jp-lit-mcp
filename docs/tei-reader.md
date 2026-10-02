# TEI readerの導入と構造読解

jp-litの任意CLIで、保存したTEI/XMLの情報・章や歌の一覧・構造付き抽出・文書内参照を確認する。書誌探索は既存MCP、取得版と来歴・読解の判断は`jp-lit-tei` Skill、XML処理はPython readerが担う。

## 導入

Node.js22以上、[uv](https://docs.astral.sh/uv/getting-started/installation/)、Python3.13.15を使う。TEI readerのPython依存は標準ライブラリのみ。Pythonはuvで用意できる。初回はPythonをdownloadする場合がある。

```sh
uv python install 3.13.15
npx --yes --package=jp-lit-mcp jp-lit-tei-reader --help
npx --yes jp-lit-mcp install-skills codex
```

Skills installerはjp-lit-research、jp-lit-verification、jp-lit-teiを導入する。MCPの書誌検索はNode.jsだけで動き、uv/PythonはTEI読解時に必要になる。

source checkoutではrootから次を実行する。

```sh
node scripts/tei-reader.mjs --request request.json
npm run test:tei
```

Python project単独なら`packages/tei-reader`へ移動し、`uv run --frozen python -m tei_reader --request /absolute/path/request.json`を使える。npm launcherはcallerの相対要求pathを解決し、package外のcacheにPython環境を作る。UV_PROJECT_ENVIRONMENTを指定すると環境配置を変更できる。

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

要求/manifest64KiB、XML10MiB、深度256、要素10万/全node20万、属性/namespace宣言各20万、XPath索引の全文字列累計16,777,216文字、一覧/参照既定20件・最大100件、抽出2,000要素/4,000node/20,000 payload文字、UTF-8応答1MiB。manifest最大100record。大きい章は節・歌へ分割する。

長い祖先名による索引増幅もdocument_too_complexへ分類する。文字数上限はXPathごとの完全pathを足した値で、Unicode code pointを数える。これは索引文字列の上限であり、process全体のメモリや実行時間のhard limitは提供しない。

通常応答はstdoutのUTF-8 JSON1件とLF。成功0、要求エラー2、XML/hash/上限/locatorエラー3、内部/launcherエラー4。起動環境の問題はruntime_launch_failed。PowerShell 7ではConvertFrom-Json -AsHashtable -ErrorAction Stopを使い、空namespace keyを保持する。CLI終了値とokも確認する。

DOCTYPE、外部実体、XInclude展開、ネットワーク取得、XMLへの書込みは提供範囲から除く。Expat2.7.2以上を実行時確認する。TEI namespaceのTEI rootが対象で、teiCorpus/schema検証は対象外。固定資料と合成fixtureで検証した範囲を超える一般適合や原画像校合を保証しない。

[利用ガイド](usage-guide.md) / [公開Skill](../skills/jp-lit-tei/SKILL.md) / [Python reader](../packages/tei-reader/README.md)
