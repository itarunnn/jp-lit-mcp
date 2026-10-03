---
name: jp-lit-tei
description: Use when 日本文学の公開TEIを探して取得版を記録する場合、または保存したTEI/XMLから章・歌・異読・注記を原構造と位置付きで読む場合。一般の文献検索、OCR、TEIの編集・schema検証は各専門手順を使う。
metadata:
  short-description: 日本文学TEIの探索と構造読解
---

# 日本文学TEIの探索と構造読解

資料候補、取得版、XMLの原記述、こちらの実見を分け、hashとlocatorを伴う読解資料を作る。書誌探索はjp-lit MCP、ローカルXML読解は任意CLI `jp-lit-tei-reader` を使う。

<codex_skill_adapter>
## 起動
このSkillは日本文学TEIの探索・版固定・構造読解で使う。利用可能なMCPとローカルCLIを確認して直接実行する。
</codex_skill_adapter>

## 入口

新しい資料を探す場合は [探索・来歴・実行手順](references/workflow.md) を読む。保存済みXMLがある場合は同手順の版確認から始める。MCPが使える場合だけjp-lit検索を実行し、使えない場合はその状態を記録して取得済み資料を読む。

```sh
npx --yes --package=jp-lit-mcp jp-lit-tei-reader --request /absolute/path/request.json
```

readerにはuvとPython3.13が必要。初回のPython導入はuvにより行われる場合がある。MCPの書誌検索はNode.jsだけで利用できる。CLIの起動失敗は `runtime_launch_failed` を返す。

## 操作と判断

| 操作 | 入力の根拠 | 得るもの |
| --- | --- | --- |
| inspect_document | 保存XML・任意の取得台帳 | 実測hash、header、body位置、local bytesとの台帳対応 |
| list_units | 同じhash・scope locator | 完全一致件数と全候補の位置 |
| extract_unit | listが返したlocator | 原要素・属性・text/comment/PI順序 |
| check_references | 同じhash・任意のscope_xpath | 選択範囲の集計と参照の起点/解決先 |

番号・n・見出しの一意性はlistのtotal_matchingで判断する。複数一致は全候補を示す。大きい単位はchildrenで分割し、ページはnext_offsetを使う。

extractはchoice/subst/noteの各枝と原属性を保持する。selection_applied=false、reading_text=nullを維持し、こちらが枝を選んだ解釈を別欄へ置く。

checkのscope指定時は、その要素自身と子孫の参照を点検する。summaryとpaginationもその範囲。解決先IDとxml:base祖先は全文書を使う。省略/nullは全文書。未解決tokenを補正せず、処理成功と全件解決を分ける。

JSONはPython json.loads、またはPowerShell 7のConvertFrom-Json -AsHashtable -ErrorAction Stopで読む。namespace mapには空keyがある。CLI終了値とok、JSON変換の成功を確認する。

## 報告の根拠

対象・版、全候補/採用locator、原構造と解釈、参照点検範囲、出典/権利記述、確認状態、要求/応答の保存先を示す。manifest_claimsの一致はlocal path/hash/bytesの対応であり、公開URL/commitの独立照合とは区別する。

README/LICENSEとXMLの権利記述に差がある場合は原位置を併記して判断を保留する。画像URI/zone、到達、画像の実見、校合を個別に記録する。引用には原資料照合状態を付ける。

hash_mismatchは版と台帳を再確認し、unit_too_large/output_too_largeは単位・ページを縮小する。失敗と未確認範囲を明示して研究資料の保存先へ残す。
