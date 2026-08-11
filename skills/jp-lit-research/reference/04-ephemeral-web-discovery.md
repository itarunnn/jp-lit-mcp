# 速報Web発見 runbook

## 使用条件

速報Web検索は、新しい検索レーンではなく既存Web補助確認の条件付き分岐として使う。次のような情報が文献調査の発端になりうる場合に限る。

- 刊行直後の論争、批判、応答
- 未発表資料、刊行予定、掲載予定への言及
- 研究会、シンポジウム、出版イベント
- 研究者や書評者が共有した新しい書評・掲載情報

Yahoo!リアルタイム検索などで投稿を発見してよい。ただし、Webを広く巡回して候補集合を作らず、文献DBを主経路として維持する。

次の場合はこの分岐を使わない。

- 既知の書誌をNDL、CiNii、出版社等で直接確認できる
- 投稿内容そのものを学術的評価や本文理解の根拠にしたい
- 投稿本文の収集、継続監視、網羅検索が必要である

## 保存contract

投稿を確認したら、同じ調査 `session_id` の `open_questions[].evidence_refs` または `next_actions[].evidence_refs` に保存する。通常は、正式 source で裏取りする行動の `next_actions` に付ける。

`agent_web` recordでは次をすべて記録する。

- 証拠種別: `agent_web`
- 安定性: `ephemeral`
- 検索サービス
- 検索語
- 投稿URL
- 投稿者
- 投稿日時
- 確認日時
- 投稿から到達したリンク先URLを1件以上
- 発見理由の短い要約

```json
{
  "action": "リンク先の書評と掲載情報を正式 source で確認する",
  "reason": "速報Web投稿は調査の発端であり確証ではないため",
  "priority": "high",
  "evidence_refs": [
    {
      "evidence_type": "agent_web",
      "stability": "ephemeral",
      "discovery_source": "Yahoo!リアルタイム検索",
      "query": "河野有理 McMullen Nakai",
      "url": "https://search.yahoo.co.jp/realtime/example-post",
      "author": "河野有理",
      "published_at": "2026-08-10T09:00:00+09:00",
      "checked_at": "2026-08-10T10:00:00+09:00",
      "linked_urls": ["https://example.org/review"],
      "quote_or_summary": "書評と掲載誌情報へ進む発見経路"
    }
  ]
}
```

`checked_at` は投稿を画面上で確認した時刻、親の `next_actions[].created_at` / `open_questions[].created_at` はsessionへ保存した時刻である。推測した日時を入れない。

## 正式確認

Web投稿を書誌的事実・真偽・学術的評価の確証にしない。投稿は「どこから次の資料へ進んだか」を示す調査経路の証拠である。

投稿から見つけた主張は、内容に応じて次の正式 sourceで確認する。

1. 出版社、雑誌、学会、研究機関の公式ページで刊行・掲載・イベント情報を確認する。
2. NDL、CiNiiなどの書誌DBで題名、著者、媒体、巻号、刊行日を確認する。
3. 書評本文、雑誌本文、目次、要旨へ到達できる場合は、実際に確認した範囲を別のevidenceとして残す。
4. 最終回答では「速報Webで発見」と「正式 sourceで確認」を別々に示す。

正式確認できない場合は `候補`、`未確認事項`、または `needs_followup` に留める。投稿だけを根拠に `adopt` しない。

## 失敗・停止

- 投稿URL、投稿者、投稿日時、確認日時、検索語、リンク先を画面上で確認できない場合は、不完全な `agent_web` recordを作らない。通常のWeb補助確認メモまたはopen questionに留める。
- 投稿やリンク先が後から消えた場合、保存済み記録は発見経路として残すが、内容を確認済み事実へ昇格しない。
- リンク先がアクセス不能なら、その状態を未確認事項に残し、別の公式 sourceを探す。
- Yahoo!の画面構造を恒久的なmachine endpointと見なさない。
- 新しいMCPツール、Yahoo専用adapter、スクレイピング、継続監視、網羅クロールを追加しない。
- ログインsession、cookie、削除済み投稿の復元、閲覧制限回避を行わない。
