# 全文・ページ特定・OCR ワークフロー（fulltext_page_lookup）

## 対象となる依頼

- 「この語がデジコレのどのページに出るか調べたい」
- 「〇〇という表現が使われている資料を全文から探したい」
- 「OCR でページの文字を取得したい」
- 「ページ画像の URL を取得したい」

---

## ツール早見表

デジコレでは、書誌、API の OCR 全文、公式画面の全文検索を分ける。

| 調べたいこと | 使う経路 | 分かること | 主な限界 |
| --- | --- | --- | --- |
| 資料名、著者、出版年などからデジコレ資料を探す | `jp_lit_search(source=ndl_digital)` | 書誌、PID、公式 viewer への入口 | 本文中の語を探す検索ではない |
| API で OCR 全文を検索する | `jp_lit_search_fulltext` | 次世代デジタルライブラリー収録資料の全文ヒット、スニペット、PID | デジコレ本体の全文検索範囲を網羅しない |
| デジコレ本体の全文検索範囲を確認する | デジコレ公式画面 + `jp_lit_record_ndl_browser_search` | 公式画面で観測できた全文候補、公開範囲、必要に応じて本文・印刷状態 | ブラウザ操作が必要で、MCPだけでは検索できない。全件クロールも保証しない |

ユーザーの指定は次のように解釈する。

- 「API で全文検索して」: `jp_lit_search_fulltext` まで。
- 「デジコレ本体まで全文検索して」: API と公式画面を別経路で検索する。ブラウザの明示指定があるため、未ログイン検索の可否は再確認しない。
- 「ログイン済みタブも使って本文・PDFまで確認して」: 指定された既存ログイン済みタブを、その調査範囲で利用できる。認証情報の入力が必要になったら停止する。

| 目的 | ツール |
|------|--------|
| 次世代デジタルライブラリー収録資料から全文横断検索 | `jp_lit_search_fulltext` |
| 国書DB収録本文のスニペット検索 | `jp_lit_search_kokusho_fulltext` |
| 特定資料内のページ検索 | `jp_lit_search_pages` |
| 特定ページの OCR テキスト + 画像 URL | `jp_lit_get_text_coordinates` |
| 資料全ページの OCR テキスト一括取得 | `jp_lit_get_fulltext` |

---

## 次世代 API とデジコレ公式画面を分ける

`jp_lit_search_fulltext` は次世代デジタルライブラリー API の収録資料を検索する。デジコレ本体の全文検索結果を取得する公開・文書化 API ではなく、デジコレ本体の全文検索を網羅しない。デジコレ本体では、次世代 API の範囲外にあるログインなし公開資料、個人送信・図書館送信対象、館内限定資料の全文ヒットが見える場合がある。

そのため、利用者がデジコレ本体の全文、網羅性、限定資料を含むヒット確認を求める場合は、MCP の検索件数にかかわらず、次の2経路を独立して計画する。

1. MCP で次世代デジタルライブラリー API の OCR 検索・ページ確認を行う。
2. 利用者の許可を得た場合だけ、デジコレ公式画面をブラウザで検索する。

公式画面を使う前に、調査計画の提示時に次のように確認する。

> 次世代デジタルライブラリー API の範囲に加えて、デジコレ公式画面も検索しますか？ 公式画面を使う場合は、未ログイン検索のみか、ログイン済み Chrome も使用可かを指定してください。

- 既定は MCP のみで、ブラウザ操作は行わない。
- 「デジコレ本体をブラウザでも検索して」という指示は未ログイン検索だけの許可として扱う。
- ログイン済み Chrome は別の権限であり、明示許可なしに使わない。内蔵 Browser から Chrome へ無断で切り替えない。ただし「ログイン済みタブがあるから見て」のように利用者が対象タブと利用を明示した指示は許可済みなので、同じ範囲について再確認しない。
- 検索と閲覧を分ける。未ログインでも公式画面の全文検索候補と公開範囲表示は確認できる場合がある。個人送信の本文画像などは利用者自身が認証した既存ログイン済み session が必要である。人間が認証した事実だけでは、その session をエージェントが使う許可にはならない。許可がなければ `本文: アクセス制限` として、未ログインで確認できた範囲までを記録する。
- `ndl_onsite_only` はログインしても遠隔閲覧できない。国立国会図書館内での利用が必要な状態として記録する。
- エージェントは認証情報を要求せず、認証情報を入力しない。MCP もエージェントも cookie を受け取らない。CAPTCHA を回避しない。アクセス制限を回避しない。
- MCP 本体はブラウザ・ログイン・外部通信を行わない。browser agent が公式画面を操作し、MCP は渡された観測値の検証・正規化・local cache/session 保存だけを担当する。

### 観測状態の契約

検索ヒット、資料詳細、本文画像、資料内全文検索、印刷ダイアログ、PDF生成、保存は別状態である。画面を一段進んだだけで後続状態を推定せず、schema の実 enum をそのまま記録する。

