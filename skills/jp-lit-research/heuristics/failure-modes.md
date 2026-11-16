# 見つからない時の対処（failure_modes）

## 取得失敗・アクセス停止時の手順

検索の成否は、経路ごとに観測した応答から判断する。正常な検索結果の0件、取得失敗、アクセス停止、本文未確認を分けて残す。API・通常Web・公式画面のいずれかで取得が失敗した場合は、次の順で扱う。

1. **応答を確認する。** source・toolまたはサービス、検索語、対象の公開URL、観測日時、得られた応答を記録する。`source_errors` がある横断検索は部分成功として、成功sourceの候補を使う。HTTP statusがtoolから提供されなければ「HTTPエラー、status未提供」と記す。403だけで原因を確定しない。
2. **次の経路を判断する。** 下表で停止条件を先に確認する。サイトの条件は、対象domain・pathと今回の行為に対応する規約・robots.txt・画面表示を確認し、確認日時と根拠を残す。AI学習用収集、自動クロール、個別のagent操作、公式APIは、それぞれ該当する条件で判断する。
3. **同じ調査sessionへ保存する。** 下記の保存先を選び、観測事実、停止または切替の判断根拠、未確認範囲、次の行動を残す。
4. **確認できた範囲を報告する。** `検索概要` に部分成功・失敗・停止、`今回の確認範囲` に未確認範囲と次経路、`調査ログ` に試行と観測日時を示す。具体例は [出力手順](../reference/03-evidence-and-output.md#取得失敗や停止を含む報告)を参照する。

### 次の経路の判断例

次の表は運用判断の例であり、個別サイトの現在の利用可否を示すものではない。対象環境の個別指示で経路や自動切替が指定されている場合は、その指示を適用する。

| 観測した状態と条件 | 次の行動 | 残す確認範囲 |
| --- | --- | --- |
| 今回のagent操作の明示的禁止、該当するrobots.txtの拒否、CAPTCHA・WAF challenge、rate停止を確認 | 該当経路の操作とbrowserへの切替を停止する。利用者のbrowser許可があってもこの停止条件を適用する | 拒否・停止の根拠、確認できた範囲と未確認部分。確認済みの公式な人間向け入口があれば案内する |
| API・通常Webが403などで失敗し、原因未確定 | 応答・時刻を保存し、公開UIの条件を確認する。条件が確認できるまでは切替を保留する | 「取得失敗、原因未確定」。資料の有無と総ヒット数は未確認 |
| 公開UIが正規の経路で、今回のagent操作が禁止されず、停止条件がなく、必要な利用者許可とbrowser toolがそろう | 対象・目的・domainを限定して公式画面を操作する。同じ範囲の許可は引き継ぐ | API側の失敗と、公式画面で実際に観測した項目を経路別に残す |
| browser toolがない、必要な許可がない、または画面でも確認できない | 利用可能な経路で確認済みの内容を返し、必要な許可・利用環境または人間向け入口を次の行動として示す | 公式画面は未確認。ログイン済み画面の利用は既存の権限区分に従う |
| API検索が正常に0件 | そのAPI範囲では0件と記録し、目的に応じて検索語や別の正規経路を検討する | デジコレ本体の公式画面など、検索していない経路は未確認 |
| 公式画面で候補を一部確認した後、次ページでrate停止 | 追加操作を停止し、観測済み候補と停止したページを保存する | 例: 候補2件確認、残りのページは未確認、総ヒット数は画面で確認できた場合だけ記録 |

### 状態に応じた保存先

| 保存できる検索記録 | 保存方法 |
| --- | --- |
| 取得失敗で今回の `cache_key` / entryがない | `jp_lit_update_session_trace` の `open_questions` に未確認範囲と観測・判断の理由、`next_actions` に次の行動を保存する。API外のWeb・browserで停止した場合も同じ欄を使う |
| 横断検索が部分成功し、entryと `source_errors` がある | 成功候補と既存entryを保持する。対象の `tool`・`cache_key` を指定した `jp_lit_annotate_session` で、検索全体の `trace.search_attempt.outcome="partial"` と `notes` に失敗sourceを残す。未確認範囲と次の行動はsession全体にも記録する |
| 公式画面で実際に確認した候補・正常0件がある | `jp_lit_record_ndl_browser_search` で観測を保存する。途中停止の理由は `jp_lit_update_session_trace` に残す。総ヒット数が未観測なら `reported_total=null`、`total_relation="observed_lower_bound"` を使い、返された `total` は観測件数の下限として読む |

失敗の保存には、実在する調査 `session_id` を使う。検索entryの作成に至らなかった失敗でもsession traceは保存できる。同条件の過去の成功entryがある場合も、その成功記録を保ち、今回の失敗はsession traceへ追加する。失敗用の架空の `cache_key` や、browserで実行していない空検索は作らない。

部分成功のannotationでは、既存の `selected_items` と `notes` を読み、保持する内容を含めて渡す。この2項目は置換されるため、空配列で既存の選別を消さない。検索全体の `total` は実際のtool出力の範囲で使い、失敗sourceの件数は不明と記す。`search_attempt.total` が不明なら `null`、取得件数・抽出件数は実際に扱えた数とする。

### 検索entryがない失敗を記録する例

以下は、NDL Search APIの書誌検索がHTTP 403で失敗し、browser toolも利用できない場合の架空の例である。事前に `jp_lit_start_session` が返したIDを、両方の `session_id` に入れる。日時・検索語・応答・次経路は実際の観測へ置き換える。

観測日時は既存の `reason` に記す。traceの `created_at` は保存時に付与される時刻であり、入力には含めない。応答は記録に必要な要約とし、認証情報・cookieを含む生のheaderや本文は保存しない。

```json
{
  "tool": "jp_lit_update_session_trace",
  "arguments": {
    "session_id": "2026-11-16-100000-a1b2c3d4",
    "open_questions": [
      {
        "question": "普通選挙法に関するデジコレ資料の書誌候補と総ヒット数を確認する",
        "reason": "2026-11-16T10:00:00+09:00、NDL Search APIのjp_lit_search(source=ndl_digital, query=普通選挙法)がHTTP 403で失敗。原因未確定。検索entryなし、総ヒット数不明。browser toolを利用できず、公式画面と本文も未確認。",
        "related_sources": ["ndl_digital"]
      }
    ],
    "next_actions": [
      {
        "action": "利用者がデジコレ公式画面 https://dl.ndl.go.jp/ で普通選挙法を検索する",
        "reason": "今回の環境では公式画面を操作できないため、人間向け入口での確認を次の経路とする。",
        "priority": "medium",
        "source": "ndl_digital"
      }
    ]
  }
}
```

保存した停止理由を含めて引き継ぐ場合は、同じsessionを `profile="full_log"`、`format="markdown"` または `"json"` で書き出す。検索条件中心の `methods` や書誌用の `csl-json` と使い分ける。session traceはagentが記録した観測・判断として読む。

```json
{
  "tool": "jp_lit_export_session",
  "arguments": {
    "session_id": "2026-11-16-100000-a1b2c3d4",
    "profile": "full_log",
    "format": "markdown"
  }
}
```

## 「見つからない」と言う前に確認すること

依頼の intent に関係するものを試してから「見つからない」を報告する。すべての source を一律に試す必要はない。

```
共通チェック:
- [ ] 表記ゆれ・旧字体・旧仮名遣いを必要に応じて試したか（query-expansion.md）
- [ ] 目的に合う複数の source を試したか（source-selection.md）
- [ ] 検索語を広げる/狭める両方向を試したか
- [ ] 難航時にレファ協・リサーチ・ナビで、別の資料類型・索引・調査順序を確認したか

intent別チェック:
- bibliography_lookup: ndl_catalog / cinii_books / ndl_digital を確認したか
- topic_literature_review: cinii_articles / jstage_articles / ndl_articles / irdb を確認したか
- historical_term_search: nihu_bridge（normalize=true）と旧字・旧仮名を試したか
- fulltext_page_lookup: jp_lit_search_fulltext / jp_lit_search_pages を確認したか
- image_illustration_search: jp_lit_search_illustrations / japan_search を確認したか
- research_guide: リサーチ・ナビ / レファ協 / 分野別DBの導線を確認または未確認として明示したか
```

---

## 状況別の次の手

### A. 書誌情報が不確か（タイトル・著者・年が曖昧）

1. 確実な情報だけで絞り込む（著者名だけ、キーワードだけ）
2. 発行年に幅を持たせる（前後5年）
3. `ndl_digital` + 全文検索で本文から書誌を逆引き

### B. 古い時代の資料が見つからない

1. 旧字体・旧仮名遣いで再検索
2. `nihu_bridge` で異体字同定検索
3. `ndl_digital` + `jp_lit_search_fulltext` で全文横断
4. NDL に未所蔵の場合 → 専門図書館（ディープライブラリー）を案内

### C. 論文・紀要が見つからない

1. `irdb` を明示的に検索（機関リポジトリ）
2. `nihu_bridge` で人文学専門 DB 横断
3. `jstage_articles` で理工系・医学系の紀要も確認
4. Google Scholar / CiNii Research Web 直接検索を案内（MCP 外）

### C2. 一般誌・新聞記事や参考書誌側の確認が必要

1. `ndl_articles` / `ndl_articles_online` で雑誌記事索引を確認
2. `ndl_search` / `ndl_catalog` で誌名、巻号、所蔵、特集名の手がかりを確認
3. レファ協（`jp_lit_search_guides_manuals` / `jp_lit_search_guides_cases`）で、総目次・年鑑・索引・類似質問の導線を確認する
4. リサーチ・ナビで「雑誌の総目次・バックナンバー」「人物・伝記文献」など近い調べ方ページを確認する
5. 著者名、誌名、事件名、特集名、年代で検索語を作り直す
6. それでも一般誌・新聞側の欠落がありそうなら、`参考書誌確認` または `要有料DB確認` として確認先と検索語を提案する

参考書誌・有料DB用の検索語は、MCP の検索結果から得た語を人間が参考書誌、索引、契約 DB で試しやすい形にする。

```
参考書誌確認:
- 雑誌総目次・年鑑・専門索引: "誌名" "特集名" "年代"

要有料DB確認:
- ざっさくプラス: "主題語" AND "誌名または著者名"
- 大宅壮一文庫: "人物名" / "事件名" / "流行語"
- 新聞系 DB: "事件名" "年月" "地名"
```

この注意は毎回出さない。参考書誌・索引・一般誌・新聞・戦後以降のメディア言説が調査目的に関係する場合だけ出す。

### D. OCR 全文でヒットしない

1. 表記ゆれ・旧字を試す
2. 複合語 0 件を不在証明にしない。空白入り query や `AND` が 0 件でも、単独語検索へ戻す
3. 単独語検索と複合語検索を分けて調査ログに残す
4. 単独語でヒットした資料について、highlights、`jp_lit_search_pages`、本文 OCR、ページ画像を順に確認する
5. `searchfield=metaonly` で書誌検索に切り替える
6. より上位語・関連語で検索する

### D2. デジコレ本体の検索範囲も確認する

デジコレ公式画面は、MCP が使う次世代デジタルライブラリー API と検索範囲が同一ではない。公式画面のブラウザ確認は、MCP が 0 件の場合だけの fallback ではない。

利用者がデジコレ本体の全文、網羅性、限定資料を含むヒット確認を求める場合は、MCP の検索件数にかかわらず、公式画面を別経路として計画する。ブラウザ操作は既定では行わず、未ログイン検索とログイン済み Chrome を別の権限として事前に確認する。許可がない場合は、MCP で確認した範囲と公式画面が未確認であることを報告する。

### E. 資料はあるが本文を読めない

```
jp_lit_get_record(source=ndl_digital) の
source_metadata.next_digital_library を確認:
  - available=true → jp_lit_get_text_coordinates / jp_lit_get_fulltext 使用可
  - available=false + reason=not_available_in_next_digital_library → OCR 系ツール利用不可（実務上は次世代側未収録であることが多いが、アクセス制限・上流都合などとの厳密な区別はしていない）
```

---

## 「見つからない」報告のテンプレート

正常に検索できた範囲で該当資料が見つからなかった場合は、次の形式で調査過程を報告する。取得失敗・停止を含む場合は、上記の手順で未確認の経路を分ける。

```
【調査結果: 該当資料が見つかりませんでした】

試した source:
- ndl_catalog: 0件
- cinii_articles: 0件
- ...

試した検索語:
- 〇〇（ヒットなし）
- △△（ヒットなし）
- □□（別資料がヒットしたが該当なし）

可能性として考えられること:
- NDL 未所蔵の資料の可能性
- 検索語の表記ゆれが網羅できていない可能性
- デジタル化未済みの資料の可能性

次の手として:
- 〇〇専門の図書館（例: ○○文庫）への問い合わせ
- リサーチ・ナビ「〇〇の調べ方」を参照
- レファ協（https://crd.ndl.go.jp/reference/）で類似事例を探す
```
