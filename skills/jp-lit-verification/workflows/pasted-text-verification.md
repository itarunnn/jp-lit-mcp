# pasted-text-verification

## 対象

- 他サービスの返答
- 他セッションの会話ログ
- 参考文献一覧を含む貼り付け文章

## 検証フロー

1. 文章を受け取る
2. 文献候補を抽出する
3. `SID = jp_lit_start_session(research_goal="貼り付け文章の文献検証").session_id` を保持する。継続依頼では同じ案件の既存IDを引き継ぐ
4. `jp_lit_search(session_id=SID, source=ndl_search, query=...)` で一次検証する。`SID` は返された実際のIDに置き換える
5. 必要なら同じ `session_id` を渡して個別 source で再確認する。取得・照合・注釈・exportにも同じIDを明示する
6. 主表を作る
7. 判定理由を各行に丁寧に書く
8. `部分一致` / `混線の疑い` では確認候補の書誌詳細を添える
9. 弱い候補は別枠へ回す
