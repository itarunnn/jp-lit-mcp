# 全文・ページ特定・OCR ワークフロー（fulltext_page_lookup）

## 対象となる依頼

- 「この語がデジコレのどのページに出るか調べたい」
- 「〇〇という表現が使われている資料を全文から探したい」
- 「OCR でページの文字を取得したい」
- 「ページ画像の URL を取得したい」

---

## ツール早見表

| 目的 | ツール |
|------|--------|
| 次世代デジタルライブラリー収録資料から全文横断検索 | `jp_lit_search_fulltext` |
| 国書DB収録本文のスニペット検索 | `jp_lit_search_kokusho_fulltext` |
| 特定資料内のページ検索 | `jp_lit_search_pages` |
| 特定ページの OCR テキスト + 画像 URL | `jp_lit_get_text_coordinates` |
| 資料全ページの OCR テキスト一括取得 | `jp_lit_get_fulltext` |

---

## 次世代 API とデジコレ公式画面を分ける

`jp_lit_search_fulltext` は次世代デジタルライブラリー API の収録資料を検索する。デジコレ本体の全文検索結果を取得する公開・文書化 API ではない。デジコレ本体では、次世代 API の範囲外にあるログインなし公開資料、個人送信・図書館送信対象、館内限定資料の全文ヒットが見える場合がある。

そのため、利用者がデジコレ本体の全文、網羅性、限定資料を含むヒット確認を求める場合は、MCP の検索件数にかかわらず、次の2経路を独立して計画する。

1. MCP で次世代デジタルライブラリー API の OCR 検索・ページ確認を行う。
2. 利用者の許可を得た場合だけ、デジコレ公式画面をブラウザで検索する。

公式画面を使う前に、調査計画の提示時に次のように確認する。

> 次世代デジタルライブラリー API の範囲に加えて、デジコレ公式画面も検索しますか？ 公式画面を使う場合は、未ログイン検索のみか、ログイン済み Chrome も使用可かを指定してください。

- 既定は MCP のみで、ブラウザ操作は行わない。
- 「デジコレ本体をブラウザでも検索して」という指示は未ログイン検索だけの許可として扱う。
- ログイン済み Chrome は別の権限であり、明示許可なしに使わない。内蔵 Browser から Chrome へ無断で切り替えない。
- 検索と閲覧を分ける。未ログインでも限定資料がヒットしたことや公開範囲表示を確認できる場合がある。本文閲覧にログインが必要なら一度止まる。人間が認証した事実だけではログイン済み Chrome の利用許可を得たことにならない。別途の明示許可がある場合だけ、その正規の閲覧権限内で再開する。許可がなければ `本文: アクセス制限` として、未ログインで確認できた範囲までを記録する。
- エージェントは認証情報を要求・入力・保存せず、CAPTCHA やアクセス制限を回避しない。

### 公開 API を確認できないことによる欠点

デジコレ本体の全文検索結果を返す公開・文書化 API は確認できていないため、MCP だけでは、公式画面側の総ヒット件数、該当コマ、スニペット、公開範囲を機械可読に一括取得できない。API としてのページング、キャッシュ、差分比較、安定した全件収集も保証できず、ブラウザ UI、セッション状態、表示遅延の影響を受ける。

### ブラウザ検索を併用する利点

許可を得たブラウザ検索では、次世代 API の件数が0件でも1件以上でも、API 範囲外の全文ヒットと公開範囲表示を補完できる。これにより、MCP の結果をデジコレ全体の不在証明にせず、検索可能範囲を分けた調査報告にできる。

ブラウザは公開 API の代替ではない。調査ログには query、filter、ログイン状態、確認日時、確認できたヒット表示範囲を残し、最終回答では「MCP の次世代デジタルライブラリー API 範囲」と「デジコレ公式画面範囲」を分ける。

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