| 対象 | field / 状態 | 読み方 |
| --- | --- | --- |
| browser login | `login_state`: `logged_out` / `logged_in_existing_session` | デジコレ公式画面の認証状態。MCP の調査 `session_id` とは別物で、認証情報そのものでもない |
| 検索ヒット | `reported_total` + `total_relation`: `reported_exact` / `reported_approximate` / `observed_lower_bound` | ヒット表示を観測した状態。資料詳細や本文確認を意味しない |
| 資料詳細 | `jp_lit_get_record` / `jp_lit_get_records` の `content_access.manual_viewing` | 書誌・手動閲覧導線の確認。browser の本文状態とは別 |
| 資料内全文検索 | `item_fulltext_state`: `not_checked` / `unavailable` / `available` / `searched` | `searched` だけが資料内検索を実行した状態 |
| 本文画像 | `content_state`: `not_checked` / `restricted` / `viewer_available` / `page_image_checked` | `viewer_available` は画面入口、`page_image_checked` は画像を実見した状態 |
| 印刷・PDF | `print_file_state`: `not_checked` / `unavailable` / `dialog_available` / `generation_requested` / `pdf_ready` / `saved` | 印刷ダイアログ、生成依頼、PDF生成済み、保存済みを順に分ける |

filter の公開範囲は `public` / `transmission` / `ndl_onsite_only`、item の `access_scope` は `public` / `transmission_unspecified` / `individual_transmission` / `library_transmission` / `ndl_onsite_only` / `unknown` を使う。`print_file_state=saved` でも、PDF 本体や保存先は観測 schema に含めない。

`snippets` は item ごとに最大5件、各 snippet の `text` は最大500文字とする。`locator_type` は `content_index | koma | filename | unknown` の4値、`locator` は `string | null` とする。画面に表示された locator を記録できない場合は `null` を使う。

### 公開 API を確認できないことによる欠点

デジコレ本体の全文検索結果を返す公開・文書化 API は確認できていないため、MCP だけでは、公式画面側の総ヒット件数、該当コマ、スニペット、公開範囲を機械可読に一括取得できない。API としてのページング、キャッシュ、差分比較、安定した全件収集も保証できず、ブラウザ UI、セッション状態、表示遅延の影響を受ける。

### ブラウザ検索を併用する利点

許可を得たブラウザ検索では、次世代 API の件数が0件でも1件以上でも、API 範囲外の全文ヒットと公開範囲表示を補完できる。これにより、MCP の結果をデジコレ全体の不在証明にせず、検索可能範囲を分けた調査報告にできる。

ブラウザは公開 API の代替ではない。調査ログには query、filter、ログイン状態、確認日時、確認できたヒット表示範囲を残し、最終回答では「MCP の次世代デジタルライブラリー API 範囲」と「デジコレ公式画面範囲」を分ける。

## デジコレ公式画面の候補統合

許可済み browser 観測は、次の正の手順で API 候補と同じ調査 session へ合流させる。

1. 同じ `session_id` で `jp_lit_search(source=ndl_digital, ...)` と `jp_lit_search_fulltext(...)` を実行し、公開 API の書誌候補と次世代デジタルライブラリー範囲を保存する。
2. デジコレ本体の全文検索範囲が必要なら、ユーザーが許可した公式ブラウザで検索・必要範囲の閲覧を行う。
3. 観測値を `jp_lit_record_ndl_browser_search` へ渡し、同じ `session_id` に browser candidate result を保存する。
4. `jp_lit_refine_results(session_id=..., combine="union", key_by="source_record")` で API / browser / fulltext 候補を統合する。個別指定では `result_refs` に `{ tool, cache_key }` を渡す。
5. 採用候補を `jp_lit_annotate_session` で同じ session に記録する。
6. `jp_lit_export_session` で調査 session を、または次の完全な JSON のように `jp_lit_export_view` で統合結果を export する。`cache_key` は各 candidate tool の実際の返り値に置き換える。

```json
{
  "tool": "jp_lit_export_view",
  "arguments": {
    "view": "refined_results",
    "params": {
      "result_refs": [
        {
          "tool": "jp_lit_search",
          "cache_key": "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        {
          "tool": "jp_lit_search_fulltext",
          "cache_key": "sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        },
        {
          "tool": "jp_lit_record_ndl_browser_search",
          "cache_key": "sha256-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
        }
      ],
      "combine": "union",
      "key_by": "source_record",
      "limit": 30
    },
    "format": "json",
    "export_all": true
  }
}
```

同じデジコレ PID は canonical な `source="ndl_digital"` + `source_id="R100000039-I<PID>"` で一件へ merge される。書誌は API、全文 highlight は次世代 API、access/content/fulltext/print は browser observation の来歴を保つ。ユーザーには経路別の別一覧ではなく一つの候補リストを返し、item ごとに発見経路、`access`、`content`、`fulltext`、`print` を示す。検索概要と調査ログの total・取得件数・確認日時は経路別に残す。

---

## 複合語 query の扱い

- `jp_lit_search_fulltext` では空白 AND や `AND` 演算子を上流仕様として期待しない。`keyword` は分解せず上流 API へ渡される。
- 複合語 0 件を、両語が同一資料に存在しない証拠として扱わない。
- 人名・歴史語・表記ゆれを探す場合は、まず単独語で検索し、ヒット資料の highlights、ページ検索、本文 OCR、画像確認で文脈を確認する。
- `jp_lit_search_pages` は既知 PID 内の補助確認として使う。既知 PID で複合語が当たる場合があっても、全文横断検索の AND 仕様として一般化しない。
- 調査ログでは、単独語検索と複合語検索を分けて記録し、複合語 0 件の解釈を明示する。
- 実例: `キューリン` 単独では hit=25、`キューリン 博士` は hit=0 だった。複合語 0 件は不在証明ではなく、単独語検索と資料内確認へ戻す合図として扱う。

---

## フロー A: キーワードから全文横断検索 → ページ特定

```
1. jp_lit_search_fulltext(keyword="〇〇", size=20)
   → items[].pid 取得（この検索結果を PID として使う場合は available の事前確認不要）
   → items[].highlights で文脈確認

2. 特定資料のページを絞る
   jp_lit_search_pages(source=ndl_digital, pid=..., keyword="〇〇", size=20)
   → items[].page でページ番号取得

3. ページ画像・OCR 座標を取得
   jp_lit_get_text_coordinates(source=ndl_digital, pid=..., page=N)
   → page_image_url で画像確認
   → contents で OCR テキスト確認
```

---

## フロー A2: 国書DB収録本文のスニペット検索

古典籍・国書DBの本文中の語を探す依頼では、デジコレ OCR ではなく国書DB専用 tool を使う。

```
jp_lit_search_kokusho_fulltext(keyword="〇〇", limit=20)
→ items[].bid / items[].koma / items[].snippet / items[].viewer_url を確認
→ 重要な箇所は viewer_url から公式画面で確認
```

この tool は本文全体を取得しない。スニペットだけで断定しない。

---

## 候補詳細化: 検索結果から OCR・閲覧判断へ

- 検索結果から、提示・OCR・閲覧判断に使う候補へ先に絞る。生の検索結果全件を自動詳細化しない。
- `pids` は1〜10件を受け付けるが、1件なら `jp_lit_get_record`、2〜10件なら `jp_lit_get_records` を使う。10件を超える場合は絞り込み、または理由を説明できる小さな chunk に分ける。
- デジコレ PID が既知なら title を再検索せず、1件は `jp_lit_get_record` の `pid`、2〜10件は `jp_lit_get_records` の `pids` で現在の `manual_viewing` と `next_digital_library.available` を確認する。PID一覧全件の自動詳細化はしない。
- `content_access.manual_viewing.access_type` と `source_metadata.next_digital_library.available` は独立して読む。`available=false` だけでアクセス制限の原因を断定しない。
- metadata の batch は MCP での詳細確認であり、デジコレ公式画面のブラウザ利用許可を意味しない。公式画面は既存の明示的な許可を得た場合だけ使う。

---

## フロー B: 書誌からデジコレ → OCR（source_id 経由）

```
1. jp_lit_search(source=ndl_digital, query=...)
   → source_id 取得

2. jp_lit_get_record(source=ndl_digital, source_id=...)
   → source_metadata.next_digital_library を確認
   → available=true のみ次へ進む（false なら OCR 利用不可）

3. jp_lit_get_text_coordinates(source=ndl_digital, source_id=..., page=N)
   または
   jp_lit_search_pages(source=ndl_digital, source_id=..., keyword="〇〇")
```

---

## フロー C: 資料全文を一括取得

```
jp_lit_get_fulltext(source=ndl_digital, pid=... または source_id=...)
→ pages[].contents で全ページ OCR テキスト
→ 大きな資料は pages[] が長くなるため、必要なページだけ
  jp_lit_get_text_coordinates で取得する方が効率的
```

---

## OCR の限界と確認方法

- OCR は誤認識を含む。重要な箇所は必ず `jp_lit_get_text_coordinates` の `page_image_url` で画像確認する
- `coordjson` は IIIF フルサイズ画像のピクセル座標。縮小表示時はスケーリングが必要
- 全文検索ヒットだけで「この資料に〇〇が書かれている」と断定しない
- `jp_lit_search_fulltext` の絞り込み: `f_ndc`（NDC分類）/ `fc_is_classic`（古典籍）

---

## 報告テンプレート

```
【全文検索結果】
- 検索語: 
- ヒット資料数: 
- 確認資料: source=ndl_digital / pid=... / タイトル=...

【ページ特定】
- ヒットページ: N ページ
- OCR 抜粋: 「...」
- ページ画像 URL: https://dl.ndl.go.jp/api/iiif/...

【典拠強度】
- OCR確認のみ: 有力（誤認識の可能性あり）
- 画像で目視確認済み: 確認済み
```
